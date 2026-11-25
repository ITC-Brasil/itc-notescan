# NoteScan — Pendências

> Atualizado em 25/11/2026 (fim do dia). Os níveis de prioridade foram definidos por Matheus Nobre.

## Concluído em 25/11/2026

| # | Item | Resultado |
|---|---|---|
| 1 | Telegram não notificava | Grupo migrado para supergrupo → `TELEGRAM_CHAT_ID` atualizado no `.env` do servidor. Log de configuração ausente adicionado |
| 2 | Exclusão de notebook | Arquivamento (`ARQUIVADO` + sufixo `~arq-YYYYMMDD`), reativar / cadastrar como novo. PR #44 |
| 4 | Bump `next` | 16.4.1 → 16.4.5 (sec-06) |
| 7 | Biometria / Capacitor 8 | Capacitor 8 + biometric 8.8.3 em produção (m7-11) |
| 10 | Rótulo do Telegram | "(Esperados)" removido |
| — | `effect` (GHSA-7589-6fvf-x4pw) | Override 3.22.5, exceção à regra dos 14 dias (sec-06a) |
| 3 | APK 2.0 (versionCode 4) | Gerado, assinatura conferida, instalado no aparelho de teste. Falta teste manual e distribuição |

## P0 — Em andamento

| # | Item | Próximo passo |
|---|---|---|
| 3 | Distribuição do APK | Teste manual no aparelho → troca nos 2–3 aparelhos com APK antigo (confirmar sync no dashboard, desinstalar, instalar) → entrega aos demais. APK em `Documents\notescan-releases\notescan-2.0-vc4-release.apk`. Merge do PR #49 (versionCode 4) na `develop` |

## P1 — O mais rápido possível

| # | Item | Estado |
|---|---|---|
| 4b | Regra WAF em `/_next/image` | Avaliar remoção com next 16.4.5 em produção |
| 5 | Branch protection da `main` | Ativar "Require status checks to pass before merging" |
| 6 | Prune no `deploy.yml` | `docker image prune -f` sem filtro: filtrar por label |
| 8 | Registrar `docker-compose.yml` e nomes do `.env` | Em `contexto-glpi-srv.md` (arquivos são de `github-deploy`; editar com sudo) |

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

## Próxima funcionalidade — foco principal

| # | Item | Observações |
|---|---|---|
| 12 | Tokens de API + MCP para agentes | Desenho registrado em m8-01. Fase 2 (schema, `resolveActor`, `requireScope`, rate limit por ator) em `feat/agent-tokens`. Decidido: `AGENTE` imutável, sem senha (`passwordHash` opcional), sem meta. Depois: Fase 3 (migração das rotas), Fase 4 (UI de tokens), Fase 5 (MCP) |

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
