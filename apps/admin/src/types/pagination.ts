/** FRD-001 Volume-8 — mirrors the flat `{items, total, page, limit}` envelope every paginated Platform list route returns (`PlatformWorkspaceRegistryService.list()` etc.) — confirmed against the real service return types directly, not the nested `{items, meta}` shape `apps/web`'s Communication module uses. */
export interface PlatformPaginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
