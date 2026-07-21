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
- `android/build.gradle`, `variables.gradle` e o wrapper são gitignored — mudanças de Gradle valem só localmente.
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
