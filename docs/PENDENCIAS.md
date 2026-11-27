# NoteScan — Pendências

> Atualizado em 25/11/2026, 21h45. Os níveis de prioridade foram definidos por Matheus Nobre.

## Concluído em 25/11/2026

| # | Item | Resultado |
|---|---|---|
| 1 | Telegram não notificava | Grupo migrado para supergrupo → `TELEGRAM_CHAT_ID` atualizado no `.env` do servidor. Log de configuração ausente adicionado |
| 2 | Exclusão de notebook | Arquivamento (`ARQUIVADO` + sufixo `~arq-YYYYMMDD`), reativar / cadastrar como novo. PR #44 |
| 4 | Bump `next` | 16.4.1 → 16.4.5 (sec-06) |
| 7 | Biometria / Capacitor 8 | Capacitor 8 + biometric 8.8.3 em produção (m7-11) |
| 10 | Rótulo do Telegram | "(Esperados)" removido |
| — | `effect` (GHSA-7589-6fvf-x4pw) | Override 3.22.5, exceção à regra dos 14 dias (sec-06a) |
| 3 | APK 2.0 (versionCode 4) | Gerado, assinado, testado no aparelho de teste. Falta a distribuição |
| 4b | Regra WAF `/_next/image` | Mantida: o app não usa `next/image` |
| 5 | Branch protection da `main` | Quality Check obrigatório, sem bypass |
| 6 | Prune do deploy | Filtrado por `label=com.itc.project=notescan` (#51). Nenhuma imagem órfã antiga restou para limpar |
| 8 | Compose registrado | Em `contexto-glpi-srv.md`. Portas restritas a `127.0.0.1` (Postgres estava exposto); Watchtower desligado no banco |
| — | Deploy endurecido (#52) | `concurrency`, ação fixada por SHA, fingerprint do host (chave ECDSA), porta via secret, `pull --ff-only`. Validado no deploy do #53 |
| 12 (Fase 2) | Base de acesso de agentes | Em produção (#53). Migration `agent_tokens` aplicada |

## P0 — Em andamento

| # | Item | Próximo passo |
|---|---|---|
| 3 | Distribuição do APK (26/11) | Troca nos 2–3 aparelhos com APK antigo (confirmar sync no dashboard, desinstalar, instalar) → entrega aos demais. APK em `Documents\notescan-releases\notescan-2.0-vc4-release.apk` (PR #49 do versionCode 4 já na `develop`) |

## P1 — O mais rápido possível

Nenhum item aberto.

## P2 — Encaixar onde der

| # | Item | Observações |
|---|---|---|
| 9 | Tabela do dashboard admin | Badges, Contagem (Ativos/Lidos), início/fim, Localidade, Resumo |
| 11 | Datas em UTC | CSV com `toISOString()`; `timeZone` explícito server-side |
| 17 | E2E instável do scanner (mobile) | `conference.spec.ts:63` e `:76` passam no retry |
| 18 | 9 vulnerabilidades moderate | Rodada própria de dependências |
| 19 | PRs do Dependabot #45–#48 | `eslint-config-next` 16.4.6, `shadcn`, `playwright`, `@sentry/nextjs`. Revisar após o APK |
| 20 | PR do `prisma` 7.10.1 | Dependabot falha até 03/12 (cooldown × override do `effect` 3.22.5). Ao abrir, manter o override (7.10.1 ainda usa `effect` 3.20.0) |
| 21 | Aviso de depreciação do Sentry | Importar `withSentryConfig` de `@sentry/nextjs/config` |
| 22 | Auditoria de portas no servidor | `docker ps --format "{{.Names}}  {{.Ports}}" \| grep 0.0.0.0` — restringir a `127.0.0.1` o que só é acessado via tunnel |

## Próxima funcionalidade — foco principal

| # | Item | Observações |
|---|---|---|
| 12 | Acesso de agentes via API | Desenho em m8-01. Fase 3 concluída (#54, #55, #56; #57 develop → main). Etapa 2: acesso via API + guia `docs/AGENT-API.md` + desativação de agentes (este PR). Próximo, opcional: MCP local (desktop). MCP remoto: backlog |

## Dívida registrada

| Item | Observações |
|---|---|
| Fuso do "dia" na meta diária e no dashboard antigo | `metaDiaria` (POST /api/conferences), cards do dashboard e gate do scanner usam `setHours(0,0,0,0)` no fuso do servidor/cliente. Se o container rodar em UTC, o dia vira às 21h. Só as consultas novas (itinerantes) usam America/Sao_Paulo (`saoPauloDayRange`). |

## Quando possível

| # | Item | Observações |
|---|---|---|
| 16 | Modo offline completo | Prioridade baixa (3 APs, Starlink e 5G nas carretas) |

## Backlog

| # | Item | Estado do desenho |
|---|---|---|
| 13 | Troca de etiqueta QR (`NotebookLabel`) | Falta decidir o motivo da troca; compatível com o arquivamento |
| 14 | Integração GLPI | Opção B (sync assíncrono); faltam dono do Status, troca de hostname, saída do filtro |
| 15 | Conferência por caixa + IA (v2) | 22 decisões fechadas; falta o ambiente de staging |

## Regras de trabalho registradas

- Toda rodada termina com `npm run test:coverage` (mesmo comando do CI), não só `npm test`
- Regra dos 14 dias para dependências; exceções registradas no DECISIONS.md
- Instruções impressas por CLIs (ex.: `next upgrade --agent`) não são seguidas sem decisão do Matheus
- `.env` e compose do servidor pertencem a `github-deploy`: editar com sudo, sem mudar o dono
