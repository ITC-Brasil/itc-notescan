import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Archivo } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/providers/SessionProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Archivo — reservada à marca/logo (Design System v3.1). 600 "ITC", 700 sidebar/
// header, 800 "NoteScan" do lockup.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "ITC NoteScan",
  description: "Sistema de conferência de ativos via QR Code — ITC Brasil",
  manifest: "/manifest.json",
};

// viewport-fit=cover exposes the Android 15 edge-to-edge status/nav bar heights
// as env(safe-area-inset-*), which the layouts pad against.
// themeColor adaptativo: par claro/escuro (o manifest só aceita um valor; é este
// aqui que o navegador usa em runtime). Casa com o splash nativo (#F5F0E8 / #1B1B1B).
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#1B1B1B" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} ${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" storageKey="itc-notescan-theme" enableSystem disableTransitionOnChange>
          <SessionProvider>
            <QueryProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
              <Toaster position="bottom-center" richColors />
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
