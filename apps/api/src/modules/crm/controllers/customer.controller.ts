import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CustomerSource, CustomerStatus, Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { CustomerService } from "../services/customer.service.js";
import { CreateCustomerDto } from "../dto/create-customer.dto.js";
import { UpdateCustomerDto } from "../dto/update-customer.dto.js";
import type { CustomerSortField } from "../repositories/customer.repository.js";
import type { CustomerSummary } from "../crm.types.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

const SORT_FIELDS = new Set<CustomerSortField>([
  "customerName",
  "createdAt",
  "updatedAt",
  "companyName",
]);

@Controller({ path: "crm/customers", version: "1" })
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @RequirePermission(Permission.CREATE_CUSTOMER)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ): Promise<CustomerSummary> {
    return this.customerService.create(user.workspaceId!, dto, user.userId);
  }

  @RequirePermission(Permission.VIEW_CUSTOMERS)
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: CustomerStatus,
    @Query("source") source?: CustomerSource,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "asc" | "desc",
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<CustomerSummary>> {
    return this.customerService.list(user.workspaceId!, {
      status,
      source,
      sortBy:
        sortBy && SORT_FIELDS.has(sortBy as CustomerSortField)
          ? (sortBy as CustomerSortField)
          : undefined,
      sortOrder,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  // §12/§18 — free-text search across Name/Mobile/Company/Email/GST.
  // Registered before ":id" so Nest doesn't match "search" as an id param.
  @RequirePermission(Permission.VIEW_CUSTOMERS)
  @Get("search")
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query("q") q: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<CustomerSummary>> {
    return this.customerService.list(user.workspaceId!, {
      q,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @RequirePermission(Permission.VIEW_CUSTOMERS)
  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CustomerSummary> {
    return this.customerService.getById(user.workspaceId!, id);
  }

  @RequirePermission(Permission.EDIT_CUSTOMER)
  @Patch(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<CustomerSummary> {
    return this.customerService.update(user.workspaceId!, id, dto, user.userId);
  }

  @RequirePermission(Permission.EDIT_CUSTOMER)
  @Patch(":id/block")
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CustomerSummary> {
    return this.customerService.block(user.workspaceId!, id, user.userId);
  }

  @RequirePermission(Permission.EDIT_CUSTOMER)
  @Patch(":id/activate")
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CustomerSummary> {
    return this.customerService.activate(user.workspaceId!, id, user.userId);
  }

  @RequirePermission(Permission.EDIT_CUSTOMER)
  @Patch(":id/archive")
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<CustomerSummary> {
    return this.customerService.archive(user.workspaceId!, id, user.userId);
  }
}
