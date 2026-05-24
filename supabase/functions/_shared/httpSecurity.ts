/**
 * Boas práticas HTTP para Edge Functions (CORS restrito, rate limit simples, headers).
 * Segurança: configurar secret ALLOWED_ORIGINS no Supabase (Dashboard → Edge Functions → Secrets).
 */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;
const buckets = new Map<string, { count: number; resetAt: number }>();

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS")?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }
  // Local: Vite (3080), default Vite (5173). Produção: defina ALLOWED_ORIGINS.
  return [
    "http://localhost:3080",
    "http://127.0.0.1:3080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** Rate limit por IP (memória do isolate; mitiga abuso básico — produção pode usar Upstash/KV). */
export function rateLimitExceeded(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  if (b.count > RATE_MAX) return true;
  return false;
}

/** Vite dev (3080/5173) acessado por IP da LAN, Radmin VPN, celular na mesma rede, etc. */
function isLanDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const port = url.port || (url.protocol === "https:" ? "443" : "80");
    if (port !== "3080" && port !== "5173") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    // IPv4 na rede local / VPN — só quando ALLOWED_ORIGINS não está fixo em produção
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin || origin === "null") return false;
  const allowed = parseAllowedOrigins();
  const normalized = origin.replace(/\/$/, "");
  if (allowed.some((a) => a === normalized)) return true;
  // Sem secret ALLOWED_ORIGINS no Supabase: permitir dev por IP (ex.: http://26.x.x.x:3080)
  if (!Deno.env.get("ALLOWED_ORIGINS")?.trim() && isLanDevOrigin(normalized)) {
    return true;
  }
  // Vercel (preview e producao) quando ALLOWED_ORIGINS nao foi configurado
  if (!Deno.env.get("ALLOWED_ORIGINS")?.trim()) {
    try {
      const host = new URL(normalized).hostname;
      if (host.endsWith(".vercel.app") && normalized.startsWith("https://")) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function corsHeadersForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedList = parseAllowedOrigins();
  const base = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-requested-with",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  } as const;

  if (origin && isOriginAllowed(origin)) {
    return { ...base, "Access-Control-Allow-Origin": origin };
  }
  if (!origin && allowedList.length > 0) {
    return { ...base, "Access-Control-Allow-Origin": allowedList[0] };
  }
  // Origin presente e não confiável: não enviar ACAO (navegador bloqueia leitura da resposta).
  return { ...base };
}

export const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  /** Respostas JSON da função; não confundir com CSP da SPA (Vercel / meta). */
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

export function mergeHeaders(
  base: Record<string, string>,
  extra?: HeadersInit
): Headers {
  const h = new Headers(base);
  if (extra) {
    new Headers(extra).forEach((v, k) => h.set(k, v));
  }
  return h;
}

export function assertBrowserPostHeaders(req: Request): string | null {
  if (req.method !== "POST") return null;
  const xrw = req.headers.get("x-requested-with");
  if (!xrw || xrw.toLowerCase() !== "xmlhttprequest") {
    return "Cabeçalho X-Requested-With ausente ou inválido.";
  }
  const origin = req.headers.get("origin");
  if (origin && !isOriginAllowed(origin)) {
    return "Origem não autorizada.";
  }
  return null;
}

export function jsonResponse(
  body: unknown,
  status: number,
  req: Request,
  extraHeaders?: Record<string, string>
): Response {
  const headers = mergeHeaders(
    {
      ...corsHeadersForRequest(req),
      ...securityHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    }
  );
  return new Response(JSON.stringify(body), { status, headers });
}
