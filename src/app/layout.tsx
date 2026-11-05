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
      <head>
        {/*
          百度统计（hm.js）。按百度官方要求放在 </head> 之前，一处安装全站生效。
          这里是 poem.gxwtf.cn 专属的站点 ID，与主站 gxwtf.cn 的 ID 不是同一个。
          根布局渲染本应用的全部路由，因此加这一次即可覆盖整个古诗文站。
        */}
        <script
          id="baidu-tongji"
          dangerouslySetInnerHTML={{
            __html: `var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?cbea8a55f6130caa1d6bfb332a27837c";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`,
          }}
        />
      </head>
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