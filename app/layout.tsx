import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PWARegister } from "@/components/providers/pwa-register";
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
    icon: "/icons/icon-512x512.png.png",
    apple: "/icons/icon-192x192.png.png",
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
  themeColor: "#2563eb",
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
          <PWARegister />
          <OfflineIndicator />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
