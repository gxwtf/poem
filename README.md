# 广学古诗文

## 项目简介

广学古诗文是一个专注于为中学生提供系统化古诗文学习解决方案的平台，通过现代化的技术手段，让传统文化焕发新的生机。

## 技术栈

- **前端**：React + Next.js (App Router)
- **语言**：TypeScript
- **数据库**：PostgreSQL
- **UI 组件**：shadcn/ui

## 项目结构

采用 Next.js App Router 模式，按功能模块组织代码，确保项目结构清晰可维护。

## 平台特色

- 精选古诗文内容
- 智能学习路径
- 互动式学习体验
- 个性化学习推荐

## 开源信息

- **开源协议**：MIT
- **代码仓库**：https://github.com/gxwtf/poem
- **贡献指南**：欢迎提交 Issue 和 Pull Request，共同完善平台功能。

## 数据维护

- **数据更新流程**：通过 scripts/poem-content 目录中的脚本实现
- **原始数据**：json 格式的原始数据存储在 scripts/poem-content 文件夹中
- **数据处理**：使用 ori2full.mjs 脚本将原始数据更新至 src/data 目录中的 full.json
- **完整更新**：运行 ./run.sh 脚本执行多个数据处理步骤，实现前端渲染数据的完整更新

## 备案信息

- **网站名称**：广学古诗文
- **备案号**：京ICP备2025107534号-1
- **运营主体**：广学社技术组
- **联系方式**：gxwtf@foxmail.com