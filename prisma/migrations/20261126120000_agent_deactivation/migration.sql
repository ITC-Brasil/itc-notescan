-- m8-01 Etapa 2: desativação de agentes (null = ativo). Só usado para AGENTE.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "desativadoEm" TIMESTAMP(3);
