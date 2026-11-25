// Funções puras de hostname de notebook arquivado — sem Prisma, usáveis no cliente.
// Ao arquivar, o hostname recebe `~arq-YYYYMMDD` (data em America/Sao_Paulo) e,
// em colisão no mesmo dia, `-2`, `-3`... O padrão é reservado: cadastro/edição
// recusam hostnames que casem com ele.

export const ARCHIVE_SUFFIX_RE = /~arq-\d{8}(?:-\d{1,6})?$/; // eslint-disable-line security/detect-unsafe-regex -- linear, sem quantificador aninhado

export function isReservedHostname(hostname: string): boolean {
  return ARCHIVE_SUFFIX_RE.test(hostname);
}

/** Hostname sem o sufixo de arquivamento (idempotente para hostnames normais). */
export function originalHostname(hostname: string): string {
  return hostname.replace(ARCHIVE_SUFFIX_RE, "");
}

/** YYYYMMDD no fuso de America/Sao_Paulo. */
export function archiveDateStamp(date: Date): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");
}

/** Próximo hostname arquivado livre, dado o conjunto de hostnames já ocupados. */
export function nextArchivedHostname(original: string, stamp: string, taken: Set<string>): string {
  const base = `${original}~arq-${stamp}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
