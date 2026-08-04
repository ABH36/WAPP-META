import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a route as exempt from the global authentication guard (SAD-001 Volume-2
 * §3/§4 — Identity Service, Stage 1). Established now, ahead of the Identity
 * module's implementation, so every route author has to make an explicit,
 * reviewable choice ("this is public") rather than a guard defaulting open by
 * omission — the safer failure mode for TAD-001 SEC-002 ("every protected
 * endpoint requires JWT authentication").
 */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
