-- Rede de segurança contra leitura dupla: um notebook aparece no máximo uma vez
-- por conferência. Se houver duplicatas pré-existentes, este índice falha ao
-- aplicar — nesse caso, limpar os dados ANTES (ver relatório da correção).

-- CreateIndex
CREATE UNIQUE INDEX "ConferenceItem_conferenceId_notebookId_key" ON "ConferenceItem"("conferenceId", "notebookId");
