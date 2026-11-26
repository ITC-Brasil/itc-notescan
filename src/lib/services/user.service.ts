// E-mail sintético do AGENTE (m8-01): .invalid é reservado (RFC 2606) e nunca
// resolve. Colisão de slug → sufixo numérico.
export function agentSlug(nome: string): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "agente";
}

export function agentEmail(nome: string, taken: readonly string[]): string {
  const base = `agente-${agentSlug(nome)}`;
  const used = new Set(taken);
  let email = `${base}@notescan.invalid`;
  for (let n = 2; used.has(email); n++) email = `${base}-${n}@notescan.invalid`;
  return email;
}
