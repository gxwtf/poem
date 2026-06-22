'use client'

import { TableOfContents } from '@/components/toc'
import { SiteHeader } from '@/components/site-header'
import { TextHighlighter } from '@/components/text-highlighter'
import { Toc } from '@/lib/toc'
import React from 'react'

export interface MDXPreviewProps {
    mdxContent: React.ReactNode
    toc: Toc
    headerData?: { name: string; href: string }[]
    now?: string
    title?: string
    version?: string
}

export function MDXPreview({
    mdxContent,
    toc,
    headerData = [],
    now,
    title,
    version
}: MDXPreviewProps) {
    const content = (
        <div className="flex flex-1">
            <div className="flex-1 p-8">
                {mdxContent}
            </div>
            {toc.items.length > 0 && (
                <aside className="hidden md:block w-64 p-6">
                    <div className="sticky top-30">
                        <TableOfContents toc={toc.items} />
                    </div>
                </aside>
            )}
        </div>
    )

    return (
        <div className="flex flex-col min-h-screen">
            <SiteHeader data={headerData} now={now ?? ""} />
            {version && title ? (
                <TextHighlighter version={version} title={title}>
                    {content}
                </TextHighlighter>
            ) : (
                content
            )}
        </div>
    )
}
