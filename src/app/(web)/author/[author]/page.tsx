// 作者介绍页面
import { notFound } from 'next/navigation'
import { MDXPreview } from '@/components/mdx-preview'
import { loadMDXWithTOC } from '@/lib/mdx-utils'

interface Props {
    params: Promise<{ author: string }>;
}

export async function generateMetadata(props: Props) {
    const { author } = await props.params;
    const Author = decodeURIComponent(author);
    return {
        title: `作者 - ${Author}`,
        description: `${Author}的作者介绍页面`,
    };
}

export default async function Page(props: Props) {
    const { author } = await props.params;
    const Author = decodeURIComponent(author);
    try {
        const { mdxComponent: IntroMDX, toc } = await loadMDXWithTOC(`author/${Author}/intro.mdx`);
        return (
            <MDXPreview
                mdxContent={<IntroMDX />}
                toc={toc}
                headerData={[{ name: "作者", href: "/authors" }]}
                now={Author}
            />
        );
    } catch (error) {
        console.error(error);
        notFound();
    }
}