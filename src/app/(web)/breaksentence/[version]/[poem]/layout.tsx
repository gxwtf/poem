interface Props {
    params: Promise<{ poem: string }>;
}

export async function generateMetadata(props: Props) {
    const { poem } = await props.params;
    const Poem = decodeURIComponent(poem);
    return {
        title: `句读知不知 - ${Poem}`,
        description: `句读知不知小游戏`,
    };
}

export default function Layout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}