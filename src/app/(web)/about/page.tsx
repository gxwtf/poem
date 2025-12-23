import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/site-header"
import config from "../../../../package.json"

export const metadata = {
	title: "关于我们 - 广学古诗文",
	description: "关于广学古诗文的介绍",
}

export default async function AboutPage() {
	const version = config.version;

	return (
		<>
			<SiteHeader now="关于我们" />
			<div className="container mx-auto px-4 py-8 max-w-4xl">
				{/* 新的标题布局 */}
				<div className="relative mb-12">
					<div className="flex items-center justify-center">
						{/* 左侧图标 */}
						<div className="mr-6">
							<Image
								src="/favicon.ico"
								alt="广学古诗文"
								width={80}
								height={80}
								className="rounded-lg w-40px h-40px md:w-80px md:h-80px"
							/>
						</div>

						{/* 中间标题 */}
						<div className="text-center">
							<h1 className="text-4xl font-bold text-[var(--theme-color)] md:text-5xl">
								广学古诗文
							</h1>
						</div>
					</div>

					{/* 右下角版本号 */}
					<div className="absolute -bottom-6 right-0">
						<span className="text-sm text-muted-foreground bg-background/80 px-2 py-1 rounded-md border">
							v {version}
						</span>
					</div>
				</div>

				<div className="grid gap-8 md:grid-cols-2 mb-8">
					<Card>
						<CardHeader>
							<CardTitle className="text-[var(--theme-color)]">我们的使命</CardTitle>
							<CardDescription>
								让古诗文学习变得简单有趣
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								广学古诗文专注于为中学生提供系统化的古诗文学习解决方案，
								通过现代化的技术手段，让传统文化焕发新的生机。
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-[var(--theme-color)]">平台特色</CardTitle>
							<CardDescription>
								专业、系统、有趣的学习体验
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="text-sm text-muted-foreground space-y-1">
								<li>• 精选古诗文内容</li>
								<li>• 智能学习路径</li>
								<li>• 互动式学习体验</li>
								<li>• 个性化学习推荐</li>
							</ul>
						</CardContent>
					</Card>
				</div>

				<Separator className="my-8" />

				<Card>
					<CardHeader>
						<CardTitle className="text-[var(--theme-color)]">开源信息</CardTitle>
						<CardDescription>
							遵循开源协议，共建学习生态
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4 text-sm">
							<div>
								<h4 className="font-medium mb-2 text-[var(--theme-color)]">开源协议</h4>
								<p className="text-muted-foreground">
									本项目采用 MIT 开源协议，欢迎开发者参与贡献。
								</p>
							</div>

							<div>
								<h4 className="font-medium mb-2 text-[var(--theme-color)]">代码仓库</h4>
								<p className="text-muted-foreground">
									GitHub:
									<Link
										href="https://github.com/gxwtf/gxwtf_poem"
										className="text-blue-500 hover:underline ml-2"
										target="_blank"
										rel="noopener noreferrer"
									>
										gxwtf/gxwtf_poem
									</Link>
								</p>
							</div>

							<div>
								<h4 className="font-medium mb-2 text-[var(--theme-color)]">贡献指南</h4>
								<p className="text-muted-foreground">
									欢迎提交 Issue 和 Pull Request，共同完善平台功能。
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Separator className="my-8" />

				<Card>
					<CardHeader>
						<CardTitle className="text-[var(--theme-color)]">备案信息</CardTitle>
						<CardDescription>
							合规运营，安全可靠
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2 text-sm">
							<p><strong className="text-[var(--theme-color)]">网站名称：</strong>广学古诗文</p>
							<p><strong className="text-[var(--theme-color)]">备案号：</strong>京ICP备2025107534号-1</p>
							<p><strong className="text-[var(--theme-color)]">运营主体：</strong>广学社技术组</p>
							<p><strong className="text-[var(--theme-color)]">联系方式：</strong>gxwtf@foxmail.com</p>
						</div>
					</CardContent>
				</Card>

				<div className="text-center mt-8">
					<Button asChild>
						<Link href="/">
							返回首页
						</Link>
					</Button>
				</div>
			</div>
		</>
	);
}