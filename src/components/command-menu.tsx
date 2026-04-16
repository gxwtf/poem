"use client"

import * as React from "react"
import {
    BookOpenText,
    UserPen,
    Search,
    Tag
} from "lucide-react"
import { Icon } from "@/components/icon"
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { useRouter } from "next/navigation"
import { useDebounce } from "@react-hook/debounce"
import { useIsMac } from "@/hooks/use-is-mac"
import Image from "next/image"

interface SearchResult {
    title: string
    version: string
    author: string
    snippet: string
    matchType: 'title' | 'author' | 'content' | 'tags'
}

interface AuthorSearchResult {
    name: string
    dynasty: string
    epithet: string
    tags: string[]
    matchType: 'name' | 'dynasty' | 'epithet' | 'tags'
    avatar?: string
}

interface ArticleSearchResult {
    title: string
    author: string
    snippet: string
    matchType: 'title' | 'author' | 'abstract' | 'content'
}

export function CommandMenu() {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState('')
    const [searchQuery, setSearchQuery] = useDebounce(searchValue, 500)
    const [searchResults, setSearchResults] = React.useState<SearchResult[]>([])
    const [authorResults, setAuthorResults] = React.useState<AuthorSearchResult[]>([])
    const [articleResults, setArticleResults] = React.useState<ArticleSearchResult[]>([])
    const [isSearching, setIsSearching] = React.useState(false)
    const isMac = useIsMac()

    const router = useRouter()

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (isMac && e.metaKey || !isMac && e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    })

    React.useEffect(() => {
        setSearchQuery(searchValue)
    })

    // 搜索古诗文、作者和读书课
    React.useEffect(() => {
        const searchAll = async () => {
            if (!searchQuery.trim()) {
                setSearchResults([])
                setAuthorResults([])
                setArticleResults([])
                setIsSearching(false)
                return
            }

            setIsSearching(true)
            try {
                // 并行搜索古诗文、作者和读书课
                const [poemResponse, authorResponse, articleResponse] = await Promise.all([
                    fetch(`/api/search/poem?q=${encodeURIComponent(searchQuery)}`),
                    fetch(`/api/search/author?q=${encodeURIComponent(searchQuery)}`),
                    fetch(`/api/search/article?q=${encodeURIComponent(searchQuery)}`)
                ])

                if (poemResponse.ok) {
                    const poemData = await poemResponse.json()
                    setSearchResults(poemData.results)
                }

                if (authorResponse.ok) {
                    const authorData = await authorResponse.json()
                    setAuthorResults(authorData.results)
                }

                if (articleResponse.ok) {
                    const articleData = await articleResponse.json()
                    setArticleResults(articleData.results)
                }
            } catch (error) {
                console.error('搜索失败:', error)
                setSearchResults([])
                setAuthorResults([])
                setArticleResults([])
            } finally {
                setIsSearching(false)
            }
        }
        searchAll()
    }, [searchQuery])

    // HTML 内联高亮函数
    const HighlightedText = ({ text, query }: { text: string; query: string }) => {
        if (!query) return <span>{text}</span>

        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        const parts = text.split(regex)
        const matches = text.match(regex) || []

        return (
            <span>
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        {part}
                        {matches[index] && (
                            <span className="text-[var(--theme-color)]">
                                {matches[index]}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </span>
        )
    }

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput
                placeholder="搜索古诗文、作者、读书课、标签..."
                value={searchValue}
                onValueChange={setSearchValue}
            />
            <CommandList>
                {searchValue ? (
                    <>
                        {isSearching ? (
                            <CommandEmpty>搜索中...</CommandEmpty>
                        ) : (
                            <>
                                {/* 作者搜索结果 */}
                                {authorResults.length > 0 && (
                                    <CommandGroup
                                        forceMount={true}
                                        heading="作者搜索结果"
                                    >
                                        {authorResults.map((result, index) => {
                                            const displayText = `${result.name}｜${result.dynasty}｜${result.epithet}`
                                            return (
                                                <CommandItem
                                                    key={index}
                                                    className="text-primary"
                                                    onSelect={() => {
                                                        setOpen(false)
                                                        router.push(`/author/${encodeURIComponent(result.name)}`)
                                                    }}
                                                >
                                                    {result.avatar ? (
                                                        <Image
                                                            src={result.avatar}
                                                            alt={result.name}
                                                            height={64}
                                                            width={64}
                                                            className="mr-2 h-4 w-4 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <Search className="text-[var(--theme-color)] mr-2 h-4 w-4" />
                                                    )}
                                                    <span className="truncate">
                                                        <HighlightedText
                                                            text={displayText}
                                                            query={searchQuery}
                                                        />
                                                    </span>
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                )}

                                {/* 古诗文搜索结果 */}
                                {searchResults.length > 0 && (
                                    <CommandGroup
                                        forceMount={true}
                                        heading="古诗文搜索结果"
                                    >
                                        {searchResults.map((result, index) => {
                                            const displayText = `${result.title}｜${result.author}` + (result.snippet ? `｜${result.snippet}` : '')
                                            return (
                                                <CommandItem
                                                    key={index}
                                                    className="text-primary"
                                                    onSelect={() => {
                                                        setOpen(false)
                                                        router.push(`/poem/${encodeURIComponent(result.version)}/${encodeURIComponent(result.title)}`)
                                                    }}
                                                >
                                                    <Search className="text-[var(--theme-color)] mr-2 h-4 w-4" />
                                                    <span className="truncate">
                                                        <HighlightedText
                                                            text={displayText}
                                                            query={searchQuery}
                                                        />
                                                    </span>
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                )}

                                {/* 读书课搜索结果 */}
                                {articleResults.length > 0 && (
                                    <CommandGroup
                                        forceMount={true}
                                        heading="读书课搜索结果"
                                    >
                                        {articleResults.map((result, index) => {
                                            const displayText = `${result.title}｜${result.author}` + (result.snippet ? `｜${result.snippet}` : '')
                                            return (
                                                <CommandItem
                                                    key={index}
                                                    className="text-primary"
                                                    onSelect={() => {
                                                        setOpen(false)
                                                        router.push(`/article/${encodeURIComponent(result.title)}`)
                                                    }}
                                                >
                                                    <Search className="text-[var(--theme-color)] mr-2 h-4 w-4" />
                                                    <span className="truncate">
                                                        <HighlightedText
                                                            text={displayText}
                                                            query={searchQuery}
                                                        />
                                                    </span>
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                )}

                                {searchResults.length === 0 && authorResults.length === 0 && articleResults.length === 0 && (
                                    <CommandEmpty>找不到相关结果</CommandEmpty>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <CommandEmpty>找不到结果。</CommandEmpty>
                        <CommandGroup heading="建议">
                            <CommandItem
                                className="text-primary"
                                onSelect={() => {
                                    setOpen(false)
                                    router.push(`/overview`)
                                }}
                            >
                                <Icon className="mr-2 h-4 w-4" />
                                <span>古诗文</span>
                            </CommandItem>
                            <CommandItem
                                className="text-primary"
                                onSelect={() => {
                                    setOpen(false)
                                    router.push(`/authors`)
                                }}
                            >
                                <UserPen className="mr-2 h-4 w-4" />
                                <span>作者</span>
                            </CommandItem>
                            <CommandItem
                                className="text-primary"
                                onSelect={() => {
                                    setOpen(false)
                                    router.push(`/articles`)
                                }}
                            >
                                <BookOpenText className="mr-2 h-4 w-4" />
                                <span>读书课</span>
                            </CommandItem>
                            <CommandItem
                                className="text-primary"
                                onSelect={() => {
                                    setOpen(false)
                                    router.push(`/tag/poem`)
                                }}
                            >
                                <Tag className="mr-2 h-4 w-4" />
                                <span>标签</span>
                            </CommandItem>
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    )
}