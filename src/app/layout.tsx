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

/**
 * 百度统计（hm.js）站点 ID。由环境变量开关控制：
 * - 生产（服务器 .env）配置了 NEXT_PUBLIC_BAIDU_TONGJI_ID ⇒ 注入统计脚本；
 * - 本地开发未配置 ⇒ 不渲染任何统计代码，既不上报也不污染线上统计数据。
 *
 * 注意：NEXT_PUBLIC_ 前缀的值在 `next build` 时内联进产物，所以开关需要在
 * 构建环境里生效（本项目就是在服务器上构建的，符合该模式）。
 */
const BAIDU_TONGJI_ID = process.env.NEXT_PUBLIC_BAIDU_TONGJI_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {BAIDU_TONGJI_ID ? (
        <head>
          {/*
            按百度官方要求放在 </head> 之前，一处安装全站生效。
            根布局渲染本应用的全部路由，因此加这一次即可覆盖整个古诗文站。
          */}
          <script
            id="baidu-tongji"
            dangerouslySetInnerHTML={{
              __html: `var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?${BAIDU_TONGJI_ID}";
  var s = document.getElementsByTagName("script")[0];
  s.parentNode.insertBefore(hm, s);
})();`,
            }}
          />
        </head>
      ) : null}
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