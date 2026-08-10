import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { deleteCookie, getCookie, setCookie } from "@wapp/ui";
import type { ApiErrorResponse, ApiSuccessResponse } from "@wapp/shared-types";
import { env } from "./env";
import { REFRESH_TOKEN_COOKIE } from "./auth-cookie";
import { refreshTokenCookieMaxAge } from "./remember-me";
import { useAuthStore } from "../stores/auth-store";
import type { IssuedPlatformTokenPair } from "../types/auth";

export { REFRESH_TOKEN_COOKIE };

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

const client: AxiosInstance = axios.create({ baseURL: env.apiUrl });
const refreshClient: AxiosInstance = axios.create({ baseURL: env.apiUrl });

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);
  if (!refreshToken) {
    throw new ApiError("No active session", 401);
  }
  const response = await refreshClient.post<ApiSuccessResponse<IssuedPlatformTokenPair>>(
    "/platform/auth/refresh",
    { refreshToken },
  );
  const tokens = response.data.data;
  useAuthStore.getState().setAccessToken(tokens.accessToken);
  setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshTokenCookieMaxAge());
  return tokens.accessToken;
}

function handleAuthFailure(): void {
  useAuthStore.getState().clear();
  deleteCookie(REFRESH_TOKEN_COOKIE);
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const original = error.config;
    const isAuthEndpoint =
      original?.url?.startsWith("/platform/auth/login") ||
      original?.url?.startsWith("/platform/auth/refresh");

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
