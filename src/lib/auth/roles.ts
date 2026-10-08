// Fonte única das roles humanas (login interativo, páginas, autorização).
// Tipo definido aqui, não derivado de @/generated/prisma, para não puxar o
// client Prisma para o bundle do navegador (hooks e páginas importam isto).
export const HUMAN_ROLES = ["USER", "ADMIN", "MASTER"] as const;

export type HumanRole = (typeof HUMAN_ROLES)[number];

export function isHumanRole(role: unknown): role is HumanRole {
  return typeof role === "string" && (HUMAN_ROLES as readonly string[]).includes(role);
}
