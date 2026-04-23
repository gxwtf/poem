// 文章预览页面
import { notFound } from 'next/navigation'
import { MDXPreview } from '@/components/mdx-preview'
import { loadMDXWithTOC } from '@/lib/mdx-utils'

interface Props {
    params: Promise<{ article: string }>;
}

export async function generateMetadata(props: Props) {
    const { article } = await props.params;
    const Article = decodeURIComponent(article);
    return {
        title: `读书课 - ${Article}`,
        description: `${Article}`,
    };
}

export default async function Page(props: Props) {
    const { article } = await props.params;
    const Article = decodeURIComponent(article);
    try {
        const { mdxComponent: IntroMDX, toc } = await loadMDXWithTOC(`article/${Article}/preview.mdx`);
        return (
            <MDXPreview
                mdxContent={<IntroMDX />}
                toc={toc}
                headerData={[{ name: "读书课", href: "/articles" }]}
                now={Article}
            />
        );
    } catch (error) {
        console.error(error);
        notFound();
    }
}