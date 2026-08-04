import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration.js";
import { WorkspaceMemberStatus } from "@wapp/shared-types";
import { EmailService } from "../../../infrastructure/email/email.service.js";
import { UserRepository } from "../repositories/user.repository.js";
import { AuthTokenRepository } from "../repositories/auth-token.repository.js";
import { SessionRepository } from "../repositories/session.repository.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { AuthTokenType } from "../schemas/auth-token.schema.js";
import type { UserDocument } from "../schemas/user.schema.js";
import {
  buildPasswordResetEmail,
  buildVerificationEmail,
} from "../emails/identity-email.templates.js";
import { toSessionSummary, toUserProfile } from "../mappers/user.mapper.js";
import type { IssuedTokenPair, SessionSummary, UserProfile } from "../identity.types.js";
import type { RegisterDto } from "../dto/register.dto.js";
import type { LoginDto } from "../dto/login.dto.js";
import type { ForgotPasswordDto } from "../dto/forgot-password.dto.js";
import type { ResetPasswordDto } from "../dto/reset-password.dto.js";
import type { ResendVerificationDto } from "../dto/resend-verification.dto.js";

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

// Fixed dummy hash compared against on a not-found login lookup, so response
// timing doesn't reveal whether an email is registered (OWASP user-enumeration
// mitigation). Not a real credential — bcrypt hash of a random, discarded value.
const DUMMY_PASSWORD_HASH = "$2b$12$K.KuXIGE9EN3ottgrPQCPOB9piOJ1/oDsbD2O7Qxb9W.l67tV5dPm";

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authTokenRepository: AuthTokenRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<{ email: string }> {
    const [existingByEmail, existingByMobile] = await Promise.all([
      this.userRepository.findByEmail(dto.email),
      this.userRepository.findByMobileNumber(dto.mobileNumber),
    ]);

    // REG-BR-002/003 — both email and mobile are unique, hard rule, no fallback.
    if (existingByEmail) {
      throw new ConflictException("An account with this email already exists");
    }
    if (existingByMobile) {
      throw new ConflictException("An account with this mobile number already exists");
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      mobileNumber: dto.mobileNumber,
      passwordHash,
    });

    await this.issueAndSendVerificationEmail(user);

    return { email: user.email };
  }

  async verifyEmail(rawToken: string): Promise<{ tokens: IssuedTokenPair; user: UserProfile }> {
    const tokenHash = this.tokenService.hashOpaqueToken(rawToken);
    const authToken = await this.authTokenRepository.findValidByHash(
      tokenHash,
      AuthTokenType.EMAIL_VERIFICATION,
    );

    if (!authToken) {
      throw new BadRequestException("This verification link is invalid or has expired");
    }

    await this.authTokenRepository.markUsed(authToken._id.toString());
    await this.userRepository.markEmailVerified(authToken.userId.toString());

    const user = await this.userRepository.findById(authToken.userId.toString());
    if (!user) {
      throw new BadRequestException("This verification link is invalid or has expired");
    }

    // Verification is the moment LOGIN-BR-001 is satisfied — auto-issuing
    // tokens here removes an otherwise-pointless extra manual login step from
    // the D015 30-minute activation funnel.
    const tokens = await this.issueTokenPair(user, { userAgent: null, ipAddress: null });
    return { tokens, user: toUserProfile(user) };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    // Always behave identically regardless of whether the account exists or
    // is already verified — do not let this endpoint be used to enumerate
    // registered emails.
    if (user && !user.isEmailVerified) {
      await this.issueAndSendVerificationEmail(user);
    }
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<{ tokens: IssuedTokenPair; user: UserProfile }> {
    const user = await this.userRepository.findByEmail(dto.email, { withPassword: true });

    if (!user) {
      // Constant-time-ish: still run a bcrypt compare so a nonexistent-email
      // response isn't measurably faster than a wrong-password one.
      await this.passwordService.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException("Invalid email or password");
    }

    const { maxFailedLoginAttempts, accountLockoutMinutes } = this.config.get("auth", {
      infer: true,
    });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        "This account is temporarily locked due to multiple failed login attempts. Please try again later.",
      );
    }

    const passwordMatches = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.userRepository.registerFailedLogin(
        user._id.toString(),
        maxFailedLoginAttempts,
        accountLockoutMinutes,
      );
      throw new UnauthorizedException("Invalid email or password");
    }

    if (!user.isActive) {
      throw new ForbiddenException("This account has been disabled. Please contact support.");
    }

    // LOGIN-BR-001 — only verified accounts may log in.
    if (!user.isEmailVerified) {
      throw new ForbiddenException("Please verify your email address before logging in");
    }

    // PRD-002 Part 3B — a suspended/removed workspace member cannot log in.
    // Belt-and-suspenders: TeamService also revokes all of their sessions on
    // suspend/remove, but this is the direct gate for a *new* login attempt.
    if (user.workspaceMemberStatus === WorkspaceMemberStatus.SUSPENDED) {
      throw new ForbiddenException(
        "Your access to this workspace has been suspended. Please contact your workspace administrator.",
      );
    }
    if (user.workspaceMemberStatus === WorkspaceMemberStatus.REMOVED) {
      throw new ForbiddenException("Your access to this workspace has been removed.");
    }

    await this.userRepository.recordSuccessfulLogin(user._id.toString());
    const tokens = await this.issueTokenPair(user, meta);
    return { tokens, user: toUserProfile(user) };
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<IssuedTokenPair> {
    const payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
    const session = await this.sessionRepository.findByJti(payload.jti);

    if (!session) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (session.revokedAt) {
      // Reuse of an already-rotated/revoked refresh token is a strong signal
      // of token theft — respond by revoking every session for this user,
      // forcing re-authentication on every device (TAD-001 §11 session
      // management hardening).
      await this.sessionRepository.revokeAllForUser(session.userId.toString());
      throw new UnauthorizedException(
        "This session is no longer valid. For your security, all sessions have been signed out — please log in again.",
      );
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired, please log in again");
    }

    const user = await this.userRepository.findById(session.userId.toString());
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (
      user.workspaceMemberStatus === WorkspaceMemberStatus.SUSPENDED ||
      user.workspaceMemberStatus === WorkspaceMemberStatus.REMOVED
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const rotated = await this.createSession(user._id.toString(), meta);
    await this.sessionRepository.revokeByJti(payload.jti, rotated.jti);

    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user._id.toString(),
      workspaceId: user.workspaceId,
      role: user.role,
      workspaceMemberStatus: user.workspaceMemberStatus,
      emailVerified: user.isEmailVerified,
    });

    return { accessToken, refreshToken: rotated.token, expiresIn };
  }

  /**
   * Mints a fresh token pair for a user whose workspace membership just
   * changed (created a Workspace, accepted an invitation) — called by the
   * Workspace module (via IdentityModule's exported AuthService) so the
   * acting user doesn't have to manually log out/in to pick up their new
   * `workspaceId`/`role`. Not used for actions an admin takes on *another*
   * user (role change, suspend, remove) — those rely on the existing
   * short access-token TTL / session revocation instead (see
   * docs/SEC-THREAT-MODEL-authentication.md §2–3).
   */
  async reissueTokens(userId: string, meta: RequestMeta): Promise<IssuedTokenPair> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return this.issueTokenPair(user, meta);
  }

  /**
   * Force-logout everywhere — called by the Workspace module when a member
   * is suspended/removed. Kept here (not a raw SessionRepository export) so
   * the `sessions` collection stays exclusively Identity's, per SAD-002 DB-001.
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.sessionRepository.revokeAllForUser(userId);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    try {
      const payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
      await this.sessionRepository.revokeByJti(payload.jti);
    } catch {
      // Logout is idempotent — an already-invalid/expired token is not an error.
    }
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.sessionRepository.revokeAllForUser(userId);
  }

  async listSessions(userId: string): Promise<SessionSummary[]> {
    const sessions = await this.sessionRepository.findActiveByUser(userId);
    return sessions.map(toSessionSummary);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const revoked = await this.sessionRepository.revokeByIdForUser(userId, sessionId);
    if (!revoked) {
      throw new BadRequestException("Session not found");
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    // Same enumeration-safety rule as resendVerification — always no-op silently.
    if (!user) {
      return;
    }

    const { passwordResetTokenTtlMinutes } = this.config.get("auth", { infer: true });
    await this.authTokenRepository.invalidatePendingForUser(
      user._id.toString(),
      AuthTokenType.PASSWORD_RESET,
    );

    const rawToken = this.tokenService.generateOpaqueToken();
    await this.authTokenRepository.create({
      userId: user._id.toString(),
      type: AuthTokenType.PASSWORD_RESET,
      tokenHash: this.tokenService.hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + passwordResetTokenTtlMinutes * 60_000),
    });

    const { web } = this.config.get("urls", { infer: true });
    const resetLink = `${web}/reset-password?token=${rawToken}`;
    const { subject, html, text } = buildPasswordResetEmail(resetLink);
    await this.emailService.send({
      to: user.email,
      subject,
      html,
      text,
      category: "password-reset",
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.tokenService.hashOpaqueToken(dto.token);
    const authToken = await this.authTokenRepository.findValidByHash(
      tokenHash,
      AuthTokenType.PASSWORD_RESET,
    );

    if (!authToken) {
      throw new BadRequestException("This password reset link is invalid or has expired");
    }

    await this.authTokenRepository.markUsed(authToken._id.toString());

    const passwordHash = await this.passwordService.hash(dto.newPassword);
    const userId = authToken.userId.toString();
    await this.userRepository.updatePasswordHash(userId, passwordHash);

    // A password reset invalidates every existing session — the credential
    // that established them may have been compromised.
    await this.sessionRepository.revokeAllForUser(userId);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return toUserProfile(user);
  }

  private async issueAndSendVerificationEmail(user: UserDocument): Promise<void> {
    const { emailVerificationTokenTtlMinutes } = this.config.get("auth", { infer: true });

    await this.authTokenRepository.invalidatePendingForUser(
      user._id.toString(),
      AuthTokenType.EMAIL_VERIFICATION,
    );

    const rawToken = this.tokenService.generateOpaqueToken();
    await this.authTokenRepository.create({
      userId: user._id.toString(),
      type: AuthTokenType.EMAIL_VERIFICATION,
      tokenHash: this.tokenService.hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + emailVerificationTokenTtlMinutes * 60_000),
    });

    const { web } = this.config.get("urls", { infer: true });
    const verificationLink = `${web}/verify-email?token=${rawToken}`;
    const { subject, html, text } = buildVerificationEmail(verificationLink);
    await this.emailService.send({
      to: user.email,
      subject,
      html,
      text,
      category: "email-verification",
    });
  }

  private async issueTokenPair(user: UserDocument, meta: RequestMeta): Promise<IssuedTokenPair> {
    const session = await this.createSession(user._id.toString(), meta);
    const { token: accessToken, expiresIn } = this.tokenService.signAccessToken({
      sub: user._id.toString(),
      workspaceId: user.workspaceId,
      role: user.role,
      workspaceMemberStatus: user.workspaceMemberStatus,
      emailVerified: user.isEmailVerified,
    });
    return { accessToken, refreshToken: session.token, expiresIn };
  }

  private async createSession(
    userId: string,
    meta: RequestMeta,
  ): Promise<{ token: string; jti: string }> {
    const { token, jti, expiresAt } = this.tokenService.signRefreshToken(userId);
    await this.sessionRepository.create({
      userId,
      jti,
      tokenHash: this.tokenService.hashOpaqueToken(token),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });
    return { token, jti };
  }
}
