import { Controller, Get } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import { PlanService } from "../services/plan.service.js";
import type { PlanSummary } from "../billing.types.js";

@Controller({ path: "billing/plans", version: "1" })
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get()
  async list(): Promise<PlanSummary[]> {
    return this.planService.listActive();
  }
}
