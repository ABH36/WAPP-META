import { SetMetadata } from "@nestjs/common";
import type { PlatformPermission } from "@wapp/shared-types";

export const REQUIRED_PLATFORM_PERMISSION_KEY = "requiredPlatformPermission";

/** Platform-side equivalent of `RequirePermission` — uses the fully independent `PLATFORM_PERMISSION_MATRIX`, never the tenant one. */
export const RequirePlatformPermission = (
  permission: PlatformPermission,
): ReturnType<typeof SetMetadata> => SetMetadata(REQUIRED_PLATFORM_PERMISSION_KEY, permission);
