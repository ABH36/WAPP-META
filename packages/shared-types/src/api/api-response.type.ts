/**
 * Traces to: TAD-001 §12 (API Standards), API-002, restored by TAD-001 v1.1 PATCH-002.
 * Every API response — success or failure — uses this exact envelope. No endpoint
 * may return a bare object or array; always wrap it.
 */
export interface ApiSuccessResponse<TData = unknown> {
  success: true;
  message: string;
  data: TData;
  meta?: ApiResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  data: null;
  errors: ApiFieldError[];
}

export type ApiResponse<TData = unknown> = ApiSuccessResponse<TData> | ApiErrorResponse;

export interface ApiFieldError {
  field?: string;
  message: string;
  code?: string;
}

/**
 * Mandatory on every collection endpoint (Customers, Leads, Deals, Conversations,
 * Broadcasts, Reports) per TAD-001 v1.1 PATCH-002.
 */
export interface ApiResponseMeta {
  page?: number;
  pageSize?: number;
  totalRecords?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  [key: string]: unknown;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}
