# Decisões Técnicas — ITC NoteScan v2.0

Registro das decisões técnicas relevantes tomadas ao longo do projeto.
Documentadas para evitar re-análise futura e orientar manutenção.

---

## m1-01 — Prisma 7 com driver adapter e prisma.config.ts

**Contexto:** O Prisma 7 mudou o gerador de `prisma-client-js` para `prisma-client`
e exige um driver adapter explícito. A URL do banco saiu do `datasource` do
`schema.prisma` e foi para `prisma.config.ts`.

**Alternativas consideradas:**
- Continuar com Prisma 6 (rejeitado: ficaria desatualizado rápido)
- Usar Prisma 7 sem adapter (impossível: `new PrismaClient()` lança erro)

**Justificativa:** Prisma 7 é a versão atual estável. O adapter `@prisma/adapter-pg`
é a combinação recomendada para PostgreSQL.

**Consequências:**
- A pasta `src/generated/` está no `.gitignore` — rodar `npx prisma generate` após clone
- O `prisma.config.ts` precisa estar no runner do Dockerfile (senão: `datasource.url property is required`)
- `node_modules` completo precisa ser copiado no Dockerfile (inclui `effect`, dependência transitiva do `@prisma/config`)

---

## m1-02 — @serwist/next substituindo @ducanh2912/next-pwa

**Contexto:** `@ducanh2912/next-pwa` é um fork do `next-pwa` original, mantido
informalmente. Versões recentes do Next.js (15+) tiveram incompatibilidades.

**Alternativas consideradas:**
- `@ducanh2912/next-pwa` (rejeitado: manutenção incerta, incompatibilidades com Next.js 16)
- `@serwist/next` (escolhido: fork ativo, API compatível, suporte oficial a Next.js 15+)

**Justificativa:** `@serwist/next` é o sucessor natural com suporte ativo e API
quase idêntica. A migração foi mínima.

**Consequências:** `skipWaiting: false` é crítico — nunca alterar. Evita que o SW
se ative durante sessão ativa, o que serviria assets de versões misturadas.

---

## m1-03 — Fundo do admin-main via hex literal em vez de var(--background)

**Contexto:** O `<main>` renderizado pelo `SidebarInset` ficava com fundo branco
em modo claro. Todas as tentativas via `var(--background)` falharam porque a
variável CSS não resolvia no contexto do `SidebarProvider` (retornava vazio →
transparente → branco do canvas).

**Alternativas consideradas:**
- `style={{ backgroundColor: 'var(--background)' }}` inline (falhou)
- Classe Tailwind `bg-background` (falhou pelo mesmo motivo)
- Regra CSS layered (perderia para o layer utilities do Tailwind)

**Justificativa:** Regra não-layered `.admin-main { background-color: #F5EFE6 }`
em `globals.css` vence qualquer layer do Tailwind sem depender de variáveis CSS.
Valores das variáveis CSS ficaram intactos — apenas a aplicação ao `<main>` usa hex.

**Consequências:** Se o tema mudar, atualizar os valores hex em `.admin-main` e
`.dark .admin-main` em `globals.css`.

---

## m1-04 — proxy.ts com matcher explícito em vez de regex de exclusão

**Contexto:** O middleware original usava um matcher com lookahead negativo para
excluir `/api`, `_next/*`, etc. Isso causava um bug: o middleware rodava em
`/api/auth/*`, interceptava requests sem sessão e devolvia HTML (a página de
login) em vez de JSON. O `SessionProvider` no cliente tentava `JSON.parse(html)`
e lançava `ClientFetchError`.

**Alternativas consideradas:**
- Manter regex de exclusão e corrigir o if de sessão nas API routes (rejeitado: bandaid)
- Lista explícita de rotas protegidas (escolhido)

**Justificativa:** O matcher explícito é mais legível, previsível e elimina a
classe de erros de regex que "exclui quase tudo". API routes fazem sua própria
verificação via `auth()`.

**Consequências:** Ao adicionar novas rotas protegidas (grupos de route), lembrar
de adicionar ao matcher no `proxy.ts`.

---

## m4-01 — node_modules completo no runner do Dockerfile

**Contexto:** O output `standalone` do Next.js copia apenas as dependências de
runtime necessárias, mas o Prisma 7 e suas dependências transitivas (`effect`,
`@prisma/config`) não eram incluídas automaticamente.

**Alternativas consideradas:**
- Confiar no standalone (falhou: `Cannot find module 'effect'`)
- Copiar apenas `src/generated` (insuficiente)
- Copiar `node_modules` completo do estágio deps (escolhido)

**Justificativa:** A cópia completa do `node_modules` é a solução mais segura
para Prisma 7 com suas dependências não-triviais. Aumenta o tamanho da imagem
mas garante funcionamento sem surpresas.

**Consequências:** Imagem Docker maior (~800MB vs ~400MB com standalone puro).
Trade-off aceito para estabilidade.

---

## m4-02 — prisma.config.ts no runner do Dockerfile

**Contexto:** O `prisma.config.ts` fica na raiz do projeto e é lido pelo CLI
do Prisma durante `migrate deploy` no entrypoint. O estágio runner do Dockerfile
não tinha este arquivo e o Prisma falhava com `datasource.url property is required`.

**Justificativa:** Arquivo explicitamente copiado no runner via `COPY prisma.config.ts ./`.

**Consequências:** Qualquer mudança no `prisma.config.ts` exige rebuild da imagem.

---

## m7-01 — @capacitor-community/barcode-scanner v4 com Capacitor v5

> ⚠️ **Superada em 2026-07 por [m7-05](#m7-05).** O projeto migrou para Capacitor 7
> + `@capacitor-mlkit/barcode-scanning`. O texto abaixo é mantido como registro histórico.

**Contexto:** O Capacitor v5 foi escolhido por ser a versão estável LTS. A v6
tem breaking changes e menor ecossistema de plugins.

**Alternativas consideradas:**
- Capacitor v6 + barcode-scanner v5 (rejeitado: instabilidade, menos suporte)
- Capacitor v5 + barcode-scanner v4.0.1 (escolhido)
- @zxing/library no WebView nativo (rejeitado: não abre câmera nativa real no APK)

**Justificativa:** `@capacitor-community/barcode-scanner@4.0.1` é a versão
compatível com `@capacitor/core@5.7.8`. A combinação foi testada e validada em APK.

**Consequências:** Ao atualizar Capacitor, verificar compatibilidade do barcode-scanner.
A v5 do plugin exige Capacitor v6.

---

## m7-02 — Layout do scanner em zonas com transparência seletiva do WebView

> ℹ️ **Atualização 2026-07:** o mecanismo continua válido (split-screen por
> transparência), mas agora sobre o `@capacitor-mlkit/barcode-scanning`, que cria
> sua própria `PreviewView`. Ver [m7-05](#m7-05).

**Contexto:** O `@capacitor-community/barcode-scanner` coloca a câmera como uma
`BarcodeView` nativa full-screen atrás do WebView. Não existe API para redimensionar
ou reposicionar a câmera. A câmera aparece apenas onde o WebView tem pixels
transparentes.

**Alternativas consideradas:**
- `box-shadow` spotlight na área da câmera (rejeitado: ocultava as listas)
- Câmera separada em tela dedicada sem listas (rejeitado: UX ruim para técnicos de campo)
- Split-screen por zonas de transparência (escolhido)

**Justificativa:** A solução split-screen divide a tela verticalmente: zona superior
transparente (câmera visível) e zona inferior com fundo opaco (listas visíveis,
câmera bloqueada). Permite ver câmera e listas simultaneamente.

**Consequências:**
- Altura da zona da câmera (260px) é fixa — ajustar se necessário em dispositivos pequenos
- Elementos na zona transparente NÃO podem ter background opaco (ocultariam a câmera)
- O CSS `body.scanner-active` esconde header/nav e torna wrappers do layout transparentes

---

## m7-03 — CapacitorHttp: false para preservar cookie jar do NextAuth

**Contexto:** Quando `CapacitorHttp` está habilitado, o `fetch()` usa a stack HTTP
nativa do Android com um cookie jar separado do WebView. O cookie de sessão
definido no login (via WebView) não fica visível nas requisições fetch subsequentes,
derrubando a autenticação.

**Justificativa:** Desabilitando `CapacitorHttp`, o fetch permanece no WebView e
compartilha o mesmo cookie jar — o cookie de sessão do NextAuth funciona normalmente.

**Consequências:** Sem otimizações de rede nativas do Android. Trade-off aceito
pois as requests são pequenas e a autenticação é crítica.

---

## m7-04 — prepare() removido antes do startScanning()

> ⚠️ **Obsoleta desde 2026-07.** Específica do `@capacitor-community/barcode-scanner`,
> que não é mais usado. O `@capacitor-mlkit/barcode-scanning` usa `startScan()` +
> listener `barcodesScanned`; não há `prepare()`/`startScanning()`. Registro histórico.

**Contexto:** Chamar `BarcodeScanner.prepare()` antes de `startScanning()` definia
`didRunCameraPrepare = true` internamente. Isso fazia o `scan()` (chamado dentro
de `startScanning`) pular o caminho `_prepare(savedCall)` que corretamente registra
o callback `keepAlive`. O resultado: câmera abria mas nenhum QR Code era detectado.

**Justificativa:** `startScanning()` já chama `_prepare` internamente pela rota
correta. Chamar `prepare()` explicitamente interfere nesse mecanismo.

**Consequências:** Não chamar `prepare()` antes de `startScanning()`. Se for
necessário pré-aquecer a câmera, investigar a versão v5 do plugin.

---

## m7-05 — Migração para Capacitor 7 + @capacitor-mlkit/barcode-scanning (leitura em lote)

**Contexto:** O requisito central do scanner é conferir ~106 notebooks lendo
vários QR simultaneamente. O `@capacitor-community/barcode-scanner@4` (Cap 5)
analisava frames a 640×480 e lia um código por vez, de forma errática.

**Alternativas consideradas:**
- Manter Cap 5 + community scanner (rejeitado: sem leitura em lote confiável)
- Capacitor 7 + `@capacitor-mlkit/barcode-scanning@7.5` (escolhido)

**Justificativa:** O plugin ML Kit expõe o evento `barcodesScanned` (todos os
códigos de um frame) e a opção `resolution: 1920x1080`, tornando vários QR
pequenos legíveis no mesmo frame. Exige Capacitor ≥ 6, então foi feita a migração
completa 5→7 (`cap migrate` nos dois saltos).

**Consequências:**
- Build do APK exige **JDK 21** (JBR do Android Studio); Gradle 8.11.1, AGP 8.7.2.
- ~~`android/build.gradle`, `variables.gradle` e o wrapper são gitignored — mudanças de Gradle valem só localmente.~~ **Corrigido (2026-07-30):** não vale mais — o projeto nativo `android/` inteiro passou a ser versionado (ver [m7-09](#m7-09--splash-adaptativa-via-capacitorsplash-screen-e-projeto-android-versionado)).
- O override `bridge_layout_main.xml` deixou de ser necessário (o plugin cria sua própria `PreviewView`); mantido como cópia do layout stock do Capacitor 7.
- Torch (flash) disponível via `isTorchAvailable()`/`toggleTorch()`.
- Supera [m7-01](#m7-01) e a parte de mecanismo de [m7-04](#m7-04).

---

## m7-06 — Página offline nativa via server.errorPath

**Contexto:** O APK roda de `server.url` remoto. Sem rede, o WebView exibia a
página de erro nativa do Android (`net::ERR_INTERNET_DISCONNECTED`).

**Justificativa:** `webDir` aponta para `capacitor-shell/` (versionado) contendo
`offline.html`, e `server.errorPath: 'offline.html'` faz o Capacitor exibir essa
página temática (com auto-reload ao voltar a conexão) em vez do erro nativo.

**Consequências:** O `offline.html` é um HTML estático sem plugins Capacitor.
Não torna o app funcional offline (o shell remoto ainda não carrega sem rede) —
apenas melhora a tela de erro.

---

## m7-07 — Retomada da câmera ao voltar do background

**Contexto:** Ao mandar o app para segundo plano, o Android libera a câmera; ao
voltar, o preview ficava congelado (o efeito do `NativeQRScanner` só dependia de
`isActive`).

**Justificativa:** Um listener de `visibilitychange` reinicia o scan quando o app
volta ao foreground — sem dependência nova (`@capacitor/app` não é necessário). O
estado escaneado vive no `useConference` (pai) e não se perde no restart da câmera.

**Consequências:** Se o Android *matar* o processo por memória, o estado em
andamento se perde (persistir conferência em andamento seria escopo à parte).

---

## m7-08 — Persistência de sessão no WebView (cookie flush + sem revalidação no foco)

**Contexto:** O app pedia login ao retornar do multitarefas, apesar do `maxAge`
de 7 dias. O cookie do Auth.js é persistente por design (Expires ≈ +7 dias), mas
o WebView do Android mantém cookies em memória e faz flush em horário imprevisível;
um kill de processo em background podia descartá-los.

**Justificativa (camadas):**
- **Nativo:** `MainActivity` faz `CookieManager.setAcceptCookie(true)` no `onCreate`
  e `flush()` em `onPause` e `onStop` — garante o cookie em disco antes do kill.
- **Cliente:** `SessionProvider` com `refetchOnWindowFocus={false}` e
  `refetchWhenOffline={false}` (não revalida a cada resume); `AuthGuard` só
  redireciona para login em `status === "unauthenticated"` confirmado, nunca em
  estado transitório.

**Consequências:** A sessão não é revalidada no foco; o servidor (`proxy.ts` e
`auth()` nas rotas) continua validando cada request, então não há perda de
segurança. Requer rebuild do APK para a parte nativa.

---

## m3-01 — Trava de meta diária no servidor, isentando a syncQueue

**Contexto:** O limite `metaDiaria` por técnico não era aplicado — só exibido.

**Justificativa:** O `POST /api/conferences` conta as conferências do dia do
usuário (`CONCLUIDO_OK` + `CONCLUIDO_FALTANTES`) e retorna **409** quando atinge a
meta. O cliente também bloqueia o botão "Iniciar". Conferências reenviadas pela
`syncQueue` enviam o header `X-Sync-Replay: 1` e são **sempre aceitas** (já
aconteceram offline — regra "nunca perder dados").

**Consequências:** O `finalize()` trata 409 como bloqueio e **não** enfileira
(enfileirar burlaria a trava via replay isento).

---

## m3-02 — Biometria como tela de bloqueio (cold start), não substituindo o NextAuth

**Contexto:** Pedido de desbloqueio por digital ao abrir o app.

**Justificativa:** `BiometricGate` (com `@capgo/capacitor-native-biometric`, compatível
com Capacitor 7) trava a UI no cold start, montado no layout do técnico — não
re-dispara no resume. Não substitui o NextAuth. Aparelhos sem biometria passam
direto (fallback); falha/cancelamento mostra botão de repetir. Permissão
`USE_BIOMETRIC` no Manifest.

---

## m3-03 — Paginação do histórico do técnico por offset

**Contexto:** O `/inicio` mostrava só as 20 conferências mais recentes.

**Justificativa:** O `GET /api/conferences` aceita `offset` (além de `limit`), e
o cliente usa `useInfiniteConferences` com botão "Carregar mais" (10 por página).

---

## m2-01 — Sintaxe de variável CSS do Tailwind v4

**Contexto:** 18 usos de `text-[--itc-x]` (sintaxe v3) compilavam `color: --itc-x`
sem `var()` no Tailwind v4 — CSS inválido, ignorado silenciosamente (cores
"quebradas"). Também 46 usos de `flex-shrink-0` (removido no v4).

**Justificativa:** Os tokens estão em `@theme inline` (`--color-itc-*`), então a
forma canônica é o utilitário nomeado `text-itc-sucesso` / `bg-itc-sucesso/10`.
`flex-shrink-0` → `shrink-0`. `@source not "../../**/*.md"` evita que exemplos em
docs `.md` gerem CSS inválido.

**Consequências:** Nunca usar `[--itc-x]`; usar `itc-x` (tema) ou `(--itc-x)`.

---

## sec-01 — Vulnerabilidades de dependências corrigidas via `overrides`

**Contexto:** O CI (`npm audit --audit-level=high`) falhava com 8 vulnerabilidades
(3 high, 5 moderate), a maioria em dependências **transitivas** que não podem ser
atualizadas pelo pai diretamente. O `npm audit fix` puxava uma árvore enorme e
incontrolada, e o `--force` propunha absurdos (baixar o Next para 9.3.3).

**Decisão:** usar `overrides` no `package.json` para forçar versões corrigidas das
transitivas, sem tocar nos pais:
- `fast-uri` → `3.1.4` (high — host confusion; via `@sentry/*` → webpack → ajv). Compatível com ajv `^3`.
- `sharp` → `^0.35.0` (high — CVEs libvips; dep opcional do Next para otimização de imagem). 0.35.3, minor sobre o `^0.34.5` do Next.
  - **Atualização (2026-07-30):** o `sharp` virou **`devDependency`** direta (`^0.35.0`) — a rodada da marca precisa dele para `scripts/generate-icons.mjs`, e ele não era resolvível (nada o instalava). Com o `sharp` como dep direta, o override não pode ser uma versão literal (npm `EOVERRIDE`); passou a **`"sharp": "$sharp"`**, que resolve todo `sharp` do tree para a dep direta — mesma versão segura, uma só no tree. O gate `--omit=dev --audit-level=high` (sec-03) segue **0**.
- `postcss` → `^8.5.10` (moderate — XSS no stringify; bundled do Next). 8.5.21, patch seguro.
- `@hono/node-server` → `^2.0.5` (moderate — path traversal; via `@prisma/dev` e `shadcn`→mcp-sdk, ferramentas dev, sem exposição em runtime).
- `nanoid` → `^3.3.18` (high — GHSA-2v37-7h3g-55p8, custom generators loop infinitely when size is zero; via `@tailwindcss/postcss` → `postcss` → `nanoid`). Compatível com postcss `^3.3.7`.

**Verificação:** `npm audit --audit-level=high` sai 0; `npx prisma generate`, `tsc`
e `next build` continuam OK (2026-07-21, atualizado 2026-08-13).

**Consequências:** As `overrides` fixam versões — revisar ao atualizar Next/Sentry.
Os avisos npm sobre `--force` (downgrade do Next) devem ser **ignorados**.

---

## sec-02 — @capgo/capacitor-native-biometric: fix adiado (exige Capacitor 8)

**Contexto:** `@capgo/capacitor-native-biometric <8.3.6` tem um Authentication Bypass
(moderate, GHSA-vx5f-vmr6-32wf). A correção está em **8.3.6+**, e **todas** as
versões ≥8.3.6 exigem `@capacitor/core >=8.0.0`. O projeto está em **Capacitor 7**
(a maior 7.x do plugin, 7.6.0, ainda é vulnerável).

**Por que não corrigir agora:** subir para 8.x obrigaria migrar todo o app para
**Capacitor 8** (outra migração major nativa + rebuild do APK + revalidar
`@capacitor-mlkit/barcode-scanning`, geolocation e local-notifications em v8). É um
breaking change grande, fora do escopo desta correção de segurança.

**Mitigação / risco real baixo:** a biometria é apenas uma **tela de bloqueio de
UI** no cold start (`BiometricGate`), não a fronteira de segurança. O acesso real é
protegido pelo NextAuth (cookie JWT validado no servidor via `proxy.ts` e `auth()`).
Um bypass do lock local **não** concede acesso a dados sem sessão válida. É moderate
e **não** bloqueia o gate `--audit-level=high` do CI.

**Quando corrigir:** junto de uma futura migração planejada para Capacitor 8.

**Resolvido (2026-10-29):** migrado para Capacitor 8 com `@capgo/capacitor-native-biometric` 8.8.3. Ver [m7-11](#m7-11--migração-para-capacitor-8-e-assinatura-de-release).

---

## sec-03 — Gate de audit escopado para produção (`--omit=dev`)

**Contexto:** durante a v3.1, o CI (`npm audit --audit-level=high`) voltou a falhar.
Diagnóstico apontava 3 alvos de runtime + o `brace-expansion` (dev-only).

**Corrigido (runtime):**
- `@auth/core` `0.41.2 → 0.41.3` (**critical**, via `npm audit fix` sem `--force`).
  Arrastou junto `next-auth` beta.31 → **beta.32** e `@auth/prisma-adapter` 2.11.2 → 2.11.3 (patch).
- `next` `16.2.9 → 16.2.11` (**high** — inclui o *Middleware/Proxy bypass* com Turbopack,
  relevante porque usamos `proxy.ts` + Turbopack).
- `find-my-way` `9.6.0 → 9.7.0` via `overrides` (**high** — DoS HTTP2, GHSA-c96f-x56v-gq3h).
  Transitiva na cadeia `prisma → @prisma/dev`, e `prisma` é **prod dependency** (o entrypoint
  do Docker roda `prisma migrate deploy`), por isso não é dev-only e precisa mesmo do fix.

**Decisão de escopo:** o gate passou a `npm audit --omit=dev --audit-level=high`
(no [`ci.yml`](../.github/workflows/ci.yml) e no script `audit:security`). O único high
remanescente era `brace-expansion <=5.0.7` (DoS/ReDoS), **100% dev-only** — vive só na
cadeia do `eslint`/`ts-morph`, processando nossos próprios globs de config (confiáveis),
e **não entra na imagem Docker** (`output: 'standalone'` descarta devDependencies). O
runtime segue **100% auditado** (`next`, `next-auth`, `@auth/core`, `react`, `@prisma/client`).

Além de dev-only, é **falso-positivo**: o `1.1.16` instalado já é a versão corrigida da
linha 1.x (fix em 1.1.12), mas o range colapsado do npm (`<=5.0.7`) o sinaliza mesmo assim.

**Por que não via `overrides` (como sec-01):** não é viável. A única versão que o npm
aceita (`5.0.8`) é **ESM** e quebra o `minimatch@3` do eslint (`TypeError: expand is not a
function` → eslint inteiro morre); a linha `2.x` também é sinalizada pelo range; e o
`@eslint/config-array` é CJS, não consegue `require` um `minimatch@10` (ESM).

**Por que não `eslint → 10`:** major breaking (revalidar flat config, regras,
`eslint-config-next`), fora do escopo. O `brace-expansion` sai naturalmente quando o
`eslint-config-next` puxar o eslint novo.

**Mantidos como moderate conscientes (não bloqueiam o gate):**
- `@capgo/capacitor-native-biometric` — fix exige Capacitor 8 (ver [sec-02](#sec-02--capgocapacitor-native-biometric-fix-adiado-exige-capacitor-8)).
- `valibot` — a correção rebaixaria `prisma` para 6, violando [m1-01](#m1-01--prisma-7-com-driver-adapter-e-prismaconfigts).

**Verificação (2026-07-24):** `npm audit --omit=dev --audit-level=high` sai 0;
`prisma generate`, `tsc`, `lint`, `build` (26/26 páginas) e 127/127 testes Vitest OK.

**Pendência:** smoke-test de auth ao vivo (login + proteção de rotas via `proxy.ts`)
ainda **a fazer antes da distribuição** — não foi possível no ambiente de correção
(exige DB + servidor). Nenhum código de auth foi tocado (só bumps de patch).

---

## sec-04 — Advisory drift: fast-uri, brace-expansion e reclassificação do shadcn

**Contexto:** o gate `npm audit --omit=dev --audit-level=high` ficou vermelho na `develop`
por **advisory drift** — a base de advisories do npm ganhou novos ranges desde a
[sec-03](#sec-03--gate-de-audit-escopado-para-produção---omitdev) (2026-07-24), **sem
qualquer mudança de código** (confirmado com `git stash`: o HEAD limpo também falhava).

**Corrigido (2026-08-05):**
- `fast-uri` `3.1.4 → 3.1.5` (override). Advisory GHSA-7p8r-x3mc-p8w7 (host confusion via
  backslash), range `>=3.0.0 <3.1.5` — o pin `3.1.4` da sec-01 caiu **dentro** do range.
  3.1.5 satisfaz `ajv ^3.0.1` (a compat registrada na sec-01); via ajv em prisma/next/mcp.
- `brace-expansion` `→ 5.0.9`, override **escopado a `@serwist/next`**. Advisory
  GHSA-rgw5-rvv9-x895 (DoS), range `>=4.0.0 <5.0.9`. **A premissa da sec-03 mudou:** o pacote
  deixou de ser dev-only — `@serwist/next` (prod, PWA) o puxa via `minimatch@10` (ESM), que
  aceita `^5.0.5`. O override é **escopado** ao subtree do `@serwist/next` justamente para
  **não** tocar no `minimatch@3`/`brace-expansion@1.1.16` do eslint (CJS) — a tensão da sec-03
  fica evitada: o eslint segue em 1.1.16 e o `lint` passa.

**Reclassificação — `shadcn` para `devDependencies` (correção de raiz):**
Os dois highs restantes (`ip-address` SSRF, fix 10.4.0; `undici`, fix 7.29.0) chegavam
**exclusivamente** via `shadcn` → `@modelcontextprotocol/sdk`/`@dotenvx/dotenvx`/
`express-rate-limit`. O `shadcn` é uma **CLI de scaffolding** (nunca importada em runtime —
`grep` em `src/` não acha nenhum import; o app usa os componentes já gerados em
`@/components/ui`), mas estava listada em `dependencies`. Movida para `devDependencies`: sai
inteira do `--omit=dev`, derrubando `ip-address`, `undici` **e** o path de brace-expansion do
shadcn **de uma vez** — sem overrides por pacote. Removido o override redundante de
brace-expansion que apontava para o subtree do shadcn. `npx shadcn add` segue funcionando em
dev; a CLI deixa de entrar na imagem Docker de produção (onde nunca foi usada), o que é o
comportamento correto.

**Não corrigir com `--force`:** mantida a regra da sec-01 — `npm audit fix --force` propõe
downgrades absurdos (Next → 9.3.3). Ignorado.

**Verificação (2026-08-05):** `npm audit --omit=dev --audit-level=high` sai **0**;
`prisma generate`, `tsc`, `lint` (0 erros) e `build` (28/28 páginas) OK; 139 testes Vitest.

---

## m7-09 — Splash adaptativa via @capacitor/splash-screen e projeto android/ versionado

**Contexto:** a identidade "Mira" precisava de splash nativa com a marca, adaptativa ao
tema do sistema (claro/escuro), sem regredir a persistência de sessão do WebView
([m7-08](#m7-08--persistência-de-sessão-no-webview-cookie-flush-e-sem-revalidação-no-foco)).

**Decisão:** usar o plugin oficial `@capacitor/splash-screen@7` (alinhado ao Capacitor 7),
com o visual vindo **do tema**, não do config:
- `capacitor.config.ts` declara só `SplashScreen: { launchShowDuration: 500, launchAutoHide: true }`
  — **sem** `androidSplashResourceName`/`backgroundColor` (caminho legado).
- `AppTheme.NoActionBarLaunch` (parent `Theme.SplashScreen`) usa `windowSplashScreenBackground`
  + `windowSplashScreenAnimatedIcon` + `postSplashScreenTheme`, e cores adaptativas por
  qualificador **`-night`** (`notescan_splash_bg` = `#F5F0E8` claro / `#1B1B1B` escuro), em
  paridade com o `themeColor` do `viewport` web.
- Ícone `splash_icon` (288·432·576·864·1152) em `drawable-*dpi` (claro) e `drawable-night-*dpi`
  (branco). Sem `windowSplashScreenIconBackgroundColor` nem branding image.

**MainActivity não é tocado:** desde o Capacitor 4 o plugin chama `installSplashScreen()`
internamente. A `MainActivity` contém a lógica de `CookieManager` da m7-08 — mexer nela
arriscaria a sessão. O plugin coexiste sem alteração de código nativo.

**Correção de premissa (revoga parte da [m7-05](#m7-05--migração-para-capacitor-7--capacitor-mlkitbarcode-scanning-leitura-em-lote)):**
o projeto nativo `android/` inteiro passou a ser **versionado**. A observação da m7-05 de
que Gradle/wrapper eram gitignored (mudanças só locais) **não vale mais** — daí o `cap sync`
alterar `capacitor.build.gradle`/`capacitor.settings.gradle` aparecer no diff.

**Nota:** o `cap sync` também propôs bumpar Java 17→21 no `capacitor.build.gradle` (gerado);
mantido em 17 neste commit (fora do escopo da marca). O bump combina com o requisito de
**JDK 21** da m7-05 e deve ser tratado deliberadamente num commit próprio.

**Verificação:** `npx cap sync android` OK (5 plugins). Splash real exige **rebuild do APK**
no Android Studio (JDK 21). Nota de teste: em Android 12/12L a splash não aparece por
launchers de terceiros / app info / Android Studio — testar em Android 13+ ou launcher padrão.

> **Correção da "Nota" acima (2026-07-30):** aquela nota dizia manter Java em 17. Isso foi
> revertido — o valor efetivo é **21**. Motivo detalhado em [m7-10](#m7-10--versão-de-java-do-android-é-ditada-pelo-arquivo-gerado-21).

---

## m7-10 — Versão de Java do Android é ditada pelo arquivo gerado (21)

**Contexto:** o `source/targetCompatibility` do módulo Android oscilou entre 17 e 21 durante a
rodada da marca, sujando o working tree. Investigação fechou a causa.

**Fatos:**
- O `android/app/capacitor.build.gradle` é **gerado** por `@capacitor/cli/dist/android/update.js`,
  que embute `JavaVersion.VERSION_21` **hardcoded** — **não** há variável em `variables.gradle`
  controlando isso (o arquivo até avisa: *"DO NOT EDIT — GENERATED EACH TIME capacitor update IS RUN"*).
- Logo, o **valor committed precisa ser 21**. Se for 17, **todo `npx cap sync android` regenera
  para 21** e o `git status` acusa o arquivo modificado — briga permanente com arquivo gerado.
- Pinar `compileOptions` em `android/app/build.gradle` é **inócuo**: o `apply from:
  'capacitor.build.gradle'` vem **depois** do bloco `android {}` (linha ~51 vs ~27), e como as
  propriedades são *last-wins*, o gerado sempre vence. Por isso o bloco foi **removido** de lá
  (dava falsa impressão de controlar a versão).
- O `17` que apareceu committed em `02f7f1c` era **artefato de um CLI antigo**, adicionado ao
  versionar o `android/` **sem rodar `cap sync`**; o primeiro sync sob o CLI 7.6.8 o corrigiu para 21.

**Decisão:** manter **21** committed (o que o gerador produz) e **não** pinar Java em `app/build.gradle`.
Nota funcional: o **JDK 21** exigido pela [m7-05](#m7-05--migração-para-capacitor-7--capacitor-mlkitbarcode-scanning-leitura-em-lote)
é o que **roda o Gradle** — independente do `sourceCompatibility`. Não há necessidade funcional de
21 sobre 17; a escolha por 21 é só para **casar com o gerado** e manter o working tree estável.

**Verificação (2026-07-30):** com 21 committed, `npx cap sync android` deixa o `git status` **limpo**
(zero diff nos `.gradle`).

---

## ds-01 — Adoção do Design System v3.1 (Rota B: valores, não vocabulário)

**Contexto:** o app foi conformado ao Design System v3.1 (`.interface-design/system.md`
+ `design-reference/`), tela por tela, sem reescrever tudo de uma vez.

**Decisão (Rota B):** o **vocabulário de tokens não muda** — o código segue usando as
escalas ITC (`--itc-ciano-*`, `--itc-bordo-*`, neutros), as funcionais
(`--itc-sucesso/atencao/erro/info`) e os aliases shadcn. A v3.1 **atualiza apenas
valores de superfície** (off-white: `--background #F5F0E8`, `--card/--popover/--sidebar
#FDFBF7`, `--secondary/--muted #EBE4D8`, `--border/--input #D8DEDE`) e **consolida
regras visuais**. Nenhum token foi renomeado/removido.

**O que entrou:**
- Sombras sutis `--shadow-1` (cards) / `--shadow-2` (modais), registradas no `@theme`.
- Tipografia: **Inter** em toda a UI (pesos 400–800 carregados); **Archivo 800** só no
  wordmark da marca (`--font-archivo` / utilitário `font-archivo`); JetBrains Mono
  descontinuado — dados técnicos usam `tabular-nums`.
- **Manutenção sempre amarela** (`--itc-atencao`) em todas as telas/badges/faixas.
- Scanner: pills (pendentes/lidos/manut.) + faixa de manutenção com "Ver"; cores do
  overlay nativo via constantes espelhando os tokens (ver m-scanner note no código).
- Resumo componentizado (`ConferenceSummary`) reutilizado por técnico, modal do
  histórico e admin ("Ver").
- Dashboard/Relatórios: tabela com Data(+horário), Contagem, Status em pills
  COMPLETO/INCOMPLETO, Localidade (Abrir mapa → Google Maps) e Resumo (Ver).
- Login responsivo único: mobile (técnico) + desktop card (admin).

**Consequências:**
- Regra inviolável: nunca hex direto (usar tokens); nunca `text-[--itc-x]` (v4);
  manutenção sempre amarela; Archivo só na marca.
- **Pendência nativa:** as mudanças do overlay nativo do scanner (`NativeQRScanner`)
  só aparecem no aparelho após **rebuild do APK** (Capacitor 7, JDK 21). O restante é web.
- Exceção documentada: `bg-black` no container de vídeo do `QRScanner` (viewport da
  câmera) — intencional; `bg-foreground` ficaria branco no dark.

---

## sec-05 — Ciclo de outubro: sharp, next e source-map-js com regra dos 14 dias

**Contexto:** entre 08/09 e 22/10/2026 o npm publicou uma leva de advisories contra o
runtime, e o gate `npm audit --omit=dev --audit-level=high` ficou vermelho.

**Vulnerabilidades encontradas (runtime):**
- `sharp` `0.35.3` — GHSA-rgj7-g3m4-5g8c (libheif, high, fix 0.35.4) e GHSA-wq5f-xc86-pv6w
  (librsvg, high, fix 0.35.5). Corrigido: `→ 0.35.5`.
- `next` `16.2.11`, com dois lotes:
  - **Corrigidos na 16.3.x:** GHSA-2xp9-vwfh-vxw4 (RCE sem autenticação no Image Optimization via
    AVIF, critical), GHSA-p293-qw3h-jr36 (RCE em servidor Windows, critical), GHSA-vcvr-r3jv-pc5j
    (RCE em `next/og`, critical), GHSA-cjq9-62q9-8jv4 (SSRF no Image Optimization, high), além
    de cache poisoning e vazamento de informação (medium/low).
  - **Publicados em 22/10, corrigidos só na 16.4.1:** GHSA-2464-fhr4-w9xw (RCE no Image
    Optimization via SVG, critical), GHSA-673q-mjm6-r5xr (RCE em `use cache`, critical) e
    GHSA-p3m5-59mp-jv5r (DoS em Server Actions, high).
  - Corrigido: `16.2.11 → 16.3.8 → 16.4.1`.
- `source-map-js` `1.2.1` — GHSA-68fv-2mgg-jv7q (DoS, high). Corrigido: override `^1.2.2`.

O `next.config.ts` perdeu `experimental.viewTransition`: a opção foi removida na 16.3 (o
type-check passou a falhar), e as view transitions funcionam sem configuração no App Router.

**Regra dos 14 dias:** nenhuma versão entra no lockfile se tiver sido publicada há menos de
14 dias (proteção contra pacote comprometido publicado e retirado logo depois). Como aplicar:
- conferir a data com `npm view <pkg> time`;
- instalar com `npm install --before=<hoje − 14d>`;
- listar o diff de versões do lockfile, pacote a pacote, e abortar se mudar algo fora da árvore
  do pacote alvo.

**O que a regra barrou neste ciclo:**
- `next` `16.4.1` (publicado em 14/10): entrou com um dia de espera (27/10 → 28/10).
- `@sentry/nextjs` `10.77.1` (publicado em 27/10, no próprio dia): o range `^10.76.2` o puxaria.
  O lock foi travado em 10.76.2.
- `import-in-the-middle` `3.5.3` (26/10) e `es-module-lexer` `3.0.4` (15/10), transitivas do
  Sentry: reresolvidas para 3.5.2 e 3.0.3.
- `fast-uri` `3.1.9` (19/10): segue **moderate aberto** até 02/11.

**Mitigação enquanto o fix não estava liberado:** regra de WAF no Cloudflare (zona do
`itcbr-tunnel`) bloqueando `/_next/image`. Ela cobre os vetores de RCE e SSRF do Image
Optimization. O app não usa `next/image` em `src/`, então o bloqueio não quebra nada. Não
encontramos `use cache` nem Server Actions em `src/`, o que reduz a exposição aos outros dois
advisories de 22/10.

**Destino da regra de WAF:** **remover após o deploy da 16.4.1 em produção.** Ela é mitigação
temporária, não defesa permanente. Atenção: o deploy no GLPI-SRV precisa estar funcional para
isso acontecer; até lá a regra permanece.

**Lições:**
- **`^` em override precisa ser conferido na versão resolvida.** O range garante só o piso.
  O npm resolve para a versão mais nova dentro dele, que pode ser posterior ao corte de 14 dias
  ou estar dentro de um advisory novo. Sempre conferir no `package-lock.json`, não no
  `package.json`.
- **Proibido pin exato em override.** O pin `fast-uri 3.1.4` da sec-01 caiu dentro do advisory
  seguinte (ver sec-04), e um pin congela a versão até alguém lembrar de mexer. Overrides usam
  `^x.y.z` (piso corrigido) ou `$dep` (seguir a dependência direta); a trava de versão fica no
  lockfile.

**Verificação (2026-10-28):** `npm audit --omit=dev --audit-level=high` sai **0**;
`tsc`, `lint` (0 erros), 161/161 testes Vitest e `npm run build` (standalone) OK.
Remanescentes moderate: `fast-uri` (corte libera em 02/11) e `@capgo/capacitor-native-biometric`
(exige Capacitor 8, ver sec-02).

---

## m7-11 — Migração para Capacitor 8 e assinatura de release

**Contexto:** o alerta da biometria (GHSA-vx5f-vmr6-32wf, ver [sec-02](#sec-02--capgocapacitor-native-biometric-fix-adiado-exige-capacitor-8)) só tinha
correção na linha 8.x, que exige Capacitor 8. Os APKs eram assinados com a chave de debug
do PC de desenvolvimento: se ela se perdesse, nenhum APK novo instalaria por cima, e a
chave de debug é igual em toda instalação do Android Studio.

**Decisão:** migrar para o Capacitor 8 e passar a distribuir APK de release assinado
**numa única troca**, porque as duas mudanças obrigam os técnicos a reinstalar.

**Pacotes** (todos publicados até o corte de 14 dias da [sec-05](#sec-05--ciclo-de-outubro-sharp-next-e-source-map-js-com-regra-dos-14-dias)):
`@capacitor/*` 8.5.3, `@capacitor-mlkit/barcode-scanning` 8.2.1, `@capacitor/geolocation`
8.2.3, `@capacitor/local-notifications` 8.3.1, `@capacitor/splash-screen` 8.0.2,
`@capgo/capacitor-native-biometric` 8.8.3.

**Migração manual, sem `npx cap migrate`:** o comando reescreve o `package.json` para `^8`
e roda `npm install` por conta própria, puxando versões posteriores ao corte. Aplicamos
o guia oficial (capacitorjs.com/docs/updating/8-0) à mão:
- AGP 8.7.2 → 8.13.0 e google-services 4.4.2 → 4.4.4. O wrapper do Gradle já estava
  na 8.14.5 (o mínimo é 8.14.3).
- `variables.gradle`: SDK mínimo/compilação/alvo 24/36/36, versões do androidx do guia e
  `kotlinxCoroutinesVersion` 1.10.2 (exigido pelo geolocation).
- `app/build.gradle` na sintaxe com `=` (a antiga está depreciada).
- Manifest: `density` no `configChanges`, para o WebView não recarregar ao redimensionar.
- Removido o override `bridge_layout_main.xml`: o Capacitor 8 renomeou o layout para
  `capacitor_bridge_layout_main.xml`, e o nosso era uma cópia do padrão sem nenhuma
  referência no código.
- `versionCode` 3 / `versionName` 2.0.

**Assinatura:** o `signingConfig` de release lê `android/keystore.properties`, que fica
fora do git. O keystore fica **fora do repositório** (`~/keystores/notescan-release.jks`,
alias `notescan`, RSA 4096, validade de 10.000 dias). Sem o arquivo de propriedades, o
release sai sem assinatura em vez de quebrar o build. Certificado (SHA-256):
`9671e48467328b6314ead3d709f2fcae5063f0c579d227a1330f5abf6b24adf9`.

**JDK:** o build passa a usar o Eclipse Adoptium 21. O JBR do Android Studio quebrou numa
reinstalação, que o moveu de pasta, e um JDK próprio não depende disso.

**Consequências:**
- O APK novo **não instala por cima** do antigo, porque a assinatura é outra. Cada técnico
  precisa desinstalar o app, o que apaga o Dexie local. **A fila de sincronização precisa
  estar zerada antes da troca.**
- Keystore e senha precisam de backup em dois lugares (cofre de senhas e cópia offline).

**Verificação (2026-10-29):** `assembleRelease` assinado (verificado com `apksigner`),
instalado num Galaxy S23 (Android 16, alvo 36). Biometria, login, sessão após segundo
plano, scanner nativo em lote e geolocalização testados no aparelho. Nenhum crash no
logcat.

---

## nb-01 — Excluir notebook com histórico = arquivar (status ARQUIVADO + sufixo)

**Contexto:** `DELETE /api/notebooks/[id]` e `bulk-delete` falhavam com 500 para todo
notebook com histórico. `ConferenceItem.notebook` e `LifecycleEvent.notebook` não têm
`onDelete` (Restrict), e conferências e LifecycleEvents são imutáveis: não se apaga nem se
usa cascade.

**Alternativas consideradas:**
- Cascade ou apagar o histórico (rejeitado: quebra a imutabilidade e os relatórios)
- Soft delete com `deletedAt` (rejeitado: obrigaria a filtrar em toda consulta e não
  resolve o `@unique` do hostname)
- Guardar o hostname original numa coluna nova (rejeitado: o original sai do próprio
  sufixo, removendo `~arq-…`)

**Decisão:**
- Novo valor `ARQUIVADO` em `NotebookStatus` (migration `20261125120000`).
- Sem nenhum ConferenceItem nem LifecycleEvent → exclusão real. Com histórico → status
  `ARQUIVADO`, hostname `ORIGINAL~arq-YYYYMMDD` (data em America/Sao_Paulo; em colisão no
  mesmo dia, `-2`, `-3`...) e LifecycleEvent `ARQUIVADO` com o hostname original, tudo numa
  transação. O sufixo libera o `@unique` para recadastrar o hostname.
- O padrão `~arq-\d{8}(-\d+)?$` é reservado: POST, PUT, lote e import respondem 400.
- Erros esperados respondem 409 com mensagem, nunca 500.
- Arquivado fica fora do uso operacional: `GET /api/notebooks` o exclui por padrão (lista
  esperada da conferência e lookup do scanner), assim como o total do dashboard e as
  contagens de UM. `?includeArchived=1` serve à tela de notebooks ("Mostrar arquivados") e
  ao scanner, que mostra "notebook arquivado — procure o administrador". O reducer da
  conferência nunca põe ARQUIVADO em pendentes ou manutenção.
- Histórico, relatórios, resumo e Telegram exibem `originalHostname()`.
- **Bulk-delete:** transação interativa com `timeout: 30s` explícito, em vez dos 5s
  padrão. Cada arquivado precisa de um `update` próprio (hostname único), mas a busca de
  colisões e os eventos saem em uma consulta cada. São cerca de 110 statements para uma UM
  de 106. Rever se uma UM passar de cerca de 1000 notebooks.
- UM com notebooks arquivados continua sem poder ser excluída (o FK do histórico exige),
  com mensagem 409 própria.

**Recadastro de hostname arquivado:** no cadastro individual, a API responde 409
`ARCHIVED_MATCH` e a UI pergunta:
- **Reativar** (mesma máquina): restaura o hostname, status ATIVO e a UM escolhida, grava o
  LifecycleEvent `REATIVADO` e preserva o histórico.
- **Cadastrar como novo** (outra máquina): cria um registro novo, e o arquivado mantém o
  sufixo.

No lote e no import, os conflitos aparecem no resultado com uma ação em massa (Reativar
todos / Cadastrar todos como novos / Pular). Se já existir notebook ativo com o hostname, a
reativação é recusada: 409 no individual, `blocked` no lote.

**Replay offline:** uma conferência no outbox com um notebook arquivado depois é gravada
normalmente. O id não muda, o FK continua válido e o POST não valida status. Não precisou
de ajuste.

**Consequências:** nada muda no APK, que carrega `server.url`. O deploy precisa aplicar a
migration.

## sec-06 — Next 16.4.5 (complemento da sec-05)

**Contexto:** em 03/11/2026 o npm publicou 7 advisories contra `next` `>=16.x <=16.4.4`, todos
moderate. O gate (`--audit-level=high`) não ficou vermelho por eles, mas o `next dev` passou a
interromper a primeira subida com um aviso de upgrade (código 1), o que quebrava o webServer
do Playwright.

**Advisories (corrigidos na 16.4.5):**
- GHSA-vc7v-qv4w-wrv8 — vazamento de cache entre root params em `use cache` aninhado.
- GHSA-rhh4-g77r-r9qj — vazamento/envenenamento de cache entre usuários em `use cache` com
  argumentos binários.
- GHSA-mfr8-8qww-v76h — `use cache` via `unstable_cache()` expõe dados entre root params.
- GHSA-7qx7-33qx-rqx2 — bypass da rejeição de SVG no Image Optimization.
- GHSA-f3mh-rxg3-f5g2 — cookie HttpOnly exposto por header interno no Edge runtime.
- GHSA-pc58-hwjq-p385 — injeção/vazamento de resposta entre clientes em self-hosted que
  repassa respostas de fetch.
- GHSA-vvgp-ww4w-46vf — envenenamento de fallback shells em Cache Components.

**Decisão:** `next` e `eslint-config-next` `16.4.1 → 16.4.5`, versão exata. Ambos publicados em
03/11/2026 (22 dias antes da instalação, dentro da regra dos 14 dias da sec-05). Não usamos
`next upgrade`: o comando é sugerido pelo próprio CLI e reescreveria dependências fora do
nosso controle. O lockfile só mudou em `next`, `@next/*` e `eslint-config-next`.

**Audit após o bump (`--omit=dev`):** 12 (9 moderate, 3 high), antes 13. `next` saiu da lista.
Os 3 high restantes são a cadeia `prisma` → `@prisma/config` → `effect`, anterior a este bump;
o gate continua vermelho por ela.

### sec-06a — Override de `effect` 3.22.5 (exceção à regra dos 14 dias)

**Contexto:** os 3 high restantes do audit vinham de `prisma` 7.9.0 → `@prisma/config` →
`effect` 3.20.0 (GHSA-7589-6fvf-x4pw). O Prisma ainda não publicou versão com `effect` corrigido.

**Decisão:** `overrides.effect = "3.22.5"` (exato). A 3.22.4 (22/10) já corrigia o advisory e
cumpria a regra dos 14 dias; a 3.22.5 (19/11/2026) entrou com 6 dias de publicação por decisão
do Matheus Nobre em 25/11/2026, como exceção explícita à regra da sec-05.

**Verificação antes de instalar:** mesmos mantenedores das versões anteriores
(michael.arnaldi, effect-bot), publicação via GitHub Actions (OIDC), sem scripts de
install/postinstall; integrity `sha512-AdIU4llI…Zkmjpw==`. O lockfile só mudou em `effect`.
`prisma validate`/`generate`/`migrate` sem alteração; type-check, testes e E2E verdes.

**Audit (`--omit=dev`):** 9 moderate, 0 high; o gate `audit:security` sai com código 0.

**Remover o override** quando o Prisma publicar versão que já dependa de `effect` corrigido.

## m8-01 — Acesso de agentes via token de API e MCP

**Contexto:** agentes (automação e IA) precisam ler e manter o catálogo (projetos, UMs,
notebooks) sem sessão humana. A Fase 0 auditou os pontos de role; a Fase 1 (`b44de56`)
trocou as checagens por allowlists de roles humanas (`isHumanRole`), e o Credentials já
recusa role não humana.

**Decisão — identidade:**
- Role nova `AGENTE` no enum `Role`. A role só classifica o ator; a autorização do agente
  vem exclusivamente dos escopos do token.
- `AGENTE` é imutável: nenhuma conversão `AGENTE ↔ USER/ADMIN/MASTER` (409).
- `AGENTE` não tem senha: `User.passwordHash` passa a ser opcional (migration). Agente
  nunca faz login por Credentials (bloqueio da Fase 1, mantido e coberto por teste).
- `metaDiaria` não se aplica a `AGENTE`: ignorada, e rejeitada se enviada na criação.
- Criação de `AGENTE` só por MASTER, com nome e descrição; sem senha e sem meta.
- E-mail gerado: `agente-<slug>@notescan.invalid` (`.invalid` é reservado pela RFC 2606;
  `.local` pode resolver em rede local). Colisão de slug → sufixo numérico (`-2`, `-3`...).
- Excluir agente com tokens ou AuditLog: 409 "agentes com histórico não podem ser
  excluídos; para desativar, revogue o token". O token revogado continua referenciando o
  agente (FKs `Restrict`, histórico nunca em cascade).

**Decisão — token:**
- Modelo `ApiToken`: hash sha256 do token (nunca o valor em claro), prefixo visível para
  identificação, escopos, `expiresAt` (365 dias), `revokedAt`, `lastUsedAt`, `userId`.
- Um token ativo por agente; emitir um novo revoga o anterior. O valor em claro aparece
  uma única vez, na emissão.
- Escopos: `read:catalog`, `write:catalog`, `delete:catalog`, `destructive`.
  Independentes: nenhum implica outro. Operações em massa ou irreversíveis (bulk-delete
  por UM, exclusão de projeto e de UM) exigem `delete:catalog` E `destructive`.
- Formato `nsk_` + 32 bytes aleatórios (`crypto.randomBytes`) em base64url; banco guarda
  só o sha256 hex; prefixo exibido = 12 primeiros caracteres.
- Fora do alcance de agentes (escrita): conferências, criação/edição de usuários,
  notificações.

**Decisão — autorização:**
- `resolveActor()` substitui `auth()` nas rotas: aceita Bearer token OU cookie de sessão
  (Bearer tem precedência) e valida expiração, revogação, role e escopo. `requireScope()`
  por rota. Bearer presente e inválido responde 401 sem cair no cookie.
- Rate limit por ator (`actor:<userId>`, mecanismo em memória atual): 120 req/min para
  leitura, 30 req/min para escrita (um MCP lendo uma UM de 106 notebooks estouraria 30).
- Modelo `AuditLog` (`entidade`, `entidadeId`, `acao`, `actorId`, `tokenId`, `payload`,
  `createdAt`) para escritas em entidades sem LifecycleEvent (projetos, UMs). Cobre TODAS
  as escritas em projetos e UMs, humanas e de agentes (gravação implementada na Fase 3).
- ~~Gestão de tokens: aba dentro do card do usuário `AGENTE` em `/usuarios` (MASTER).~~
  Substituído em 25/11/2026 (Etapa 1), ver "Revisão — menu MCP e Agentes" abaixo.

**Decisão — MCP:** servidor separado, repositório próprio, container em
`notescan-mcp.itcbr.xyz`. Tools sem escopo correspondente são omitidas. Tools de notebook
tratam `ARQUIVADO` e o recadastro (Reativar / Cadastrar como novo) conforme `nb-01`.

**Faseamento:**
- Fase 2: schema + migration + `resolveActor` + `requireScope` + rate limit + testes
- Fase 3: migração das rotas
- Fase 4: UI de tokens
- Fase 5: MCP


**Revisão — menu MCP e Agentes (25/11/2026, Etapa 1):**
- A gestão de agentes sai de `/usuarios` e vai para o menu próprio "MCP e Agentes"
  (`/agentes`, só MASTER, no proxy e no menu lateral).
- API própria `/api/agents` (MASTER em sessão; 403 a qualquer token):
  `GET/POST /api/agents`, `PATCH/DELETE /api/agents/[id]`,
  `POST/DELETE /api/agents/[id]/token`. A emissão responde `Cache-Control: no-store`.
- `/api/users` recusa `AGENTE` na criação (400), não lista agentes e responde 404 à
  exclusão de agente. Continua o 409 nas conversões `AGENTE ↔ humano`.
- Regras mantidas: `AGENTE` imutável, sem senha, sem meta; 409 ao excluir agente com
  histórico.
- AuditLog também nas ações sobre agentes (`entidade: "Agente"`: `CRIADO`, `EDITADO`,
  `EXCLUIDO`, `TOKEN_EMITIDO`, `TOKEN_REVOGADO`). Payload de token só com `prefix`,
  `scopes` e `expiresAt`, nunca o token nem o hash.
- Rotas fora do alcance de agentes (conferências, usuários, notificações,
  change-password, agentes) usam `authorize(request, { scopes: [] })`: 403 explícito a
  qualquer token, em vez de 401 por ignorar o Bearer.
- Sessão com role não humana passa a receber 401 nessas rotas (antes 403); o proxy já
  derruba essa sessão.
- Leituras do catálogo com rate limit por ator de 120/min, humanos e agentes. Medido no
  E2E: o scanner faz 8 chamadas ao abrir (4 a `/api/notebooks`) e 0 durante 108
  leituras; o dashboard faz 4/min (só `/api/conferences/dashboard`).
- Sentry (servidor, edge, cliente): `beforeSend`, `beforeSendTransaction` e
  `beforeBreadcrumb` removem `authorization`, `cookie` e `set-cookie` de
  `request.headers` e dos breadcrumbs de fetch/xhr. O cliente não usa Session Replay
  nem captura de tela; o modal de token leva `data-sentry-block` por precaução.
- O token em claro vive só no estado do modal: mutation com `gcTime: 0` e `reset()`
  logo após a emissão; a lista invalida `["agents"]`, que só traz o prefixo.
- Rate limit de escrita diferenciado por tipo de ator (PR 2, 3b): token 30/min,
  sessão humana 120/min; leitura 120/min para ambos. Motivo: evitar 429 em edição
  manual em sequência por ADMIN/MASTER; o limite apertado vale para automação. O 429
  responde "Muitas requisições, aguarde alguns segundos", que as telas já mostram em
  toast (as mutations exibem a `message` da API).
- Fase 3 concluída (PR 3, 3c + 3d): arquivar notebook exige `delete:catalog`;
  bulk-delete por UM e exclusão de UM e de projeto exigem `delete:catalog` +
  `destructive`. Exclusão de projeto e de UM grava AuditLog `EXCLUIDO` (payload: nome e
  cor do projeto; nome e projectId da UM). As regras de negócio (409 com UMs ou com
  notebooks) valem igualmente para agentes. Nenhuma rota de `/api` chama mais `auth()`
  direto: todas passam por `authorize()`.
- Etapa 2: servidor MCP (a aba "Como conectar" é placeholder até lá).
