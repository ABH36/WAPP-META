import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { RefreshCookieService } from "../../../common/security/refresh-cookie.service.js";
import { PlatformAuthService } from "../services/platform-auth.service.js";
import { PlatformLoginDto } from "../dto/platform-login.dto.js";
import type {
  AuthenticatedPlatformUser,
  IssuedPlatformTokenPair,
  PlatformAccessTokenIssued,
  PlatformUserProfile,
} from "../platform.types.js";

// SEC-009-equivalent — same 5 requests/minute throttle already applied to the tenant AuthController's credential-issuing endpoints.
const PLATFORM_AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

// PHD-001 Volume-1 — must stay in sync with apps/admin/src/lib/auth-cookie.ts's
// REFRESH_TOKEN_COOKIE constant (separate deploys, can't be a shared import).
const REFRESH_TOKEN_COOKIE = "wapp_admin_rt";

@Controller({ path: "platform/auth", version: "1" })
export class PlatformAuthController {
  constructor(
    private readonly platformAuthService: PlatformAuthService,
    private readonly refreshCookies: RefreshCookieService,
  ) {}

  @Public()
  @Throttle(PLATFORM_AUTH_THROTTLE)
  @Post("login")
  async login(
    @Body() dto: PlatformLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ tokens: PlatformAccessTokenIssued; user: PlatformUserProfile }> {
    const { tokens, user } = await this.platformAuthService.login(
      dto.email,
      dto.password,
      this.extractMeta(request),
      dto.rememberMe ?? false,
    );
    this.setRefreshCookie(response, tokens);
    return { tokens: toAccessTokenIssued(tokens), user };
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlatformAccessTokenIssued> {
    const refreshToken = this.refreshCookies.read(request, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) {
      throw new UnauthorizedException("No active session");
    }
    const tokens = await this.platformAuthService.refresh(refreshToken, this.extractMeta(request));
    this.setRefreshCookie(response, tokens);
    return toAccessTokenIssued(tokens);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const refreshToken = this.refreshCookies.read(request, REFRESH_TOKEN_COOKIE);
    if (refreshToken) {
      await this.platformAuthService.logout(refreshToken);
    }
    this.refreshCookies.clear(response, REFRESH_TOKEN_COOKIE);
    return { message: "Logged out" };
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Get("me")
  me(@CurrentPlatformUser() user: AuthenticatedPlatformUser): AuthenticatedPlatformUser {
    return user;
  }

  private setRefreshCookie(response: Response, tokens: IssuedPlatformTokenPair): void {
    this.refreshCookies.set(
      response,
      REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      tokens.rememberMe,
      tokens.refreshTokenExpiresAt,
    );
  }

  private extractMeta(request: Request): { userAgent: string | null; ipAddress: string | null } {
    return {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    };
  }
}

function toAccessTokenIssued(tokens: IssuedPlatformTokenPair): PlatformAccessTokenIssued {
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}
