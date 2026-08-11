import { apiGet } from "../lib/api";
import type { MemberSummary } from "../types/team";

/** FRD-001 Volume-4 §4.2/§4.3 — `listMembers()` only, used to populate the Assign-to picker. `GET /team/members` is gated `VIEW_WORKSPACE` (readable by every role, same as the conversation list itself). */
export const teamService = {
  listMembers(): Promise<MemberSummary[]> {
    return apiGet("/team/members");
  },
};
