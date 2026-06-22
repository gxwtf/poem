import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { VersionProvider } from "@/components/version-provider";
import { AlertProvider } from "@/components/alert-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "广学古诗文",
  description: "针对中学生量身定制的专业古诗文学习网站",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`antialiased`}
      >
        <AlertProvider>
          <VersionProvider defaultVersion="senior">
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
                {children}
                <Toaster />
            </ThemeProvider>
          </VersionProvider>
        </AlertProvider>
      </body>
    </html>
  );
}