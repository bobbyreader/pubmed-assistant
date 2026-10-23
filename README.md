# PubMed 文献研究助手

一个简单易用的 PubMed 医学文献搜索工具，支持中文关键词搜索、收藏管理和文献摘要查看。

## 在线使用

- 正式站：https://okmed.leoyang.dpdns.org （Cloudflare Pages，含服务端加速）
- 备用：https://pubmed-assistant.pages.dev
- 预览站：https://pubmed-assistant-v2.pages.dev

## 当前架构（v2，2026-10-23）

- `index.html`：单文件前端（全部功能：搜索/筛选/高级检索式、结构化摘要与中译、引文复制、BibTeX/RIS/CSV 导出、带标签备注的收藏、收藏 JSON 备份导入导出、深色模式）。无构建步骤，直接部署即运行；通过 `/api/*` 不可用时自动回退为浏览器直连 NCBI。
- `_worker.js`：Cloudflare Pages 高级模式 Worker，提供同源服务端聚合，解决国内访问慢：
  - `GET /api/search`：服务端聚合 NCBI esearch+esummary，边缘缓存 5 分钟
  - `GET /api/abstract`：efetch 摘要 XML，边缘缓存 24 小时
  - `POST /api/translate`：Agnes AI 翻译（需在 Cloudflare 项目环境变量中设置 `AGNES_API_KEY`，密钥不入库），谷歌翻译兜底
- `_routes.json`：仅 `/api/*` 走 Worker，其余为静态文件。

部署：Cloudflare Pages 项目 `pubmed-assistant`（正式）与 `pubmed-assistant-v2`（预览）。仓库根目录即部署产物，push 到 main 后 Cloudflare 自动部署根目录内容。

## 历史说明

仓库早期的 TypeScript + Vite 模块化版本（`src/`）保留在仓库中备查，其入口 index.html 已被 v2 单文件版取代（旧入口备份见 git 历史）。GitHub Pages 工作流仍会构建并发布 `dist`，内容为同一 v2 页面（静态模式，自动走浏览器直连）。
