# Módulo 2 — Interface Admin

**Data de conclusão:** 2026-06-22

---

## O que foi implementado

### Dashboard (`/dashboard`)
- 4 `StatCard`: Total de Conferências, Conferências OK, Com Faltantes, Notebooks Cadastrados
- Tabela das últimas 10 conferências via `DataTable` com `pageSize={10}`
- Polling automático a cada 30s via React Query (`refetchInterval: 30000`)
- `useDashboard.ts` + `GET /api/conferences/dashboard`
- `conference.service.ts`: `getDashboardStats` com queries Prisma aggregadas

### Relatórios (`/relatorios`)
- Histórico completo de conferências com `pageSize={20}`
- 5 filtros combinados: Técnico, Projeto, UM, Status, DateRange
- `ComboboxFilter` com `Command + Popover` para busca por texto
- `DateRangeFilter` com `Calendar mode="range"` (react-day-picker v9)
- Exportação CSV com BOM UTF-8 para compatibilidade com Excel
- `useConferences.ts` + `GET /api/conferences` com query params

### Projetos (`/projetos`)
- CRUD completo com modal de criação/edição
- Seletor de cor: input nativo `<input type="color">` + campo hex manual
- Guard de exclusão: verifica se projeto tem UMs antes de deletar (409)
- `useProjects.ts` + `GET/POST/PUT/DELETE /api/projects`

### UMs (`/ums`)
- CRUD agrupado por projeto (accordion por cor do projeto)
- Configuração de periféricos: Mouses, Carregadores, Fones (grid de 3 colunas)
- Guard de exclusão: verifica se UM tem notebooks (409)
- `useUMs.ts` + `GET/POST/PUT/DELETE /api/ums`

### Notebooks (`/notebooks`)
- Hierarquia colapsável 2 níveis: Projeto → UM → Notebooks
- Ordenação natural (`localeCompare` com `{ numeric: true }`) — `EST9` antes de `EST10`
- CRUD individual com modal
- Criação em lote: `prefix + count` com numeração formatada (zero à esquerda para 1–9)
- Importação CSV com `UMCombobox` e botão "Baixar modelo"
- Histórico por notebook: `HistoryModal` com timeline de `LifecycleEvents`
- Toggle de status ATIVO/MANUTENCAO com criação automática de `LifecycleEvent`
- Exclusão em lote por UM (`bulk-delete`)
- `useNotebooks.ts` + rotas `/api/notebooks/*`

### Notificações (`/notificacoes`)
- Envio de push para todos os técnicos ou selecionados
- `useNotifications.ts` + `POST /api/notifications/send|dispatch`

### Usuários (`/usuarios`)
- CRUD completo com modal (exclusivo MASTER)
- Campo `metaDiaria` visível apenas quando `role === 'USER'`
- Guard self-delete: não pode deletar o próprio usuário logado
- Troca de senha: `PUT /api/users/change-password` com verificação da senha atual
- `useUsers.ts` + `GET/POST/PUT/DELETE /api/users`

---

## Verificação executada

- CRUD de todas as entidades testado no browser
- Filtros do relatório combinados (técnico + projeto + UM + status + data range)
- Exportação CSV aberta no Excel: caracteres especiais corretos com BOM
- Criação em lote: `BSBIA01-EST` de 1 a 106 → hostnames corretos
- Importação CSV: pulo de duplicatas verificado
- Guard de exclusão: projeto com UMs retorna 409

---

## Decisões

- `ComboboxFilter` com `Command` em vez de `<select>` nativo: necessário para busca por texto e opção de limpar seleção
- `key={editingProject?.id ?? "new"}` nos dialogs de edição: força remount e garante `defaultValues` atualizados
- BOM UTF-8 no CSV: `﻿` no início para compatibilidade com Excel sem configuração adicional

---

## Pontos de atenção

- `DateRangeFilter` usa `react-day-picker@v9` — não usar prop `initialFocus` (foi removida nessa versão)
- Filtro de Projeto cascateia o filtro de UM no Relatórios
- `LifecycleEvent` é criado automaticamente no `PUT /api/notebooks/[id]` ao detectar mudança de `status` — via `prisma.$transaction`

---

## Commits

```
7258fcf feat(m2): add dashboard page with stats cards and latest conferences table with 30s polling
bfa8875 feat(m2): add projetos CRUD page with color picker hex preview and delete guard
3530fe5 feat(m2): add ums CRUD page grouped by project with peripherals config and delete guard
7fa3068 feat(m2): add notebooks CRUD with batch creation and CSV import
e020d9a feat(m2): add relatorios page with filters and CSV export, users and conferences hooks
893a47e feat(m2): add push notifications send/dispatch API routes and notificacoes admin page
9b143ae feat(m2): add usuarios page with full CRUD, role selection, and self-delete guard (MASTER only)
3f8efa8 feat(dashboard): padronizar ícones, card notebooks e modal manutenção
46cd59c feat(relatorios): DatePicker Range e Comboboxes com busca por texto
340ad4f fix(projetos): remover hex do card e corrigir modal de edição pré-preenchido
9e378f1 fix(ums): remover Periféricos, Checkbox shadcn e modal de edição pré-preenchido
f5c7fa0 feat(notebooks): hierarquia colapsável, histórico, filtros e ordenação natural
2aac5a0 fix(usuarios): exibir metaDiaria apenas quando role for USER
54c847c feat(geral): sidebar shadcn, next-themes, transições de página e fundo off-white
1ee8a0a fix(ums): corrigir overflow de checkboxes no grid de periféricos
d303b00 feat(notebooks): badges de status, cor do ícone e histórico de ciclo de vida
c96c54d fix(usuarios): ocultar Meta diária para perfis ADMIN e MASTER
9f49490 fix(theme): toggle dark/light simples e fundo off-white mais contrastado
3c4fa81 feat(perfil): modal 'Alterar senha' no menu de perfil da sidebar
66b0dfe feat(geral): transições de página suaves via fadeInUp
02d6279 fix: corrigir 5 bugs de layout, acessibilidade e visual
263ad4d fix: corrigir background do main, modal UMs e badge Ativo
8361031 fix: corrigir ClientFetchError do NextAuth e fundo branco do main
3c7915c style: calibrar tons de creme do modo claro (main, cards, sidebar)
```
