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
- `postcss` → `^8.5.10` (moderate — XSS no stringify; bundled do Next). 8.5.21, patch seguro.
- `@hono/node-server` → `^2.0.5` (moderate — path traversal; via `@prisma/dev` e `shadcn`→mcp-sdk, ferramentas dev, sem exposição em runtime).

**Verificação:** `npm audit --audit-level=high` sai 0; `npx prisma generate`, `tsc`
e `next build` continuam OK (2026-07-21).

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
