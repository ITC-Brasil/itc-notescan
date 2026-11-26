// m8-01: com sendDefaultPii, o Sentry anexa headers da request aos eventos e
// transações. O Bearer do agente e o cookie de sessão nunca podem sair daqui.
const SENSITIVE = /^(authorization|cookie|set-cookie)$/i;

type Headers = Record<string, unknown>;

function scrubHeaders(headers: unknown): void {
  if (!headers || typeof headers !== "object") return;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE.test(key)) delete (headers as Headers)[key];
  }
}

interface Scrubbable {
  request?: { headers?: unknown; cookies?: unknown };
  breadcrumbs?: { data?: Record<string, unknown> }[];
}

export function scrubEvent<T extends Scrubbable>(event: T): T {
  if (event.request) {
    scrubHeaders(event.request.headers);
    delete event.request.cookies;
  }
  for (const crumb of event.breadcrumbs ?? []) scrubBreadcrumbData(crumb.data);
  return event;
}

// Breadcrumbs de fetch/xhr: headers podem aparecer em data.headers,
// data.request_headers ou data.response_headers, conforme a integração.
export function scrubBreadcrumbData(data: Record<string, unknown> | undefined): void {
  if (!data) return;
  scrubHeaders(data);
  for (const key of ["headers", "request_headers", "response_headers"]) scrubHeaders(data[key]);
}

export const sentryScrubOptions = {
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: <B extends { data?: Record<string, unknown> }>(crumb: B) => {
    scrubBreadcrumbData(crumb.data);
    return crumb;
  },
};
