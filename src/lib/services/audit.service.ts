import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import type { prisma } from "@/lib/db/prisma";

// Basta o delegate: serve ao prisma e ao tx da transação interativa.
export type Tx = Pick<typeof prisma, "auditLog">;

// m8-01: trilha de escritas em entidades sem LifecycleEvent. Sempre dentro da
// transação da escrita, para não haver escrita sem registro.
export function audit(
  tx: Tx,
  actor: Actor,
  entry: { entidade: string; entidadeId: string; acao: string; payload?: Prisma.InputJsonValue },
) {
  return tx.auditLog.create({
    data: {
      ...entry,
      actorId: actor.userId,
      tokenId: actor.kind === "token" ? actor.tokenId : null,
    },
  });
}
