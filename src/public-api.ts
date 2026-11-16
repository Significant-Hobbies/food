import type { CatalogResponse, HealthResponse, ProductDetailResponse } from "../shared/api";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as { error?: { code?: string; message?: string; details?: unknown } }).error
      : null;
    throw new ApiRequestError(
      error?.message ?? `Request failed (${response.status})`,
      response.status,
      error?.code ?? "request_failed",
      typeof error?.details === "object" && error.details !== null && !Array.isArray(error.details)
        ? error.details as Record<string, unknown>
        : null,
    );
  }
  return body as T;
}

export const publicApi = {
  health: () => request<HealthResponse>("/api/health"),
  catalog: (params: URLSearchParams, signal?: AbortSignal) =>
    request<CatalogResponse>(`/api/products?${params}`, { signal }),
  product: (id: string, signal?: AbortSignal) =>
    request<ProductDetailResponse>(`/api/products/${encodeURIComponent(id)}`, { signal }),
};
