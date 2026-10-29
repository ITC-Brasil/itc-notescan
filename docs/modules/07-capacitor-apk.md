# Módulo 7 — Capacitor APK (Android)

**Data de conclusão inicial:** 2026-07-14 · **Última atualização:** 2026-07-21

> **Estado atual:** Capacitor **7.x** + `@capacitor-mlkit/barcode-scanning@7.5`.
> A versão inicial (Capacitor 5 + `@capacitor-community/barcode-scanner@4`) foi
> substituída — ver DECISIONS [m7-05](../DECISIONS.md). Este documento reflete o estado atual.

---

## O que foi implementado

### Capacitor — Configuração

`capacitor.config.ts`:
```typescript
{
  appId: 'com.itcbrasil.notescan',
  appName: 'ITC NoteScan',
  webDir: 'capacitor-shell',             // só o fallback offline.html (não é o app)
  server: {
    url: 'https://notescan.itcbr.xyz',  // app carrega o site de produção
    cleartext: false,
    errorPath: 'offline.html',           // tela offline em vez do erro nativo do WebView
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
`webDir` aponta para `capacitor-shell/` (versionado), que contém apenas o
`offline.html` exibido via `server.errorPath` quando não há rede (ver [m7-06](../DECISIONS.md)).

### Plugin de câmera — @capacitor-mlkit/barcode-scanning@7.5

**Mecanismo nativo:**
O plugin usa ML Kit + CameraX. Cria sua própria `PreviewView` full-screen atrás do
WebView; a câmera aparece onde o WebView tem pixels transparentes. `startScan()`
inicia a sessão e o evento **`barcodesScanned`** entrega **todos** os QR detectados
em cada frame (leitura em lote). Usa `resolution: Resolution['1920x1080']` para
tornar QR pequenos legíveis no mesmo frame.

**Flash:** `isTorchAvailable()` mostra o botão só em aparelhos capazes; `toggleTorch()`
liga/desliga durante o scan.

**Retomada:** um listener de `visibilitychange` reinicia o scan ao voltar do
background (o preview congela quando o Android libera a câmera) — ver [m7-07](../DECISIONS.md).

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

### Bloqueio biométrico + persistência de sessão

- **`BiometricGate`** (`src/components/BiometricGate.tsx`, `@capgo/capacitor-native-biometric`):
  trava a UI por digital no **cold start** (montado no layout do técnico, não
  re-dispara no resume). Fallback para aparelhos sem biometria. Permissão
  `USE_BIOMETRIC` no Manifest. Ver [m3-02](../DECISIONS.md).
- **Sessão de 7 dias:** `MainActivity` faz `setAcceptCookie(true)` no `onCreate` e
  `CookieManager.flush()` em `onPause`/`onStop`; o `SessionProvider` não revalida no
  foco. Ver [m7-08](../DECISIONS.md).

### Como gerar o APK

Requer **JDK 21** — Capacitor 8, Gradle 8.14.5, AGP 8.13.0, SDK mín/alvo 24/36.
Use o Eclipse Adoptium (`C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`):
o JBR do Android Studio muda de pasta a cada reinstalação.

```bash
# 1. Sincronizar o site remoto + plugins com o projeto Android
npx cap sync android

# 2. Build de release assinado (o que vai para os técnicos)
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

**Assinatura:** o `signingConfig` de release lê `android/keystore.properties`
(fora do git) com `storeFile`, `storePassword`, `keyAlias` e `keyPassword`. O keystore
fica fora do repositório (`C:/Users/mathe/keystores/notescan-release.jks`, alias
`notescan`). Sem o `keystore.properties`, o build gera `app-release-unsigned.apk`.
Certificado (SHA-256): `9671e48467328b6314ead3d709f2fcae5063f0c579d227a1330f5abf6b24adf9`.
Ver [m7-11](../DECISIONS.md).

⚠️ **Keystore e senha precisam de backup** (cofre de senhas + cópia offline). Sem eles,
nenhum APK futuro instala por cima do atual: cada técnico teria que desinstalar e
perder os dados locais.

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

- Capacitor 7 + `@capacitor-mlkit/barcode-scanning` (leitura em lote) → [m7-05](../DECISIONS.md)
- Capacitor 8 + assinatura de release → [m7-11](../DECISIONS.md)
- Página offline via `server.errorPath` → [m7-06](../DECISIONS.md)
- Retomada da câmera no foreground → [m7-07](../DECISIONS.md)
- Persistência de sessão (cookie flush + sem revalidação no foco) → [m7-08](../DECISIONS.md)
- Biometria como tela de bloqueio → [m3-02](../DECISIONS.md)
- Layout em zonas com transparência → [m7-02](../DECISIONS.md)
- `CapacitorHttp: false` → [m7-03](../DECISIONS.md)
- _(histórico)_ Capacitor v5 + community scanner [m7-01](../DECISIONS.md); `prepare()` removido [m7-04](../DECISIONS.md)

---

## Pontos de atenção

- **Build exige JDK 21** (Eclipse Adoptium); o projeto `android/` é versionado, exceto `keystore.properties`.
- **Elementos na zona da câmera não podem ter background opaco** — bloqueariam a visão da câmera.
- **`CapacitorHttp: false` é obrigatório** — habilitá-lo quebra a autenticação NextAuth no APK.
- **`server.url` aponta para produção** — o APK carrega o site remoto; sem rede exibe `offline.html`.
- Mudanças em web (ícones, meta diária, paginação etc.) chegam via **deploy**; mudanças nativas
  (plugins, `MainActivity`, Manifest) exigem **rebuild do APK**.
- Se o domínio de produção mudar, atualizar `server.url` e `allowNavigation` no `capacitor.config.ts` e regerar o APK.

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
