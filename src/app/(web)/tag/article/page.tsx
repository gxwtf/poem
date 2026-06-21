// 读书课标签页面
import { notFound } from 'next/navigation'
import { MDXPreview } from '@/components/mdx-preview'
import { loadMDXWithTOC } from '@/lib/mdx-utils'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `读书课标签 - 广学古诗文`,
    description: `读书课标签概览页面`,
}

export default async function Page() {
    try {
        const { mdxComponent: PreviewMDX, toc } = await loadMDXWithTOC(`tag/article/preview.mdx`);
        return (
            <MDXPreview
                mdxContent={<PreviewMDX />}
                toc={toc}
                now={"标签"}
                headerData={[{ name: "读书课", href: "/articles" }]}
            />
        );
    } catch (error) {
        console.error(error);
        notFound();
    }
}