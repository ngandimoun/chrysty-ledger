import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { LedgerProvider } from "@/contexts/ledger-context";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { WorkspaceSidebarProvider } from "@/contexts/workspace-sidebar-context";
import { ChatAssetRefsProvider } from "@/contexts/chat-asset-refs-context";
import { QueryProvider } from "@/providers/query-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chrysty AI Ledger",
  description: "Small business accounting, powered by AI",
  other: {
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      translate="no"
      className={`notranslate ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="notranslate min-h-dvh overflow-x-hidden antialiased" translate="no">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          storageKey="chrysty-theme"
          disableTransitionOnChange
        >
          <QueryProvider>
            <LedgerProvider>
              <WorkspaceProvider>
                <WorkspaceSidebarProvider>
                  <ChatAssetRefsProvider>
                    <AppShell>{children}</AppShell>
                  </ChatAssetRefsProvider>
                </WorkspaceSidebarProvider>
              </WorkspaceProvider>
            </LedgerProvider>
          </QueryProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
