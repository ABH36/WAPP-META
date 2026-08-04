import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../../common/decorators/public.decorator.js";
import { CurrentUser } from "../decorators/current-user.decorator.js";
import { AuthService } from "../services/auth.service.js";
import { RegisterDto } from "../dto/register.dto.js";
import { LoginDto } from "../dto/login.dto.js";
import { VerifyEmailDto } from "../dto/verify-email.dto.js";
import { ResendVerificationDto } from "../dto/resend-verification.dto.js";
import { ForgotPasswordDto } from "../dto/forgot-password.dto.js";
import { ResetPasswordDto } from "../dto/reset-password.dto.js";
import { RefreshTokenDto } from "../dto/refresh-token.dto.js";
import type {
  AuthenticatedUser,
  IssuedTokenPair,
  SessionSummary,
  UserProfile,
} from "../identity.types.js";

// SEC-009 — 5 requests/minute on credential- and token-issuing endpoints.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("register")
  async register(@Body() dto: RegisterDto): Promise<{ email: string; message: string }> {
    const result = await this.authService.register(dto);
    return {
      ...result,
      message: "Registration successful. Please check your email to verify your account.",
    };
  }

  @Public()
  @Post("verify-email")
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ): Promise<{ tokens: IssuedTokenPair; user: UserProfile }> {
    return this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("resend-verification")
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ message: string }> {
    await this.authService.resendVerification(dto);
    return { message: "If an account with that email exists, a verification link has been sent." };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
  ): Promise<{ tokens: IssuedTokenPair; user: UserProfile }> {
    return this.authService.login(dto, this.extractMeta(request));
  }

  @Public()
  @Post("refresh")
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<IssuedTokenPair> {
    return this.authService.refresh(dto.refreshToken, this.extractMeta(request));
  }

  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken);
    return { message: "Logged out" };
  }

  @HttpCode(HttpStatus.OK)
  @Post("logout-all")
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<{ message: string }> {
    await this.authService.logoutAllDevices(user.userId);
    return { message: "Logged out of all devices" };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.forgotPassword(dto);
    return {
      message: "If an account with that email exists, a password reset link has been sent.",
    };
  }

  @Public()
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: "Password reset successful. Please log in with your new password." };
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.authService.getProfile(user.userId);
  }

  @Get("sessions")
  async listSessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionSummary[]> {
    return this.authService.listSessions(user.userId);
  }

  @Delete("sessions/:id")
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<{ message: string }> {
    await this.authService.revokeSession(user.userId, id);
    return { message: "Session revoked" };
  }

  private extractMeta(request: Request): { userAgent: string | null; ipAddress: string | null } {
    return {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    };
  }
}
