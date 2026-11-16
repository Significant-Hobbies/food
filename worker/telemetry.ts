import { createAppHealthClient } from "@saas-maker/app-health";

const INGEST_ENDPOINT = "https://ingest.sassmaker.com/v1/ingest";

// Route templates — telemetry must never leak raw path params (ids, slugs).
function routeFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/api/products") return "/api/products";
  if (/^\/api\/products\/[^/]+$/.test(path)) return "/api/products/:id";
  if (/^\/products\/[^/]+\.md$/.test(path)) return "/products/:id.md";
  if (/^\/products\/[^/]+$/.test(path)) return "/products/:id";
  const exact = [
    "/",
    "/api/coverage",
    "/api/ai",
    "/health",
    "/api/health",
    "/sitemap.xml",
    "/llms.txt",
    "/llms-full.txt",
    "/index.md",
  ];
  return exact.includes(path) ? path : null;
}

export function observeRequest(
  request: Request,
  response: Response,
  startedAt: number,
  env: Env,
  ctx: ExecutionContext,
): void {
  const key = "APP_HEALTH_INGEST_KEY" in env && typeof env.APP_HEALTH_INGEST_KEY === "string" ? env.APP_HEALTH_INGEST_KEY.trim() : "";
  const route = routeFor(new URL(request.url).pathname);
  if (!key || !route) return;
  try {
    const client = createAppHealthClient({
      key,
      endpoint: INGEST_ENDPOINT,
      environment: "production",
      runtime: "worker",
      maxQueueSize: 2,
      maxBatchSize: 2,
      maxRetries: 0,
      requestTimeoutMs: 1000,
      disableTimer: true,
    });
    client.record({
      method: request.method,
      route,
      status_code: response.status,
      duration_ms: Math.max(0, Math.round(Date.now() - startedAt)),
    });
    ctx.waitUntil(client.flush().catch(() => undefined));
  } catch {
    // Telemetry must never take down the request path.
  }
}
