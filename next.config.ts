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
};

export default withMDX(nextConfig);