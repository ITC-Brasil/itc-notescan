# Interface Design System — ITC NoteScan v2.0

> Decisões de design documentadas. Lido automaticamente pelo Claude Code a cada sessão.
> Atualizar após qualquer mudança estrutural de design.

---

## Produto e usuários

**O que é:** ferramenta operacional de campo para conferência de ativos via QR Code.

**Dois contextos de uso radicalmente distintos:**

| Perfil | Onde | Dispositivo | O que fazem |
|---|---|---|---|
| Técnico (USER) | Campo — sol, dentro de carretas, em movimento | Android (APK) | Escanear notebooks rapidamente, sem erros |
| Gestor (ADMIN/MASTER) | Escritório/remoto | Desktop | Monitorar conferências, gerenciar inventário |

**Feel:** operacional e confiável — não "clean SaaS genérico". Pensa em painel de controle industrial com refinamento visual moderno. Cada dado tem uma função; nada é decorativo.

---

## Paleta de cores

### Tokens primitivos (definidos em `globals.css`)

```css
--itc-ciano-7: #008f95   /* ACENTO PRINCIPAL — usar com parcimônia */
--itc-ciano-6: #17969c   /* acento dark mode */
--itc-bordo-12: #491027  /* acento institucional secundário */

/* Semânticos — SEMPRE usar estes, nunca Tailwind hardcoded */
--itc-sucesso: #1a7f3c   /* status OK, escaneados, positivo */
--itc-atencao: #cc7a00   /* manutenção, aviso */
--itc-erro:    #c0392b   /* faltantes, erro, destrutivo */
--itc-info:    #1565c0   /* informativo */
```

### Tokens de superfície — modo claro

```css
--background: #F5EFE6    /* canvas principal */
--card:        #EDE8DE    /* cards, painéis, headers */
--sidebar:     #E5DDD4    /* sidebar */
--muted:       #E8E2D9    /* fundo de inputs, áreas secundárias */
--border:      #D4CEC5    /* bordas padrão */
```

### Tokens de superfície — modo escuro

```css
--background: #1b1b1b
--card:        #2c2c2c
--sidebar:     #2c2c2c
--muted:       #3e3e3e
--border:      #3e3e3e   /* rgba(255,255,255,0.08) no espírito */
```

### Regra de uso de cor — 60/30/10

- **~60%** superfícies neutras (`background`, `card`, `muted`)
- **~30%** texto e bordas (`foreground`, `border`, `muted-foreground`)
- **~10%** acento (`--itc-ciano-7`) — somente em ações primárias, ícones ativos, indicadores

### Cores semânticas — contrato obrigatório

**SEMPRE usar o token ITC. NUNCA usar Tailwind hardcoded para semântica.**

⚠️ **Tailwind v4:** os tokens são registrados em `@theme inline` (`--color-itc-*`),
então use o utilitário nomeado `text-itc-sucesso`. **NUNCA** a sintaxe de colchete
`text-[--itc-sucesso]` — no v4 ela compila `color: --itc-sucesso` (sem `var()`),
CSS inválido que o navegador ignora silenciosamente.

```
✅ text-itc-sucesso              ❌ text-[--itc-sucesso]  (quebra no v4)
✅ border-itc-sucesso/30         ❌ text-green-500
✅ bg-itc-sucesso/10             ❌ bg-green-500/5
✅ text-itc-erro                 ❌ text-red-500
✅ text-destructive              ✅ (alias para --itc-erro no tema)
```

**Hierarquia de texto — quatro tons:**

| Token | Uso |
|---|---|
| `text-foreground` | Valores principais, títulos, dados críticos |
| `text-foreground/70` | Subtítulos, rótulos secundários |
| `text-muted-foreground` | Metadados, datas, rótulos de campos |
| `text-muted-foreground/60` | Captions, textos desabilitados |

---

## Tipografia

**Fontes:** Inter (sans, interface) · JetBrains Mono (mono, hostnames/serials/códigos)

**Escala de tamanhos — ratio ~1.25 (minor third):**

| Step | px | Uso |
|---|---|---|
| caption | 11px (`text-xs` ≈ 12px) | metadados, timestamps, labels de badges |
| body | 14px (`text-sm`) | conteúdo padrão de interface |
| body-md | 16px (`text-base`) | corpo de formulários, texto importante |
| h4 | 18px (`text-lg`) | subtítulos de seção |
| h3 | 22px (`text-xl`→`text-2xl`) | valores de métricas, números grandes |
| h2 | 28px | títulos de página (PageHeader) |

**Hierarquia de peso — três levers juntos (size + weight + color):**

```
Valor de métrica:  text-2xl / font-bold (700) / text-foreground / tabular-nums
Título de seção:   text-sm / font-medium (500) / text-foreground/70 / tracking-wide uppercase
Label de campo:    text-xs / font-medium (500) / text-muted-foreground / uppercase tracking-wider
Dado de tabela:    text-sm / font-normal (400) / text-foreground
Meta / caption:    text-xs / font-normal (400) / text-muted-foreground
```

**Regras:**
- Números dinâmicos (contadores, métricas, timestamps de tabela): sempre `font-variant-numeric: tabular-nums` → classe `tabular-nums`
- Hostnames e seriais: sempre `font-mono` (JetBrains Mono)
- Headings grandes: `tracking-tight` (−0.02em)
- Rótulos uppercase pequenos: `tracking-wider` (+0.08em)

---

## Espaçamento

**Base unit: 4px**. Múltiplos apenas.

| Context | Valor | Uso |
|---|---|---|
| micro | 4–8px | gap entre ícone e texto, gap entre badge e label |
| component | 12–16px | padding interno de card, button, input |
| section | 20–24px | `space-y-6` entre seções de página |
| major | 32–48px | separação entre áreas distintas |

**Densidade por contexto:**
- Admin (desktop): conteúdo arejado — `p-4 md:p-6` no main, `p-4` em cards
- User/mobile: compacto — `p-3` em cards de conferência, `gap-3` em grids

---

## Profundidade — estratégia borders-only

**Uma estratégia, zero exceções.** Não misturar com box-shadow de elevação.

```
Bordas padrão:    border-border           (var --border)
Bordas semânticas: border-[token]/20–30  (baixa opacidade)
Divisores:        divide-border
```

**Sem `box-shadow` de elevação** (exceto `shadow-sm` no card de login — aceitável por ser contexto de landing).

**Sidebar:** mesmo background que o canvas (`--background`/`--card`), separada só por `border-r border-border`. Nunca cor diferente — fragmenta o espaço.

**Inputs:** ligeiramente mais escuros que o fundo (`bg-muted` ou `bg-background` com borda visível). Sinalizam "recebe conteúdo".

---

## Border radius — escala

| Elemento | Radius | Token Tailwind |
|---|---|---|
| Ícones pequenos, badges | 4–6px | `rounded` / `rounded-md` |
| Inputs, buttons | 6px | `rounded-md` |
| Cards, containers | 8–10px | `rounded-lg` |
| Cards mobile (conference rows) | 12px | `rounded-xl` |
| CTA primário mobile | 16px | `rounded-2xl` |
| Modais | 12–16px | `rounded-xl` |
| Avatares | 50% | `rounded-full` |

**Regra concêntrica:** `raioExterno = raioInterno + padding`. Se um ícone de 28px com `p-1.5` (6px padding) está dentro de um container, o container deve ter `rounded-lg` (8px) e o container interno do ícone pode ter `rounded-md` (6px).

---

## Componentes — padrões documentados

### StatCard (Dashboard)

```tsx
// Dimensões: padding p-4, space-y-3 interno
// Título: text-sm / text-muted-foreground
// Valor: text-2xl / font-semibold / tabular-nums
// Ícone: h-4 w-4, dentro de container rounded-md p-1.5

// REGRA: ícone DEVE seguir a variante
variant="default"  → icon color: text-itc-ciano-7,  container: bg-itc-ciano-7/10
variant="warning"  → icon color: text-itc-atencao,  container: bg-itc-atencao/10
variant="error"    → icon color: text-itc-erro,     container: bg-itc-erro/10

// REGRA: StatCard clicável deve ser <button> ou <div role="button" tabIndex={0}>
// com onKeyDown para Enter/Space — nunca <div onClick> sem ARIA
```

### ConferenceRow (Início mobile)

```
Container: rounded-xl border border-border bg-card px-3 py-3
Dot de projeto: h-2 w-2 rounded-full (cor do projeto via style)
UM nome: text-sm font-medium text-foreground
Data: text-xs text-muted-foreground
Badge OK: bg-itc-sucesso/15 text-itc-sucesso border-itc-sucesso/30
Badge INCOMPLETO: bg-itc-erro/10 text-itc-erro border-itc-erro/30
Contagem: text-xs text-muted-foreground tabular-nums
```

### Modais — SEMPRE usar <Dialog> do shadcn/Radix

O projeto tem `@/components/ui/dialog` instalado. **Nunca criar div overlay customizado.**

```tsx
// ✅ Correto
<Dialog open={open} onOpenChange={onOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>
    {/* conteúdo */}
  </DialogContent>
</Dialog>

// ❌ Errado — sem focus trap, sem Escape, sem ARIA
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
  <div className="...">...</div>
</div>
```

**Mobile bottom-sheet:** usar `DialogContent` com `className` customizado para `rounded-t-2xl` na parte inferior, ou Vaul se necessário. Não reinventar.

### Botões de ação inline (tabela, cards)

```
Tier 1 — ação primária: <Button variant="default"> (bg-primary)
Tier 2 — ação secundária: <Button variant="outline"> ou <Button variant="ghost">
Tier 3 — ação destrutiva: <Button variant="destructive"> com ConfirmationDialog
```

Nunca `<button className="text-xs px-2 py-0.5 ...">` se um `<Button size="sm" variant="outline">` já existe.

### DataTable

```
Container: rounded-lg border border-border overflow-hidden
Header: TableHead com sort button (type="button" explícito)
Paginação: só aparece quando pageCount > 1
Density admin: pageSize={10} (dashboard), pageSize={20} (relatórios)
```

### Loader states

```
Card skeleton: SkeletonCard (bg-muted animate-pulse rounded-xl)
Tabela skeleton: SkeletonTable com rows parametrizável
Inline (mobile): h-16 rounded-xl bg-muted animate-pulse
```

---

## Layout — estrutura

### Admin (desktop)

```
SidebarProvider
  └── AppSidebar (collapsible="icon")
        SidebarHeader: logo 28px + "NoteScan"
        SidebarContent: nav items com isActive
        SidebarFooter: ThemeToggle + UserDropdown
  └── div.flex-1
        header (sticky, bg-card, border-b): SidebarTrigger apenas
        main.admin-main: p-4 md:p-6
```

**Header bar**: deve conter APENAS o `SidebarTrigger` — sem repetir "NoteScan" (já está na sidebar). Quando a sidebar está visível, duplicar o nome é ruído.

### User/mobile

```
div.min-h-screen.bg-background
  header (sticky, bg-card, border-b): logo + nome do usuário + logout
  main.flex-1.pb-16: conteúdo
  nav (fixed bottom, bg-card, border-t): Início + Scanner
```

### Scanner APK — modo nativo

Durante scanning nativo (`body.scanner-active`):
- Header e nav ocultados (`display: none`)
- Wrappers transparentes
- Overlay split-screen: header opaco / câmera transparente / listas opacas / footer opaco

---

## Ícones

**Biblioteca:** Lucide React exclusivamente. Tamanhos:

| Contexto | Size | Stroke |
|---|---|---|
| Nav sidebar | h-4 w-4 | padrão (1.5) |
| Ícone de estado (OK/erro) | h-4 w-4 | padrão |
| CTA principal mobile | h-7 w-7 | padrão |
| Badge/inline | h-3 w-3 ou h-3.5 w-3.5 | padrão |
| Nav ativo (bottom) | h-5 w-5 | stroke-[2.25] |

Ícone ativo na nav bottom: `stroke-[2.25]` (mais pesado). Ícone ativo na sidebar: `text-itc-ciano-7`.

---

## Motion

- `page-transition`: `animation: fadeInUp 200ms ease forwards` — aplicado na div raiz de cada página
- CTA mobile: `active:scale-[0.98] transition-transform` — feedback tátil
- Hover em cards desktop: `hover:bg-muted/30 transition-colors` — 150ms implícito do Tailwind
- **Sem animações em ações repetidas** (scan, clique em botão de tabela)
- Durações UI: < 200ms para micro-interações, < 300ms para transições de tela

---

## Acessibilidade — regras invioláveis

1. **Nunca `<div onClick>`** sem `role="button"`, `tabIndex={0}` e `onKeyDown` para Enter/Space
2. **Modais sempre via `<Dialog>`** (Radix) — nunca div overlay customizado
3. **Botões de formulário**: sempre `type="button"` explícito exceto o submit
4. **Ícones decorativos**: `aria-hidden="true"` (Lucide já inclui por padrão)
5. **Hit areas mínimas**: 40×40px (WCAG 44×44px recomendado)

---

## Tokens — o que NÃO fazer

```
❌ bg-white, bg-black             → usar bg-background, bg-card, bg-foreground
❌ text-green-500                 → usar text-itc-sucesso
❌ border-gray-200                → usar border-border
❌ text-gray-500                  → usar text-muted-foreground
❌ shadow-lg em cards             → estratégia é borders-only
❌ múltiplas cores de acento      → apenas --itc-ciano-7 como acento primário
❌ div overlay custom como modal  → sempre <Dialog>
❌ <button> sem type explícito    → sempre type="button" ou type="submit"
```

---

## Auditoria (2026-07-14) — achados corrigidos

Todos os achados da auditoria foram corrigidos:

| # | Arquivo | Problema | Status |
|---|---|---|---|
| 1 | `dashboard/page.tsx` StatCard | Ícone não respeitava variante (sempre cyan) | ✅ Corrigido |
| 2 | `(user)/inicio/page.tsx` | 3 modais hand-rolled migrados para `<Dialog>` (bottom-sheet via className) | ✅ Corrigido |
| 3 | `dashboard/page.tsx` StatCard | `<div onClick>` virou `<button type="button">` | ✅ Corrigido |
| 4 | `(user)/inicio/page.tsx` | `green-500` hardcoded → `--itc-sucesso` | ✅ Corrigido |
| 5 | `AdminLayout.tsx` header | "NoteScan" duplicado removido do header bar | ✅ Corrigido |
| 6 | `dashboard/page.tsx` | Card "Conferências hoje" agora `col-span-2` no mobile — focal point + fim do orphan | ✅ Corrigido |
