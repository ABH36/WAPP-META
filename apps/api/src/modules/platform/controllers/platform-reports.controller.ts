import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformReportsService } from "../services/platform-reports.service.js";
import {
  PlatformReportsExportQueryDto,
  PlatformReportsQueryDto,
} from "../dto/platform-reports-query.dto.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";

/** §4.2/§9 — GET /platform/reports (JSON preview), GET /platform/reports/export (CSV/Excel download). */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/reports", version: "1" })
export class PlatformReportsController {
  constructor(private readonly platformReportsService: PlatformReportsService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_ANALYTICS)
  @Get()
  async getReport(
    @Query() query: PlatformReportsQueryDto,
  ): Promise<Record<string, string | number>[]> {
    return this.platformReportsService.getReport(query);
  }

  // Binary response (CSV/Excel), bypasses the global ResponseInterceptor's
  // JSON envelope via @Res() — same precedent as Billing/CRM Reports' own
  // export routes.
  @RequirePlatformPermission(PlatformPermission.EXPORT_PLATFORM_REPORTS)
  @Get("export")
  async exportReport(
    @Query() query: PlatformReportsExportQueryDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename, contentType } = await this.platformReportsService.exportReport(
      query,
      user.platformUserId,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
