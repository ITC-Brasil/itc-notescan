-- CreateEnum
CREATE TYPE "UMTipo" AS ENUM ('FIXA', 'ITINERANTE');

-- CreateEnum
CREATE TYPE "NotebookCategoria" AS ENUM ('INSTRUTOR', 'PEDAGOGA', 'COORDENADORA');

-- AlterTable
ALTER TABLE "Conference" ADD COLUMN     "umFisicaId" TEXT;

-- AlterTable
ALTER TABLE "Notebook" ADD COLUMN     "categoria" "NotebookCategoria";

-- AlterTable
ALTER TABLE "UM" ADD COLUMN     "tipo" "UMTipo" NOT NULL DEFAULT 'FIXA';

-- CreateTable
CREATE TABLE "UMMetaCategoria" (
    "id" TEXT NOT NULL,
    "umId" TEXT NOT NULL,
    "categoria" "NotebookCategoria" NOT NULL,
    "meta" INTEGER NOT NULL,

    CONSTRAINT "UMMetaCategoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UMMetaCategoria_umId_categoria_key" ON "UMMetaCategoria"("umId", "categoria");

-- CreateIndex
CREATE INDEX "Conference_umId_dataInicio_idx" ON "Conference"("umId", "dataInicio");

-- AddForeignKey
ALTER TABLE "UMMetaCategoria" ADD CONSTRAINT "UMMetaCategoria_umId_fkey" FOREIGN KEY ("umId") REFERENCES "UM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conference" ADD CONSTRAINT "Conference_umFisicaId_fkey" FOREIGN KEY ("umFisicaId") REFERENCES "UM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
