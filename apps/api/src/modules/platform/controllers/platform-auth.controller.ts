import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformAuthService } from "../services/platform-auth.service.js";
import { PlatformLoginDto } from "../dto/platform-login.dto.js";
import { PlatformRefreshDto } from "../dto/platform-refresh.dto.js";
import type {
  AuthenticatedPlatformUser,
  IssuedPlatformTokenPair,
  PlatformUserProfile,
} from "../platform.types.js";

// SEC-009-equivalent — same 5 requests/minute throttle already applied to the tenant AuthController's credential-issuing endpoints.
const PLATFORM_AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller({ path: "platform/auth", version: "1" })
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Public()
  @Throttle(PLATFORM_AUTH_THROTTLE)
  @Post("login")
  async login(
    @Body() dto: PlatformLoginDto,
    @Req() request: Request,
  ): Promise<{ tokens: IssuedPlatformTokenPair; user: PlatformUserProfile }> {
    return this.platformAuthService.login(dto.email, dto.password, this.extractMeta(request));
  }

  @Public()
  @Post("refresh")
  async refresh(
    @Body() dto: PlatformRefreshDto,
    @Req() request: Request,
  ): Promise<IssuedPlatformTokenPair> {
    return this.platformAuthService.refresh(dto.refreshToken, this.extractMeta(request));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Body() dto: PlatformRefreshDto): Promise<{ message: string }> {
    await this.platformAuthService.logout(dto.refreshToken);
    return { message: "Logged out" };
  }

  @Public()
  @UseGuards(PlatformAuthGuard)
  @Get("me")
  me(@CurrentPlatformUser() user: AuthenticatedPlatformUser): AuthenticatedPlatformUser {
    return user;
  }

  private extractMeta(request: Request): { userAgent: string | null; ipAddress: string | null } {
    return {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    };
  }
}
