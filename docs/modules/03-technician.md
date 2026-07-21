# Módulo 3 — Fluxo do Técnico (Mobile)

**Data de conclusão:** 2026-06-22

---

## O que foi implementado

### `hooks/useConference.ts` — Máquina de estados
State machine com `useReducer`. Estados:

```
idle → scanning → summary → saving → done
             ↓
          (error)
```

- `idle`: aguardando seleção de UM
- `scanning`: câmera ativa, listas pendentes/escaneados em tempo real
- `summary`: tela de resumo antes de confirmar
- `saving`: enviando para a API (ou salvando offline)
- `done`: conferência finalizada

Transições de scan:
- Leitura válida: move notebook de `pending` para `scanned`
- Duplicado: `state.error = "já foi escaneado"`
- Outra UM: `state.error = "não pertence a esta UM"`
- Em manutenção: registrado como `MANUTENCAO`, não conta como faltante

### Página `/inicio`
- Cards diários: total de conferências, OK, com faltantes
- Indicador online/offline (Geolocation API)
- Botão "Iniciar Conferência" com `sm:hidden` — invisível em desktop (≥ 640px)
- Histórico pessoal com tabela de últimas conferências do técnico autenticado
- Colunas da tabela de histórico: data, UM, projeto, status, itens escaneados/total, ações (ver detalhes)

### Página `/scanner` — Fluxo completo

**Fase 1 — Seleção de UM:**
- Combobox com todas as UMs ativas
- Card de informações da UM (projeto, cor, quantidade esperada, periféricos)

**Fase 2 — Scanning:**
- `QRScanner.tsx`: câmera com viewfinder overlay (cantos animados + linha de scan)
- Listas side-by-side: Pendentes | Escaneados
- Feedback imediato: toast verde/vermelho a cada scan
- Botão Reiniciar (volta ao estado inicial do scan) e Próximo

**Fase 3 — Periféricos:**
- Exibida apenas se a UM tem periféricos configurados (`mouses || carregadores || fones`)
- Steppers de quantidade com **input numérico editável** entre os botões +/− (digitar direto p/ volumes grandes), com ícones por tipo (Mouse, BatteryCharging, Headphones)

**Fase 4 — Resumo:**
- Cards: escaneados, faltantes, manutenção
- Lista de notebooks faltantes com hostname
- Localização via `navigator.geolocation`
- Botão "Concluir e Enviar" — chama `useConference.finalize()`

**Fase 5 — Envio:**
- Online → `POST /api/conferences`
- Offline → `saveToOutbox(Dexie)` + retry automático via background sync

### `components/scanner/QRScanner.tsx`
- Import dinâmico de `@yudiel/react-qr-scanner` (tree-shaking)
- Viewfinder com 4 cantos CSS e linha animada
- Fallback de erro se câmera não disponível
- Detecção de plataforma via `usePlatform()` — no Android APK, delega para `NativeQRScanner`

### Suporte offline
- `saveToOutbox`: persiste conferência no Dexie com status `pending`
- `processOutbox`: tenta sincronizar todas as conferências pendentes
- Retry: 1min → 5min → 15min (backoff exponencial)
- Background sync via Service Worker: `processOutbox` chamado quando connection retorna

---

## Verificação executada

- Fluxo completo no browser mobile: seleção UM → scan → periféricos → resumo → envio
- Scan duplicado: toast de erro imediato
- Scan de outra UM: mensagem específica
- Notebook em manutenção: registrado corretamente, não conta como faltante
- Conferência com faltantes: status `CONCLUIDO_FALTANTES`, LifecycleEvents criados
- Conferência OK: status `CONCLUIDO_OK`
- Notificação Telegram enviada após `POST /api/conferences`
- Fluxo offline: conferência salva no Dexie e enviada quando connection retorna
- Botão "Iniciar" invisível em desktop (testado em viewport 1024px)
- Histórico pessoal mostrando apenas conferências do técnico logado

---

## Atualizações posteriores (2026-07)

- **Trava de meta diária:** o botão "Iniciar" (início e seleção de UM) é bloqueado
  quando o técnico atinge `metaDiaria`; o servidor confirma com 409. Ver DECISIONS [m3-01](../DECISIONS.md).
- **Paginação do histórico:** "Carregar mais" via `useInfiniteConferences` (offset). [m3-03](../DECISIONS.md).
- **Botão voltar** nas fases de periféricos e resumo (mesmo dialog de confirmação do scanner).
- **Resumo componentizado** em `<ConferenceSummary>`, reutilizado pelo resumo ao vivo e pelo modal do histórico, com ícones consistentes.
- **APK:** leitura de QR em lote (ML Kit), botão de flash, retomada da câmera e bloqueio biométrico — ver [módulo 7](07-capacitor-apk.md).
- **Máquina de estados** agora inclui as fases `peripherals` e o estado `blocked` (meta atingida) além de `idle → scanning → summary → saving → done`.

---

## Decisões

- `sm:hidden` no botão Iniciar: regra de negócio — técnicos não devem iniciar conferências em desktop
- Import dinâmico do QR Scanner: reduz bundle inicial
- `useReducer` em vez de `useState` múltiplos: estado da conferência é um conjunto coerente, reducer garante transições válidas
- Periféricos opcionais: tela só aparece se a UM tem ao menos um periférico ativo

---

## Pontos de atenção

- `useConference.finalize()` chama diretamente `POST /api/conferences` — nunca chamar outra rota para criar conferência
- Conferências são imutáveis após criação — não existe fluxo de edição
- A localização é `null` se o usuário negar permissão de geolocalização — aceito
- O sync offline não tem garantia de ordem relativa entre conferências diferentes (apenas a fila FIFO por conferência)

---

## Commits

```
9960f8f fix: split auth config for Edge runtime compatibility, fix middleware config re-export
8cfa556 feat(m3): add technician mobile flow - inicio page, scanner with offline support, QR scanner component
ddc46e8 chore: remove redundant src/middleware.ts — proxy.ts handles routing directly
d2bffd0 feat(resumo): update summary screen with full data and CONCLUIR E ENVIAR
48b9386 feat(scanner): add Reiniciar button and rename Finalizar to Próximo
560ec90 feat(scanner): update UM selection — larger elements and correct info card
3aad7e9 feat(inicio): make INICIAR CONFERÊNCIA button more prominent
f2737cf feat(inicio): update history table with new columns and action modals
8598ceb feat(perifericos): add peripherals screen and conference data model
a8e22b5 feat(telegram): redesign notification with new format and full data
```
