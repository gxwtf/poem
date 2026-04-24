// 古诗文知识梳理页面
import { notFound } from 'next/navigation'
import { MDXPreview } from '@/components/mdx-preview'
import { loadMDXWithTOC } from '@/lib/mdx-utils'

interface Props {
    params: Promise<{ version: 'junior' | 'senior'; poem: string; }>;
}

export async function generateMetadata(props: Props) {
    const { poem } = await props.params;
    const Poem = decodeURIComponent(poem);
    return {
        title: `知识梳理 - ${Poem}`,
        description: `${Poem}的知识梳理页面`,
    };
}

export default async function Page(props: Props) {
    const { version, poem } = await props.params;
    const Poem = decodeURIComponent(poem);
    try {
        const { mdxComponent: CombMDX, toc } = await loadMDXWithTOC(`poem/${version}/${Poem}/comb.mdx`);
        return (
            <MDXPreview
                mdxContent={<CombMDX />}
                toc={toc}
                headerData={[{ name: "古诗文", href: "/overview" }, { name: Poem, href: `/poem/${version}/${Poem}` }]}
                now="知识梳理"
            />
        );
    } catch (error) {
        console.error(error);
        notFound();
    }
}