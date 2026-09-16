import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PWARegister } from "@/components/providers/pwa-register";
import { PwaEntrance } from "@/components/providers/pwa-entrance";
import { ProgressBar } from "@/components/providers/progress-bar";
import { OfflineIndicator } from "@/components/providers/offline-indicator";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "My Classroom - Agus Supriyono, S.Pd.,MM",
  description: "My Classroom - English Learning for SMK Negeri 1 Buduran",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/icons/icon-192x192.png.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "My Classroom",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <PwaEntrance />
          <PWARegister />
          <OfflineIndicator />
          <ProgressBar />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
