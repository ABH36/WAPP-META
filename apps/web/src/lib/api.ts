import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { ApiErrorResponse, ApiSuccessResponse } from "@wapp/shared-types";
import { env } from "./env";
import { useAuthStore } from "../stores/auth-store";
import type { AccessTokenIssued } from "../types/auth";

/** FRD-001 Volume-1 §13 — normalized client-side error, replacing axios's raw AxiosError at every call site. Never a raw stack trace/backend internal message (TAD-001 ERR-002, same rule the backend's own HttpExceptionFilter already enforces). */
export class ApiError extends Error {
  readonly statusCode: number | null;
  readonly errors: ApiErrorResponse["errors"];

  constructor(message: string, statusCode: number | null, errors: ApiErrorResponse["errors"] = []) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _retried?: boolean;
  }
}

// PHD-001 Volume-1 — `withCredentials: true` on every instance: the refresh
// token now travels as an httpOnly cookie the backend itself sets/reads
// (amends ADR-FE-001), so the browser must be told to actually send it.
const client: AxiosInstance = axios.create({ baseURL: env.apiUrl, withCredentials: true });

// A raw, uninstrumented instance for the refresh call itself — using `client`
// here would re-trigger this same response interceptor on a failed refresh,
// looping indefinitely.
const refreshClient: AxiosInstance = axios.create({ baseURL: env.apiUrl, withCredentials: true });

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// §11 — concurrent 401s must not each trigger their own refresh call; every
// caller that arrives while one is already in flight awaits the same promise.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // No body, no manual cookie read — the browser attaches the httpOnly
  // refresh cookie automatically (withCredentials above); the backend
  // rotates it via a fresh Set-Cookie on the response.
  const response = await refreshClient.post<ApiSuccessResponse<AccessTokenIssued>>("/auth/refresh");
  const tokens = response.data.data;
  useAuthStore.getState().setAccessToken(tokens.accessToken);
  return tokens.accessToken;
}

function handleAuthFailure(): void {
  useAuthStore.getState().clear();
  // The refresh cookie is httpOnly — this can't clear it client-side, and
  // doesn't need to: it's simply left to fail the next refresh attempt
  // server-side (revoked/expired) until a new login overwrites it.
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const original = error.config;
    const isAuthEndpoint =
      original?.url?.startsWith("/auth/login") || original?.url?.startsWith("/auth/refresh");

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        refreshInFlight ??= refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
        const newToken = await refreshInFlight;
        original.headers.set("Authorization", `Bearer ${newToken}`);
        return client(original);
      } catch {
        handleAuthFailure();
        return Promise.reject(new ApiError("Session expired, please log in again", 401));
      }
    }

    if (error.response?.status === 401 && !isAuthEndpoint) {
      handleAuthFailure();
    }

    const body = error.response?.data;
    throw new ApiError(
      body?.message ?? "Something went wrong. Please try again.",
      error.response?.status ?? null,
      body?.errors ?? [],
    );
  },
);

/** Unwraps the `ApiSuccessResponse` envelope so call sites deal in plain response types, never the envelope itself. */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await client.get<ApiSuccessResponse<T>>(url, { params });
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.post<ApiSuccessResponse<T>>(url, body);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await client.patch<ApiSuccessResponse<T>>(url, body);
  return res.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await client.delete<ApiSuccessResponse<T>>(url);
  return res.data.data;
}

export { client as apiClient };
