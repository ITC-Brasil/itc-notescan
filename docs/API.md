# API Routes — ITC NoteScan v2.0

Todas as rotas seguem o padrão: `auth()` → verificar role → Zod → lógica.
Respostas de erro comuns: 401 (não autenticado), 403 (role insuficiente), 400 (Zod inválido).

---

## Auth

### POST /api/auth/[...nextauth]
Autenticação: pública  
Handler do NextAuth.js. Gerencia login (`credentials`), logout e refresh de sessão.

---

## Conferences

### GET /api/conferences
Autenticação: qualquer sessão ativa (USER, ADMIN ou MASTER)  
Query: `userId`, `umId`, `status`, `from`, `to`, `limit` (máx 100, default 10), `offset` (default 0) — todos opcionais  
Resposta 200: `ConferenceWithRelations[]` (array direto)  
Lista conferências (Relatórios admin e histórico do técnico). Para `role === "USER"`
o filtro é **forçado** ao próprio `userId` (técnico só vê as suas). `offset` habilita
a paginação "Carregar mais" do `/inicio`.

### POST /api/conferences
Autenticação: sessão ativa (USER, ADMIN ou MASTER)  
Body: `{ umId, dataInicio, dataFim, localizacao?, status, mousesQtd?, carregadoresQtd?, fonesQtd?, items: { notebookId, status }[] }`  
Resposta 201: conferência criada  
Resposta 409: `{ code: "META_REACHED" }` — técnico atingiu `metaDiaria` no dia (bloqueio interativo)  
Cria conferência imutável, `ConferenceItem` por item e dispara notificação Telegram
(MarkdownV2 escapado). **Trava de meta diária:** conta as conferências do dia do
usuário e retorna 409 se ≥ `metaDiaria` — exceto quando a request traz o header
`X-Sync-Replay: 1` (replay da `syncQueue`, sempre aceito).

### GET /api/conferences/dashboard
Autenticação: ADMIN ou MASTER  
Resposta 200: `{ conferencesToday, activeTechnicians, notebooksTotal, notebooksInMaintenance, conferencesWithMissing, latestConferences[], maintenanceNotebooks[] }`  
Stats para o dashboard. Usado com polling de 30s via React Query.

---

## Notebooks

### GET /api/notebooks
Autenticação: sessão ativa  
Query: `umId` (obrigatório para técnicos, opcional para admin)  
Resposta 200: `{ notebooks: Notebook[] }`

### POST /api/notebooks
Autenticação: ADMIN ou MASTER  
Body: `{ hostname, serial?, patrimonio?, status, umId }`  
Resposta 201: `{ notebook: Notebook }`

### PUT /api/notebooks/[id]
Autenticação: ADMIN ou MASTER  
Body: `{ hostname, serial?, patrimonio?, status, umId }`  
Resposta 200: `{ notebook: Notebook }`  
Ao detectar mudança de status, cria `LifecycleEvent` automaticamente via `prisma.$transaction`.

### DELETE /api/notebooks/[id]
Autenticação: ADMIN ou MASTER  
Resposta 200: `{ ok: true }`

### GET /api/notebooks/[id]/history
Autenticação: ADMIN ou MASTER  
Resposta 200: `{ events: LifecycleEvent[] }`  
Retorna todos os `LifecycleEvent` do notebook em ordem cronológica reversa.

### POST /api/notebooks/batch
Autenticação: ADMIN ou MASTER  
Body: `{ prefix, count, umId }`  
Resposta 201: `{ created: number }`  
Cria notebooks em lote com numeração: `prefix + 01` a `prefix + count` (zero à esquerda para 1–9).

### POST /api/notebooks/bulk-delete
Autenticação: ADMIN ou MASTER  
Body: `{ umId }`  
Resposta 200: `{ deleted: number }`  
Exclui todos os notebooks de uma UM. Requer `ConfirmationDialog` no cliente.

### POST /api/notebooks/import
Autenticação: ADMIN ou MASTER  
Body: `FormData` com campo `file` (CSV) e `umId`  
Resposta 201: `{ created: number, skipped: number }`  
Importa notebooks via CSV. Pula hostnames duplicados.

---

## Projects

### GET /api/projects
Autenticação: sessão ativa  
Resposta 200: `{ projects: Project[] }`

### POST /api/projects
Autenticação: ADMIN ou MASTER  
Body: `{ nome, cor }` (cor = hex string)  
Resposta 201: `{ project: Project }`

### PUT /api/projects/[id]
Autenticação: ADMIN ou MASTER  
Body: `{ nome, cor }`  
Resposta 200: `{ project: Project }`

### DELETE /api/projects/[id]
Autenticação: ADMIN ou MASTER  
Resposta 200: `{ ok: true }`  
Resposta 409: projeto tem UMs associadas

---

## UMs

### GET /api/ums
Autenticação: sessão ativa  
Query: `projectId` (opcional)  
Resposta 200: `{ ums: UMWithProject[] }`

### POST /api/ums
Autenticação: ADMIN ou MASTER  
Body: `{ nome, projectId, quantidadeEsperada, perifericos, mouses, carregadores, fones }`  
Resposta 201: `{ um: UM }`

### PUT /api/ums/[id]
Autenticação: ADMIN ou MASTER  
Body: mesmos campos do POST  
Resposta 200: `{ um: UM }`

### DELETE /api/ums/[id]
Autenticação: ADMIN ou MASTER  
Resposta 200: `{ ok: true }`  
Resposta 409: UM tem notebooks associados

---

## Users

### GET /api/users
Autenticação: MASTER  
Resposta 200: `{ users: User[] }` (sem passwordHash)

### POST /api/users
Autenticação: MASTER  
Body: `{ nome, email, password, role, metaDiaria? }`  
Resposta 201: `{ user: User }`  
Hash com bcrypt rounds 12.

### PUT /api/users/[id]
Autenticação: MASTER  
Body: `{ nome, email, role, metaDiaria?, password? }`  
Resposta 200: `{ user: User }`

### DELETE /api/users/[id]
Autenticação: MASTER  
Resposta 200: `{ ok: true }`  
Resposta 403: auto-delete bloqueado (não pode deletar a si mesmo)

### PUT /api/users/change-password
Autenticação: sessão ativa  
Body: `{ currentPassword, newPassword }`  
Resposta 200: `{ ok: true }`  
Resposta 401: senha atual incorreta  
Verifica senha atual com `bcrypt.compare`, faz hash da nova com rounds 12.

---

## Notifications

### POST /api/notifications/subscribe
Autenticação: USER  
Body: `{ endpoint, p256dh, auth }`  
Resposta 200: `{ ok: true }`  
Upsert da assinatura VAPID do usuário (1 por usuário).

### DELETE /api/notifications/subscribe
Autenticação: USER  
Resposta 200: `{ ok: true }`  
Remove assinatura do usuário autenticado.

### POST /api/notifications/send
Autenticação: ADMIN ou MASTER  
Body: `{ title, body }`  
Resposta 200: `{ sent: number }`  
Broadcast para todos os usuários com assinatura ativa.

### POST /api/notifications/dispatch
Autenticação: ADMIN ou MASTER  
Body: `{ userIds: string[], title, body }`  
Resposta 200: `{ sent: number }`  
Envia push para usuários selecionados.
