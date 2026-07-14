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

**Contexto:** Chamar `BarcodeScanner.prepare()` antes de `startScanning()` definia
`didRunCameraPrepare = true` internamente. Isso fazia o `scan()` (chamado dentro
de `startScanning`) pular o caminho `_prepare(savedCall)` que corretamente registra
o callback `keepAlive`. O resultado: câmera abria mas nenhum QR Code era detectado.

**Justificativa:** `startScanning()` já chama `_prepare` internamente pela rota
correta. Chamar `prepare()` explicitamente interfere nesse mecanismo.

**Consequências:** Não chamar `prepare()` antes de `startScanning()`. Se for
necessário pré-aquecer a câmera, investigar a versão v5 do plugin.
