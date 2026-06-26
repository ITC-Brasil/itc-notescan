// Capacitor configuration — read by `npx cap` CLI at build time only, not by Next.js.
// See: https://capacitorjs.com/docs/config

const config = {
  appId: 'com.itcbrasil.notescan',
  appName: 'ITC NoteScan',
  webDir: 'out',
  server: {
    url: 'https://notescan.itcbr.xyz',
    cleartext: false,
  },
  android: {
    minWebViewVersion: 96,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
}

export default config
