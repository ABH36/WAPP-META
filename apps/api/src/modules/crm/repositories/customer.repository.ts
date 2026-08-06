import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, FilterQuery, Model } from "mongoose";
import { CustomerSource, CustomerStatus } from "@wapp/shared-types";
import { Customer, CustomerDocument } from "../schemas/customer.schema.js";

export interface CreateCustomerInput {
  workspaceId: string;
  contactId: string;
  customerName: string;
  mobileNumber: string;
  source: CustomerSource;
  companyName: string | null;
  email: string | null;
  gstNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
  createdBy: string;
}

export interface UpdateCustomerInput {
  customerName?: string;
  companyName?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface ListCustomersFilter {
  status?: CustomerStatus;
  source?: CustomerSource;
  /** §12 — free-text search across Name/Mobile/Company/Email/GST. */
  q?: string;
}

/** §14 — the sortable fields Volume-1 Part-1 supports. "Last Conversation" is TD-006 (deferred — needs a cross-module Communication lookup). */
export type CustomerSortField = "customerName" | "createdAt" | "updatedAt" | "companyName";

export interface ListCustomersResult {
  items: CustomerDocument[];
  total: number;
}

const SORT_FIELD_MAP: Record<CustomerSortField, string> = {
  customerName: "customerName",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  companyName: "companyName",
};

@Injectable()
export class CustomerRepository {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
  ) {}

  /** `session` — passed by LeadConversionService when creating a Customer as part of its transaction (BR-008); omitted for the normal, non-transactional Part-1 create path. */
  async create(input: CreateCustomerInput, session?: ClientSession): Promise<CustomerDocument> {
    const [created] = await this.customerModel.create(
      [{ ...input, status: CustomerStatus.ACTIVE, updatedBy: input.createdBy }],
      { session },
    );
    return created!;
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<CustomerDocument | null> {
    return this.customerModel.findOne({ _id: id, workspaceId }).exec();
  }

  /** BR-006/§10 dedup check — one Customer per Contact per Workspace (see customer.schema.ts's unique index). */
  async findByContactForWorkspace(
    workspaceId: string,
    contactId: string,
  ): Promise<CustomerDocument | null> {
    return this.customerModel.findOne({ workspaceId, contactId }).exec();
  }

  async list(
    workspaceId: string,
    filter: ListCustomersFilter,
    sortBy: CustomerSortField,
    sortOrder: 1 | -1,
    page: number,
    limit: number,
  ): Promise<ListCustomersResult> {
    const query: FilterQuery<CustomerDocument> = { workspaceId };
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.source) {
      query.source = filter.source;
    }
    if (filter.q) {
      // §12 — Customer Name, Mobile Number, Company, Email, GST Number.
      const pattern = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { customerName: pattern },
        { mobileNumber: pattern },
        { companyName: pattern },
        { email: pattern },
        { gstNumber: pattern },
      ];
    }

    const [items, total] = await Promise.all([
      this.customerModel
        .find(query)
        .sort({ [SORT_FIELD_MAP[sortBy]]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.customerModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async update(
    workspaceId: string,
    id: string,
    input: UpdateCustomerInput,
    updatedBy: string,
  ): Promise<CustomerDocument | null> {
    return this.customerModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: { ...input, updatedBy } }, { new: true })
      .exec();
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: CustomerStatus,
    updatedBy: string,
  ): Promise<CustomerDocument | null> {
    return this.customerModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: { status, updatedBy } }, { new: true })
      .exec();
  }
}
