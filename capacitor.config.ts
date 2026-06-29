// Capacitor configuration — read by `npx cap` CLI at build time only, not by Next.js.
// See: https://capacitorjs.com/docs/config

const config = {
  appId: 'com.itcbrasil.notescan',
  appName: 'ITC NoteScan',
  webDir: 'out',
  server: {
    url: 'https://notescan.itcbr.xyz',
    cleartext: false,
    // Allows the WebView to follow 302 redirects (e.g. post-login to /inicio).
    // Without these entries Capacitor intercepts navigations that don't match the
    // server.url exactly and opens them in the external browser instead, causing
    // "This page couldn't load" inside the app.
    // '*.notescan.itcbr.xyz' covers any subdomain; 'notescan.itcbr.xyz' covers
    // the apex domain for all paths (/inicio, /scanner, /dashboard, etc.).
    allowNavigation: ['notescan.itcbr.xyz', '*.notescan.itcbr.xyz'],
  },
  android: {
    minWebViewVersion: 96,
  },
  plugins: {
    // CapacitorHttp must be disabled when using cookie-based auth (NextAuth).
    // When enabled, fetch() uses Android's native HTTP stack with a separate
    // cookie jar from the WebView, so the session cookie set at login is not
    // visible to subsequent page navigations.
    CapacitorHttp: {
      enabled: false,
    },
  },
}

export default config
