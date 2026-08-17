import { Injectable } from "@nestjs/common";
import {
  InvoiceService,
  ListInvoicesForPlatformResult,
} from "../../billing/services/invoice.service.js";
import type { ListInvoicesForPlatformFilter } from "../../billing/repositories/invoice.repository.js";
import type { InvoiceSummary } from "../../billing/billing.types.js";

const MAX_PAGE_SIZE = 100;

/** PRD-007 Volume-2 §4.2 — every method delegates to InvoiceService (BR-006/§11: no duplicate commercial logic). */
@Injectable()
export class PlatformInvoicesService {
  constructor(private readonly invoiceService: InvoiceService) {}

  async list(
    filter: ListInvoicesForPlatformFilter,
    page: number,
    limit: number,
  ): Promise<ListInvoicesForPlatformResult> {
    return this.invoiceService.listAllForPlatform(filter, page, Math.min(limit, MAX_PAGE_SIZE));
  }

  async getById(invoiceId: string): Promise<InvoiceSummary> {
    return this.invoiceService.getById(invoiceId);
  }

  async void(invoiceId: string, reason: string, actorId: string): Promise<InvoiceSummary> {
    return this.invoiceService.void(invoiceId, reason, actorId);
  }
}
