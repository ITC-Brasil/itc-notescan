-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'MASTER');

-- CreateEnum
CREATE TYPE "NotebookStatus" AS ENUM ('ATIVO', 'MANUTENCAO');

-- CreateEnum
CREATE TYPE "ConferenceStatus" AS ENUM ('CONCLUIDO_OK', 'CONCLUIDO_FALTANTES');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('ESCANEADO', 'FALTANTE', 'MANUTENCAO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "metaDiaria" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UM" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quantidadeEsperada" INTEGER NOT NULL,
    "perifericos" BOOLEAN NOT NULL DEFAULT false,
    "mouses" BOOLEAN NOT NULL DEFAULT false,
    "carregadores" BOOLEAN NOT NULL DEFAULT false,
    "fones" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notebook" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "serial" TEXT,
    "patrimonio" TEXT,
    "status" "NotebookStatus" NOT NULL DEFAULT 'ATIVO',
    "umId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notebook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "umId" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "localizacao" TEXT,
    "status" "ConferenceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConferenceItem" (
    "id" TEXT NOT NULL,
    "conferenceId" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL,

    CONSTRAINT "ConferenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifecycle_events" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lifecycle_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Notebook_hostname_key" ON "Notebook"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_key" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "UM" ADD CONSTRAINT "UM_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notebook" ADD CONSTRAINT "Notebook_umId_fkey" FOREIGN KEY ("umId") REFERENCES "UM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conference" ADD CONSTRAINT "Conference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conference" ADD CONSTRAINT "Conference_umId_fkey" FOREIGN KEY ("umId") REFERENCES "UM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceItem" ADD CONSTRAINT "ConferenceItem_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "Conference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConferenceItem" ADD CONSTRAINT "ConferenceItem_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lifecycle_events" ADD CONSTRAINT "lifecycle_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
