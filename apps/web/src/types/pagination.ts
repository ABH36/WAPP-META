/** FRD-001 Volume-4 §4.2 — mirrors `apps/api`'s `Paginated<T>` envelope (`common/interceptors/response.interceptor.ts`). The only paginated Communication resource is the top-level Conversation list and a Broadcast's recipient list — message lists and every other Communication list route return a plain array. */
export interface Paginated<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
