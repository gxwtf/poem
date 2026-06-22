// 古诗文标签页面
import { notFound } from 'next/navigation'
import { MDXPreview } from '@/components/mdx-preview'
import { loadMDXWithTOC } from '@/lib/mdx-utils'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `古诗文标签 - 广学古诗文`,
    description: `古诗文标签概览页面`,
}

export default async function Page() {
    try {
        const { mdxComponent: PreviewMDX, toc } = await loadMDXWithTOC(`tag/poem/preview.mdx`);
        return (
            <MDXPreview
                mdxContent={<PreviewMDX />}
                toc={toc}
                now={"标签"}
                headerData={[{ name: "古诗文", href: "/overview" }]}
            />
        );
    } catch (error) {
        console.error(error);
        notFound();
    }
}