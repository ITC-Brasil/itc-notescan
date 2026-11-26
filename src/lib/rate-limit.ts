interface RateLimitRecord {
  count: number;
  reset: number;
}

const requests = new Map<string, RateLimitRecord>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const record = requests.get(key);

  if (!record || now > record.reset) {
    const reset = now + windowMs;
    requests.set(key, { count: 1, reset });
    return { allowed: true, remaining: limit - 1, reset };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, reset: record.reset };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, reset: record.reset };
}

export function rateLimitByIp(
  request: Request,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return rateLimit(ip, limit, windowMs);
}

// m8-01: limite por ator (humano ou agente), não por IP. Leitura 120/min para
// todos (um MCP lendo uma UM de 106 notebooks estouraria 30). Escrita: 30/min
// para token (automação) e 120/min para sessão (ADMIN editando em sequência).
// ponytail: Map em memória vale por container (hoje há um); Redis se escalar.
export const ACTOR_LIMITS = {
  session: { read: 120, write: 120 },
  token: { read: 120, write: 30 },
} as const;

export function rateLimitByActor(
  actorId: string,
  kind: "read" | "write",
  actorKind: keyof typeof ACTOR_LIMITS,
): RateLimitResult {
  return rateLimit(`actor:${kind}:${actorId}`, ACTOR_LIMITS[actorKind][kind], 60_000);
}
