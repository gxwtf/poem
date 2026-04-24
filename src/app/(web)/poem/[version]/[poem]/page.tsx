// 古诗文预览页面
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
        title: `古诗文 - ${Poem}`,
        description: `${Poem}的古诗文预览页面`,
    };
}

export default async function Page(props: Props) {
    const { version, poem } = await props.params;
    const Poem = decodeURIComponent(poem);
    try {
        const { mdxComponent: PreviewMDX, toc } = await loadMDXWithTOC(`poem/${version}/${Poem}/preview.mdx`);
        return (
            <MDXPreview
                mdxContent={<PreviewMDX />}
                toc={toc}
                headerData={[{ name: "古诗文", href: "/overview" }]}
                now={Poem}
            />
        );
    } catch (error) {
        console.error(error);
        notFound();
    }
}