import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import {
  PlatformSearchService,
  type PlatformSearchResult,
} from "../services/platform-search.service.js";
import { PlatformSearchQueryDto } from "../dto/platform-search-query.dto.js";

/** §4.6/§9 — GET /platform/search. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/search", version: "1" })
export class PlatformSearchController {
  constructor(private readonly platformSearchService: PlatformSearchService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_SEARCH)
  @Get()
  async search(@Query() query: PlatformSearchQueryDto): Promise<PlatformSearchResult> {
    return this.platformSearchService.search(query.q);
  }
}
