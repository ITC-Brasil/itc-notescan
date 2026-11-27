-- CreateTable
CREATE TABLE "ConferenceMeta" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "categoria" "NotebookCategoria" NOT NULL,
    "meta" INTEGER NOT NULL,

    CONSTRAINT "ConferenceMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConferenceMeta_conferenceId_categoria_key" ON "ConferenceMeta"("conferenceId", "categoria");

-- AddForeignKey
ALTER TABLE "ConferenceMeta" ADD CONSTRAINT "ConferenceMeta_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
