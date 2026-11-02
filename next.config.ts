// next.config.ts
import type { NextConfig } from "next";
import createMDX from '@next/mdx';
import path from 'path';

const withMDX = createMDX({
    extension: /\.(md|mdx)$/,
    options: {
        remarkPlugins: ['remark-gfm'],
    }
});

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: '**',
                port: '',
                pathname: '/**',
            }
        ],
    },
    pageExtensions: ['ts', 'tsx', 'md', 'mdx', 'js', 'jsx'],
    // 开发环境的左下角悬浮指示器会挡住页面底部的按钮（背诵悬浮按钮/字母键盘），关掉
    devIndicators: false,
};

export default withMDX(nextConfig);