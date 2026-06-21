// 作者标签页面
import { notFound } from 'next/navigation'
import { MDXPreview } from '@/components/mdx-preview'
import { loadMDXWithTOC } from '@/lib/mdx-utils'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: `作者标签 - 广学古诗文`,
    description: `作者标签概览页面`,
}

export default async function Page() {
    try {
        const { mdxComponent: PreviewMDX, toc } = await loadMDXWithTOC(`tag/author/preview.mdx`);
        return (
            <MDXPreview
                mdxContent={<PreviewMDX />}
                toc={toc}
                now={"标签"}
                headerData={[{ name: "作者", href: "/authors" }]}
            />
        );
    } catch (error) {
        console.error(error);
        notFound();
    }
}