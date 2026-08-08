import { Injectable } from "@nestjs/common";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import {
  toPlatformSearchUserSummary,
  toPlatformWorkspaceSummary,
} from "../mappers/platform.mapper.js";
import type { PlatformSearchUserSummary, PlatformWorkspaceSummary } from "../platform.types.js";

export interface PlatformSearchResult {
  workspaces: PlatformWorkspaceSummary[];
  users: PlatformSearchUserSummary[];
}

const SEARCH_RESULT_LIMIT = 20;

/** PRD-007 Volume-1 §4.6 — Workspace + User only this volume (resolved Question 3: Customer/Lead/Invoice cross-tenant PII search deferred). */
@Injectable()
export class PlatformSearchService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async search(q: string): Promise<PlatformSearchResult> {
    const [{ items: workspaces }, users] = await Promise.all([
      this.workspaceRepository.listAllForPlatform({ q }, 1, SEARCH_RESULT_LIMIT),
      this.userRepository.searchAcrossWorkspaces(q, SEARCH_RESULT_LIMIT),
    ]);

    return {
      workspaces: workspaces.map(toPlatformWorkspaceSummary),
      users: users.map(toPlatformSearchUserSummary),
    };
  }
}
