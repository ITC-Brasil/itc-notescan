# Módulo 7 — Capacitor APK (Android)

**Data de conclusão:** 2026-07-14

---

## O que foi implementado

### Capacitor — Configuração

`capacitor.config.ts`:
```typescript
{
  appId: 'com.itcbrasil.notescan',
  appName: 'ITC NoteScan',
  webDir: 'out',                         // build estático Next.js
  server: {
    url: 'https://notescan.itcbr.xyz',  // app carrega o site de produção
    cleartext: false,
    allowNavigation: ['notescan.itcbr.xyz', '*.notescan.itcbr.xyz'],
  },
  android: { minWebViewVersion: 96 },
  plugins: {
    CapacitorHttp: { enabled: false },   // preserva cookie jar do NextAuth
  },
}
```

O APK carrega o site de produção (`server.url`), não um bundle estático local.
`allowNavigation` cobre o domínio apex e subdomínios para seguir redirects do NextAuth.

### Plugin de câmera — @capacitor-community/barcode-scanner@4.0.1

**Mecanismo nativo:**
O plugin coloca uma `BarcodeView` Android full-screen como sibling do WebView (por trás).
O WebView é trazido para frente (`bringToFront()`). A câmera aparece apenas
onde o WebView tem pixels transparentes (`hideBackground()` torna o WebView transparente).

**Não existe API para redimensionar ou reposicionar a câmera** — ela é sempre full-screen.
A visibilidade é controlada 100% pela transparência dos elementos do WebView.

### NativeQRScanner — Layout em zonas

`src/components/scanner/NativeQRScanner.tsx` — split-screen por transparência:

```
┌─────────────────────────────┐ opaco (rgba(0,0,0,0.82))
│  Header: UM nome + contador │
├─────────────────────────────┤ TRANSPARENTE (câmera visível)
│                             │
│   [  viewfinder 250×250  ]  │ altura: 260px
│                             │
├─────────────────────────────┤ opaco (rgba(192,57,43) ou verde)
│  Feedback de scan           │
├─────────────────────────────┤ opaco (rgba(14,14,14,0.94))
│  Pendentes  │  Escaneados   │ flex: 1, overflow scroll
│  (scroll)   │  (scroll)     │
├─────────────────────────────┤ opaco (rgba(0,0,0,0.82))
│  [Reiniciar] [Próximo]      │
└─────────────────────────────┘
```

`pointer-events: none` no container `.native-scanner-overlay`.
`pointerEvents: 'auto'` nos filhos interativos (header, listas, footer).

### CSS — body.scanner-active

Adicionado ao `globals.css`:
```css
body.scanner-active { background: transparent !important; }
body.scanner-active header, body.scanner-active nav { display: none !important; }
body.scanner-active > div, body.scanner-active main {
  background: transparent !important;
  padding-bottom: 0 !important;
}
```

Aplicado quando o scan nativo inicia, removido ao finalizar.

### QRScanner — Detecção de plataforma

`src/components/scanner/QRScanner.tsx`:
- `usePlatform()`: detecta `'android'` vs `'web'` via `Capacitor.getPlatform()`
- No Android: renderiza `NativeQRScanner` com prop `ui` (split-screen)
- No web/PWA: renderiza `@yudiel/react-qr-scanner` com viewfinder CSS

### PermissionsGate

`src/components/scanner/PermissionsGate.tsx` (ou similar):
- Fluxo de primeira abertura: verifica permissão de câmera
- Se negada: tela de instrução com botão para abrir configurações do sistema
- Se concedida: renderiza o scanner normalmente

### Como gerar o APK

```bash
# 1. Build Next.js estático (não necessário se usando server.url de produção)
# npm run build:export

# 2. Sincronizar com Android
npx cap sync android

# 3. Abrir no Android Studio
npx cap open android

# 4. Build no Android Studio
# Build → Generate Signed Bundle/APK → APK
# Ou via CLI: ./gradlew assembleRelease
```

---

## Verificação executada

- APK instalado em dispositivo Android real
- Câmera abre e exibe a zona transparente corretamente
- QR Codes lidos com sucesso (hostnames retornados pelo callback)
- Listas de pendentes e escaneados visíveis e atualizadas em tempo real
- Botões Reiniciar e Próximo respondem ao toque
- Fluxo completo de conferência executado no APK

---

## Decisões

- `CapacitorHttp: false` → ver [DECISIONS.md m7-03](../DECISIONS.md)
- Layout em zonas com transparência → ver [DECISIONS.md m7-02](../DECISIONS.md)
- `prepare()` removido → ver [DECISIONS.md m7-04](../DECISIONS.md)
- Capacitor v5 + barcode-scanner v4 → ver [DECISIONS.md m7-01](../DECISIONS.md)

---

## Pontos de atenção

- **Não chamar `BarcodeScanner.prepare()` antes de `startScanning()`** — quebra o callback de detecção
- **Elementos na zona da câmera não podem ter background opaco** — bloqueariam a visão da câmera
- **`CapacitorHttp: false` é obrigatório** — habilitá-lo quebra a autenticação NextAuth no APK
- **`server.url` aponta para produção** — o APK não funciona offline (só carrega o site remoto)
- Se o domínio de produção mudar, atualizar `server.url` e `allowNavigation` no `capacitor.config.ts` e regar o APK

---

## Commits

```
3d29299 feat(capacitor): add Android APK support with native camera scanner
681d987 fix(capacitor): disable CapacitorHttp and expand allowNavigation for NextAuth
8544eca fix(deps): downgrade capacitor plugins to v5 to match @capacitor/core@5.7.8
0df4ebe feat(permissions): add PermissionsGate for first-use permission flow
d83defd fix(scanner): use startScanning() with targetedFormats for small QR labels
d6bf06b fix(proxy): replace lookahead matcher with explicit route include list
9e70fba fix(scanner): fix camera not showing and buttons not responding on Android APK
0ca3e35 fix(scanner): fix QR detection and restrict camera to viewfinder area on Android
2ba8ceb feat(scanner): split-screen layout — câmera + listas visíveis simultaneamente
d9ac2d4 fix: regenerate package-lock.json with all transitive dependencies
```
