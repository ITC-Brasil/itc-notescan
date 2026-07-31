# ITC NoteScan — Design System

**Versão 3.1 · Grupo ITC Brasil**
App mobile-first de conferência de ativos via QR Code para técnicos de campo.

> Documento de referência para desenvolvimento (Next.js · Tailwind CSS 4 · shadcn/ui · Capacitor 7).
> A referência visual navegável está em `design-reference/ITC NoteScan Design System.dc.html`.
> Prints das telas em `design-reference/screenshots/`.
> Lido automaticamente pelo Claude Code a cada sessão. Atualizar após qualquer mudança estrutural de design.

> **Estratégia (Rota B):** o vocabulário de tokens do projeto **não muda**. O código
> continua usando a paleta ITC em escalas (`--itc-ciano-*`, `--itc-bordo-*`, neutros)
> e os aliases shadcn (`--background`, `--card`, `--primary`…). A v3.1 **atualiza apenas
> valores de superfície** e consolida regras visuais. Nenhum token é renomeado nem removido.

---

## Produto e usuários

**O que é:** ferramenta operacional de campo para conferência de ativos via QR Code.

| Perfil | Onde | Dispositivo | O que fazem |
|---|---|---|---|
| Técnico (USER) | Campo — sol, dentro de carretas, em movimento | Android (APK) | Escanear notebooks rapidamente, sem erros |
| Gestor (ADMIN/MASTER) | Escritório/remoto | Desktop | Monitorar conferências, gerenciar inventário |

**Feel:** operacional e confiável — não "clean SaaS genérico". Painel de controle industrial com refinamento visual moderno. Cada dado tem função; nada é decorativo.

---

## 1. Princípios

1. **Off-white, nunca branco puro.** Fundo base `#F5F0E8`, superfícies um tom acima `#FDFBF7`. Branco puro proibido — reduz cansaço visual sob sol forte.
2. **Ciano é acento, não fundo.** Interface majoritariamente neutra. Ciano guia o olho para a ação primária (regra 60/30/10).
3. **Cores funcionais só em status.** Verde, amarelo, vermelho e azul só em estados (completo, incompleto, manutenção, offline). Nunca decoração.
4. **Bordô é institucional e pontual.** Reservado à marca. Nunca fundo adjacente ao ciano.
5. **Tokens semânticos, nunca hex solto.** A aplicação consome tokens (`text-itc-sucesso`, `bg-card`), não hexadecimais diretos.
6. **Mobile-first com boa área de toque.** Alvos ≥ **44px**. Operação com uma mão, com pressa e luvas.
7. **Leitura rápida em campo.** Hierarquia clara, dados legíveis em movimento, contraste alto.

---

## 2. Cores

> **Vocabulário real de tokens:** o código usa a paleta ITC em escala (`--itc-ciano-1..12`,
> `--itc-bordo-1..12`, neutros) e os aliases shadcn. Os nomes conceituais do Design System
> (`accent`, `ok`, `warn`, `bg-surface`) são **apelidos de leitura** — o mapa oficial está
> na seção 2.4. No código, sempre usar o token real.

### 2.1 Fundação de marca (paleta em escala — já existente, fixa)

A marca tem escalas completas de 12 tons para ciano e bordô, além de neutros.
Os tons de referência:

| Papel | Token real | HEX |
|---|---|---|
| Ciano — cor principal | `--itc-ciano-7` | `#008F95` |
| Ciano hover | `--itc-ciano-8` | `#007A80` |
| Ciano pressed | `--itc-ciano-9` | `#006C72` |
| Ciano acento (dark mode) | `--itc-ciano-6` | `#17969C` |
| Bordô — institucional | `--itc-bordo-12` | `#491027` |

> As escalas completas (`--itc-ciano-1..12`, `--itc-bordo-1..12`, neutros branco/preto)
> permanecem como estão no `globals.css`. A v3.1 **não altera** os valores da paleta de marca.

### 2.2 Cores funcionais (apenas em status)

| Token real | Papel | Claro | Escuro |
|---|---|---|---|
| `--itc-sucesso` | Completo / Online | `#1A7F3C` | `#3DA35D` |
| `--itc-atencao` | Em manutenção / Atenção | `#CC7A00` | `#D98E2B` |
| `--itc-erro` | Incompleto / Erro / Offline | `#C0392B` | `#D75A4A` |
| `--itc-info` | Informação | `#1565C0` | `#4B93DB` |

> **Manutenção é sempre amarelo (`--itc-atencao`)** — em todas as telas (Scanner, Resumo,
> Seleção de UM, Dashboard, badges). Azul (`--itc-info`) transmite "ok/neutro" e **não**
> representa manutenção.
>
> **Nota:** o `globals.css` atual define as funcionais apenas no `:root` (valores do modo
> claro). Se a validação visual em dark mode indicar contraste insuficiente sobre o fundo
> escuro, adicionar os valores da coluna "Escuro" acima dentro do bloco `.dark`. Só fazer
> se necessário — não é obrigatório para a v3.1.

### 2.3 Tokens de superfície — valores da v3.1

A v3.1 ajusta os valores de superfície. **Modo claro** (editar no `:root`):

| Token real | Valor atual | Valor v3.1 |
|---|---|---|
| `--background` | `#F5EFE6` | **`#F5F0E8`** |
| `--card` | `#EDE8DE` | **`#FDFBF7`** |
| `--popover` | `#F2EDE6` | **`#FDFBF7`** |
| `--secondary` | `#E8E2D9` | **`#EBE4D8`** |
| `--muted` | `#E8E2D9` | **`#EBE4D8`** |
| `--border` | `#D4CEC5` | **`#D8DEDE`** |
| `--input` | `#D4CEC5` | **`#D8DEDE`** |
| `--sidebar` | `#E5DDD4` | **`#FDFBF7`** |
| `--sidebar-border` | `#D4CEC5` | **`#D8DEDE`** |

**Modo escuro:** manter a escala de neutros institucional já em uso
(`--itc-branco-12 #1b1b1b` como background, `--itc-branco-11 #2c2c2c` como card/sidebar,
`--itc-branco-10 #3e3e3e` como muted/border). Não trocar pelos tons mais escuros — a
escala de neutros é coerente com a identidade e a diferença é sutil.

**`.admin-main`:** atualizar o hex literal claro de `#f5efe6` para **`#f5f0e8`**
(acompanhar `--background`). O dark permanece `#1b1b1b`.

### 2.4 Mapa de apelidos (Design System → token real)

| Apelido conceitual | Token real no código |
|---|---|
| `accent` | `--itc-ciano-7` (claro) / `--itc-ciano-6` (escuro) — utilitário `text-itc-ciano-7` ou `bg-primary` |
| `accent-light` | `bg-itc-ciano-7/10` |
| `ok` | `--itc-sucesso` → `text-itc-sucesso` |
| `warn` | `--itc-atencao` → `text-itc-atencao` |
| `err` | `--itc-erro` → `text-itc-erro` / `text-destructive` |
| `info` | `--itc-info` → `text-itc-info` |
| `bg-base` | `--background` → `bg-background` |
| `bg-surface` | `--card` → `bg-card` |
| `bg-muted` | `--muted` → `bg-muted` |
| `border` | `--border` → `border-border` |
| `text-base` | `--foreground` → `text-foreground` |
| `text-muted` | `--muted-foreground` → `text-muted-foreground` |

### 2.5 Regra de uso de cor — 60/30/10

- **~60%** superfícies neutras (`bg-background`, `bg-card`, `bg-muted`)
- **~30%** texto e bordas (`text-foreground`, `border-border`, `text-muted-foreground`)
- **~10%** acento (`--itc-ciano-7`) — só ações primárias, ícones ativos, indicadores

### 2.6 Contrato de cor semântica

**SEMPRE usar o token ITC. NUNCA Tailwind hardcoded para semântica.**

⚠️ **Tailwind v4:** usar o utilitário nomeado `text-itc-sucesso`. **NUNCA** a sintaxe de
colchete `text-[--itc-sucesso]` — no v4 compila `color: --itc-sucesso` (sem `var()`), CSS
inválido ignorado silenciosamente.

```
✅ text-itc-sucesso        ❌ text-[--itc-sucesso]  (quebra no v4)
✅ border-itc-sucesso/30   ❌ text-green-500
✅ bg-itc-atencao/10       ❌ bg-yellow-500/5
✅ text-destructive        ✅ (alias para --itc-erro)
```

**Hierarquia de texto — quatro tons:**

| Token | Uso |
|---|---|
| `text-foreground` | Valores principais, títulos, dados críticos |
| `text-foreground/70` | Subtítulos, rótulos secundários |
| `text-muted-foreground` | Metadados, datas, rótulos de campos |
| `text-muted-foreground/60` | Captions, desabilitados |

---

## 3. Tipografia

- **Inter** — toda a interface (400/500/600/700/800). Google Fonts.
- **Archivo** — reservada exclusivamente à marca/logo (600 "ITC" · 700 header/sidebar · 800 "NoteScan"). Não usar na UI comum.
- **Sem fonte monoespaçada.** Dados técnicos (hostnames, seriais, IDs, timestamps) usam
  **Inter com `tabular-nums`** (classe `tabular-nums`).

> **Migração v3.1:** o `globals.css` ainda registra `--font-mono: var(--font-jetbrains-mono)`.
> Não remover essa linha imediatamente. Primeiro trocar todo uso de `font-mono` nos
> componentes por `tabular-nums` (Fase 1 da implementação). Só depois que nenhum componente
> usar `font-mono`, remover o token. Inter continua como `--font-sans` e `--font-heading`.

| Papel | Família | Peso | Tamanho |
|---|---|---|---|
| Display / Nome do app | Inter | 800 | 28–32px |
| H1 | Inter | 700 | 22px |
| H2 | Inter | 700 | 18px |
| H3 | Inter | 600 | 15px |
| Body | Inter | 400 | 14–15px |
| Small | Inter | 400 | 12–13px |
| Caption | Inter | 600 | 11px · uppercase · 0.06em |
| Dados técnicos | Inter | 500 | `tabular-nums` |
| Contagem / número grande | Inter | 800 | 32–48px |

**Regras:** números dinâmicos e hostnames sempre `tabular-nums`; headings grandes `tracking-tight`; rótulos uppercase pequenos `tracking-wider`.

---

## Marca — identidade "Mira"

Fonte da verdade: **`brand/`** (read-only, nunca editada). Os usos na aplicação são
cópias ou reconstruções — nunca editar as origens.

**Símbolo.** 4 cantos de mira de QR Code + miolo arredondado, em caixa `64×64` (módulo 8u).
Cantos em ciano; miolo em ciano profundo (claro) / creme (escuro). Duas variantes:

| Variante | Miolo | Uso |
|---|---|---|
| `symbol` | 18u, `rx 3` | tamanho normal (>24px) |
| `symbol-small` | 16u, `rx 2`, haste 10u | **sempre que renderizar a ≤24px** |

**Componente.** `NoteScanLogo` (`src/components/brand/NoteScanLogo.tsx`) — puro, sem
`"use client"`, sem deps. Props: `variant` (`"symbol"`\|`"symbol-small"`, default `symbol`),
`size` (px, default 32), `className`, `title` (quando presente → `role="img"` + `<title>`;
senão `aria-hidden`). Cores via classe Tailwind nos grupos
(`fill-itc-ciano-7 dark:fill-itc-ciano-6` nos cantos; miolo `fill-itc-ciano-12 dark:fill-[#F5F0E8]`),
nunca via atributo `fill`, para o dark mode funcionar sem duplicar componente.

**Lockup.** O nome "NoteScan" **nunca** é `<text>` dentro de SVG (o `next/font` gera família
com hash e o SVG cairia no fallback Arial). O lockup é **reconstruído em HTML**: símbolo
(componente) + texto real em Archivo. Medidas em `em`, com o `font-size` do container como
base (`64px`; `56px` abaixo de 400px de viewport):

| Elemento | Valor |
|---|---|
| símbolo | `1em` |
| gap símbolo ↔ texto | `0.25em` |
| "ITC" | Archivo 600, uppercase, `0.1875em`, `tracking 0.42em`, `text-itc-ciano-7` |
| "NoteScan" | Archivo 800, `0.625em`, `tracking -0.025em`, `text-foreground` |
| gap entre linhas | `0.125em` |

**Exceção de hex literal** (o DS proíbe hex direto — §13). Autorizada **apenas** em: o
componente de marca (`NoteScanLogo`), o `capacitor-shell/offline.html` (HTML estático fora
do Tailwind) e os recursos XML do Android (`colors.xml`, `ic_launcher_background`).

**Splash / ícones nativos.** Splash adaptativo ao tema do sistema por qualificador `-night`,
com paridade de tom **`#F5F0E8` (claro) / `#1B1B1B` (escuro)** — igual ao `themeColor` do
`viewport` web. Launcher adaptativo com fundo `#003C3F`.

---

## 4. Espaçamento, raio e sombra

**Escala (base 4px):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48

| Context | Valor | Uso |
|---|---|---|
| micro | 4–8px | gap ícone/texto, badge/label |
| component | 12–16px | padding interno de card, button, input |
| section | 20–24px | `space-y-6` entre seções |
| major | 32–48px | separação entre áreas |

**Densidade:** Admin `p-4 md:p-6` no main, `p-4` em cards. Mobile `p-3` em cards, `gap-3` em grids.

**Raio** (escala do `globals.css`, base `--radius: 0.625rem`): `rounded-md` inputs/buttons · `rounded-lg` cards/containers · `rounded-xl` cards mobile/modais · `rounded-2xl` CTA mobile · `rounded-full` avatares/badges. Regra concêntrica: `raioExterno = raioInterno + padding`.

**Sombras:** o `globals.css` atual **não define** `--shadow-1`/`--shadow-2` (estratégia
histórica borders-only). A v3.1 adota sombras sutis:
- `shadow-1` — `0 1px 3px rgb(0 0 0 / 0.08)` claro · `0 1px 3px rgb(0 0 0 / 0.35)` escuro — cards
- `shadow-2` — `0 8px 32px rgb(0 0 0 / 0.12)` claro · `0 12px 42px rgb(0 0 0 / 0.5)` escuro — modais

> Para usar via utilitário Tailwind, **adicionar** `--shadow-1`/`--shadow-2` ao `:root` e `.dark`
> e registrá-los no `@theme inline` (`--shadow-1`, `--shadow-2`). Bordas continuam presentes —
> sombra complementa, não substitui.

---

## 5. Componentes

### Botões (altura mín. 48px mobile / 40px desktop)
- **Primário:** `bg-primary` (`--itc-ciano-7`), texto branco. Hover `--itc-ciano-8`, pressed `--itc-ciano-9`.
- **Secundário:** `bg-card` + `border-border`, texto ciano.
- **Ghost:** transparente, texto ciano, hover `bg-itc-ciano-7/10`.
- **Destrutivo:** `bg-destructive` + `ConfirmationDialog`.
- **Desabilitado:** `bg-muted`, 50% opacidade.

### Inputs (altura 48px mobile)
- Default: `border-border`, fundo `bg-muted` ou `bg-background`. Foco: border ciano + ring `bg-itc-ciano-7/10`. Erro: border/ring `--itc-erro` + mensagem abaixo.

### Stepper
- Botões −/+ de **44px**, valor central `tabular-nums`. Periféricos (Mouse, Carregador, Fone) — cada linha mantém seu ícone.

### StatCard (Dashboard)
```
padding p-4, space-y-3. Título text-sm/text-muted-foreground. Valor text-2xl/tabular-nums.
Ícone h-4 w-4 em container rounded-md p-1.5.
Ícone segue a variante:
  default → text-itc-ciano-7, container bg-itc-ciano-7/10
  warning → text-itc-atencao, container bg-itc-atencao/10
  error   → text-itc-erro,    container bg-itc-erro/10
Clicável = <button> ou <div role="button" tabIndex={0}> com onKeyDown.
```

### ConferenceRow (Início mobile)
```
Container: rounded-xl border border-border bg-card px-3 py-3 (+ shadow-1)
Dot de projeto: h-2 w-2 rounded-full (cor via style)
UM: text-sm font-medium text-foreground. Data: text-xs text-muted-foreground tabular-nums.
Badge COMPLETO: bg-itc-sucesso/15 text-itc-sucesso border-itc-sucesso/30
Badge INCOMPLETO: bg-itc-erro/10 text-itc-erro border-itc-erro/30
Contagem: text-xs text-muted-foreground tabular-nums
```

### Badges de status e conectividade (pill, outline, glow sutil)
- `COMPLETO` / `ONLINE` → `--itc-sucesso` (verde)
- `INCOMPLETO` / `OFFLINE` → `--itc-erro` (vermelho)
- `EM MANUTENÇÃO` → `--itc-atencao` (amarelo)

### Modais — SEMPRE `<Dialog>` do shadcn/Radix
Nunca div overlay customizado. Overlay `bg-black/60` (escurece a câmera no scanner).
Mobile bottom-sheet: `DialogContent` com `rounded-t-2xl`.

### Modal de resumo
- Componente único (`ConferenceSummary`) reutilizado pelo técnico (Resumo) e pelo admin (botão **Ver**).

### DataTable
```
Container rounded-lg border border-border overflow-hidden. Header com sort button type="button".
Paginação só quando pageCount > 1. pageSize 10 (dashboard) / 20 (relatórios).
```

### Loaders
Skeleton `bg-muted animate-pulse rounded-xl`.

---

## 6. Telas

Todas em tema **claro e escuro**. Referência visual em `design-reference/screenshots/`.

**Mobile (fluxo do técnico):**
1. **Login** — logo ITC, email/senha, botão primário ciano.
2. **Início do técnico** — 3 cards de stats (meta/completas/incompletas), badge Online/Offline, botão INICIAR CONFERÊNCIA, histórico.
3. **Seleção de UM** — select grande, card Cadastrados/Ativos/Em Manutenção (amarelo) com ícones.
4. **Scanner** — split-screen: câmera ao vivo, faixa de manutenção **amarela** com botão **Ver**, listas pendentes|escaneados com scroll independente, footer Reiniciar/Próximo/Flash. Botão **voltar**.
5. **Periféricos** — steppers com ícones, indicador da UM, botão FINALIZAR. Botão **voltar**.
6. **Resumo** — stats (escaneados/faltantes/**manutenção amarela**), periféricos, listas de faltantes e de manutenção, localização (link Google Maps), botão CONCLUIR E ENVIAR. Botão **voltar**.

**Desktop (painel admin, claro e escuro):**
7. **Dashboard** — stat cards + tabela "Últimas conferências".
   Colunas: **Data** (data em destaque, horário início–fim menor abaixo) · **Técnico** · **Projeto/UM** · **Contagem** (Ativos/Lidos) · **Status** (badge COMPLETO verde / INCOMPLETO vermelho) · **Localidade** (botão **Abrir mapa** → Google Maps) · **Resumo** (botão **Ver** → modal do técnico).
   Demais páginas no mesmo padrão: **Relatórios, Projetos, Unidades Móveis, Notebooks, Notificações, Usuários.**

---

## 7. Layout

### Admin (desktop)
```
SidebarProvider → AppSidebar (collapsible="icon")
  SidebarHeader: logo 28px + "NoteScan"
  SidebarContent: nav com isActive
  SidebarFooter: ThemeToggle + UserDropdown
div.flex-1 → header (sticky, bg-card, border-b): SidebarTrigger apenas
             main.admin-main: p-4 md:p-6
```
Header bar: APENAS o `SidebarTrigger` — sem repetir "NoteScan".

### User/mobile
```
div.min-h-screen.bg-background
  header (sticky, bg-card, border-b): logo + nome + logout
  main.flex-1.pb-16
  nav (fixed bottom, bg-card, border-t): Início + Scanner
```

### Scanner APK — modo nativo (`body.scanner-active`)
Header e nav ocultados; wrappers transparentes; overlay split-screen (header opaco / câmera transparente / listas opacas / footer opaco). Dialogs reafirmam fundo sobre a câmera (overlay `rgba(0,0,0,0.6)`, content `var(--popover)`).

---

## 8. Ícones

Lucide React exclusivamente.

| Contexto | Size | Stroke |
|---|---|---|
| Nav sidebar | h-4 w-4 | 1.5 |
| Estado (OK/erro) | h-4 w-4 | padrão |
| CTA mobile | h-7 w-7 | padrão |
| Badge/inline | h-3 / h-3.5 | padrão |
| Nav ativo (bottom) | h-5 w-5 | stroke-[2.25] |

Nav ativo sidebar: `text-itc-ciano-7`. Semânticos: Laptop (ativos), Mouse/BatteryCharging/Headphones (periféricos), CheckCircle2 (completo), XCircle (incompleto), Wrench (manutenção — amarelo).

---

## 9. Motion

- `page-transition`: `fadeInUp 200ms ease forwards` na raiz de cada página (keyframe já no `globals.css`)
- CTA mobile: `active:scale-[0.98] transition-transform`
- Hover cards desktop: `hover:bg-muted/30 transition-colors`
- Sem animações em ações repetidas (scan, clique de tabela)
- Durações: < 200ms micro, < 300ms transições de tela

---

## 10. Acessibilidade — invioláveis

1. Nunca `<div onClick>` sem `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space)
2. Modais sempre via `<Dialog>` (Radix)
3. Botões de formulário sempre `type="button"` exceto submit
4. Ícones decorativos `aria-hidden="true"`
5. Hit areas mínimas 44×44px (mobile)

---

## 11. Aplicação no `globals.css` (NÃO sobrescrever o arquivo)

O `globals.css` do projeto já é completo e estruturado: paleta ITC em escalas, `@theme inline`
com todos os aliases shadcn/charts/sidebar/radius, lógica do scanner nativo, `.admin-main`,
keyframes. **NÃO colar um bloco novo por cima.** Aplicar a v3.1 é editar valores pontuais:

**Edições no `:root` (modo claro) — apenas trocar os valores:**
```
--background:      #F5EFE6 → #F5F0E8
--card:            #EDE8DE → #FDFBF7
--popover:         #F2EDE6 → #FDFBF7
--secondary:       #E8E2D9 → #EBE4D8
--muted:           #E8E2D9 → #EBE4D8
--border:          #D4CEC5 → #D8DEDE
--input:           #D4CEC5 → #D8DEDE
--sidebar:         #E5DDD4 → #FDFBF7
--sidebar-border:  #D4CEC5 → #D8DEDE
```

**Edição no `.admin-main`:**
```
background-color: #f5efe6 → #f5f0e8   (regra .admin-main, modo claro)
.dark .admin-main permanece #1b1b1b
```

**Modo escuro (`.dark`):** manter como está (escala de neutros institucional).
Opcional: adicionar valores dark das funcionais (seção 2.2) se a validação apontar contraste baixo.

**Sombras (se adotadas):** adicionar `--shadow-1` e `--shadow-2` ao `:root` e `.dark`
(valores na seção 4) e registrá-los no `@theme inline`.

**Tipografia:** manter `--font-sans`/`--font-heading` (Inter). Remover `--font-mono` só
após eliminar todos os usos de `font-mono` nos componentes.

**Preservar intactos:** escalas `--itc-ciano-*`, `--itc-bordo-*`, neutros, funcionais,
charts, sidebar-*, radius, todo o `@theme inline` existente, scanner nativo, keyframes.

---

## 12. Regras rápidas

- Nunca hex direto — sempre tokens (`bg-card`, `text-itc-sucesso`, `text-itc-atencao`).
- Nunca branco puro; fundo sempre `bg-background`.
- Ciano só em ação primária; **manutenção sempre amarela (`--itc-atencao`)**.
- Alvos ≥ 44px; números e hostnames sempre `tabular-nums` (Inter, sem mono).
- Archivo só na marca; Inter em toda a UI.
- Tailwind v4: `text-itc-sucesso`, nunca `text-[--itc-sucesso]`.
- Modais via `<Dialog>`; overlay `bg-black/60`.
- Localidade no admin = botão que abre `https://www.google.com/maps?q=<lat>,<lng>`.

---

## 13. Não fazer

```
❌ bg-white, bg-black             → bg-background, bg-card, bg-foreground
❌ text-green-500                 → text-itc-sucesso
❌ manutenção em azul (info)      → manutenção SEMPRE --itc-atencao (amarelo)
❌ font-mono / JetBrains Mono     → Inter com tabular-nums
❌ border-gray-200                → border-border
❌ múltiplas cores de acento      → apenas --itc-ciano-7
❌ div overlay custom como modal  → sempre <Dialog>
❌ <button> sem type explícito    → type="button" ou type="submit"
❌ text-[--itc-sucesso]           → quebra no v4; usar text-itc-sucesso
❌ colar bloco CSS novo por cima do globals.css → editar valores pontuais (seção 11)
❌ <text> com Archivo dentro de SVG → nome do app sempre como texto HTML
❌ converter o wordmark em curvas → texto real em Archivo, sempre
```

---

## 14. Histórico

### Auditoria (2026-07-14) — corrigida
| # | Arquivo | Problema | Status |
|---|---|---|---|
| 1 | dashboard StatCard | Ícone não respeitava variante | ✅ |
| 2 | inicio | 3 modais hand-rolled → `<Dialog>` | ✅ |
| 3 | dashboard StatCard | `<div onClick>` → `<button>` | ✅ |
| 4 | inicio | `green-500` → `--itc-sucesso` | ✅ |
| 5 | AdminLayout | "NoteScan" duplicado removido do header | ✅ |
| 6 | dashboard | Card "hoje" `col-span-2` mobile | ✅ |

### v3.1 — consolidação da identidade (a implementar)
- Superfícies atualizadas para off-white do Claude Design (valores editados no `:root`, sem trocar tokens).
- Tipografia: JetBrains Mono descontinuado; dados técnicos passam a Inter + `tabular-nums`.
- Sombras sutis (`shadow-1`/`shadow-2`) adotadas; bordas mantidas.
- Regra reforçada: manutenção sempre amarela.
- Vocabulário de tokens mantido — escalas ITC e `@theme inline` preservados.

### Marca "Mira" (2026-07-30)
- Símbolo Mira (4 cantos de mira + miolo) como componente `NoteScanLogo`; lockup em HTML (Archivo real, nunca `<text>` em SVG).
- Login unificado (uma estrutura só web/mobile) com lockup centralizado + card.
- Favicons/app icons/PWA manifest, launcher adaptativo (`#003C3F`) e splash adaptativo por `-night` (`#F5F0E8`/`#1B1B1B`).
- Exceção de hex literal formalizada para marca, `offline.html` e XML do Android.
