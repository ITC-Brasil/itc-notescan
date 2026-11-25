# NoteScan — Pendências

> Atualizado em 25/11/2026 por Matheus Nobre. Os níveis de prioridade abaixo foram definidos por ele.

## P0 — Prioridade de resolução (bloqueia entrega do APK)

| # | Item | Diagnóstico / observações |
|---|---|---|
| 1 | ~~Telegram não envia notificações~~ | ✅ **Resolvido em 25/11.** Causa: o grupo foi convertido em supergrupo e o chat_id mudou (Telegram respondia 400 "group chat was upgraded to a supergroup chat"). Corrigido `TELEGRAM_CHAT_ID` no `.env` do servidor (backup em `.env.bak-20261125`; o arquivo pertence a `github-deploy`, editar com sudo sem mudar o dono). Envio de teste ok. Melhoria de código pendente na rodada do item 2: logar quando token/chat_id estão ausentes |
| 2 | Não é possível excluir notebook | **Causa confirmada:** `ConferenceItem.notebook` e `LifecycleEvent.notebook` sem `onDelete` (Restrict) → erro de FK vira 500 "Erro interno". O `bulk-delete` por UM tem o mesmo problema. **Decidido:** status `ARQUIVADO`; exclusão real só sem histórico; ao arquivar, hostname recebe sufixo `~arq-YYYYMMDD`; ao recadastrar um hostname arquivado, escolher entre "Reativar" (mesma máquina) e "Cadastrar como novo" |
| 3 | Rebuild do APK e entrega a todos os técnicos | Sobre **Capacitor 8 com release signing** (PR #43 em `develop`, ainda não na `main`) |

## P1 — O mais rápido possível

| # | Item | Estado |
|---|---|---|
| 4 | ~~Bump `next` + `source-map-js`~~ | ✅ Feito: next 16.4.1, source-map-js 1.2.2, `sec-05`, na `main`. Falta conferir se a regra WAF de `/_next/image` ainda é necessária |
| 5 | Branch protection da `main` | Pendente: "Require status checks to pass before merging" |
| 6 | Prune no `deploy.yml` | Parcial: já é `docker image prune -f`, mas sem filtro (atinge o host todo). Filtrar por label |
| 7 | `@capgo/capacitor-native-biometric` | ✅ Em `develop`: Capacitor 8 + biometric 8.8.3 (m7-11). Falta o merge na `main` + APK |
| 8 | Registrar o `docker-compose.yml` e o `.env` (só nomes) do NoteScan | Pendente: estão só no servidor. Registrar em `contexto-glpi-srv.md` |

## P2 — Simples, encaixar onde der

| # | Item | Observações |
|---|---|---|
| 9 | Tabela do dashboard admin | Badges COMPLETO/INCOMPLETO, Contagem (Ativos/Lidos), data com início/fim, colunas Localidade e Resumo |
| 10 | Texto do Telegram | Remover "(Esperados)" de "Dispositivos Ativos" em `src/app/api/conferences/route.ts` |
| 11 | Datas em UTC | Nome do CSV usa `toISOString()`; `timeZone` explícito na formatação server-side |

## Próxima funcionalidade — foco principal

| # | Item | Observações |
|---|---|---|
| 12 | Tokens de API + MCP para agentes | Fases 0 e 1 concluídas. Antes da Fase 2 (`feat/agent-tokens`): (a) role `AGENTE` imutável? (b) schema de criação aceita `AGENTE` com senha descartável e sem meta? Considerar o novo status `ARQUIVADO` nas tools de notebook |

## Quando possível

| # | Item | Observações |
|---|---|---|
| 16 | Modo offline completo (Dexie + cache de UMs/notebooks) | Prioridade baixa: carretas têm 3 APs, Starlink e 5G |

## Backlog

| # | Item | Estado do desenho |
|---|---|---|
| 13 | Troca de etiqueta QR (`NotebookLabel`) | Desenho fechado; falta decidir o motivo da troca. Compatível com o arquivamento por sufixo |
| 14 | Integração GLPI como fonte de dados | Opção B (sync assíncrono). Faltam: dono do Status, troca de hostname, ativo saindo do filtro |
| 15 | Conferência por caixa + contagem por IA (v2) | 22 decisões fechadas; falta decidir sobre o ambiente de staging |

## Sequência sugerida

1. ~~Item 1~~ ✅
2. Item 2 + 10 + log do Telegram (diagnóstico → aprovação → implementação)
3. PR `develop → main` (Capacitor 8 + correções) → deploy
4. Item 3: build release do APK e distribuição
5. Itens 5, 6, 8 (rápidos)
6. Item 12: fechar (a) e (b) e iniciar a Fase 2
