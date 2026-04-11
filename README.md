# PubMed 文献研究助手

一个简单易用的 PubMed 医学文献搜索工具，支持中文关键词搜索、收藏管理和文献摘要查看。

## 功能特性

- 🔍 **快速搜索**：支持中英文关键词搜索 PubMed 文献
- 🌐 **自动翻译**：输入中文关键词会自动翻译成英文后搜索
- ⭐ **收藏管理**：收藏感兴趣的文献，支持导出
- 📄 **摘要查看**：一键查看文献摘要和关键词
- 🎯 **高级筛选**：按年份、作者、期刊等条件筛选
- 📥 **导出功能**：将收藏的文献导出为文本文件
- 📑 **分页浏览**：支持大结果集分页浏览

## 在线使用

直接访问：[https://bobbyreader.github.io/pubmed-assistant/](https://bobbyreader.github.io/pubmed-assistant/)

## 本地开发

```bash
npm install
npm run dev      # 启动开发服务器 (http://localhost:3000)
npm run build    # 构建生产版本
npm run test     # 运行单元测试
```

## 技术栈

- **前端**: TypeScript + Vite
- **样式**: 纯 CSS（模块化，无框架）
- **API**: PubMed E-utilities
- **存储**: LocalStorage 本地持久化
- **代理**: Cloudflare Worker（可选）

## 项目结构

```
src/
├── main.ts        # 入口
├── config.ts      # 配置常量
├── types.ts       # TypeScript 类型定义
├── state.ts       # 响应式状态管理
├── api.ts         # API 调用层
├── parser.ts      # 数据解析
├── renderer.ts    # DOM 渲染（textContent，无 XSS 风险）
├── ui.ts          # 事件绑定与交互
└── styles/        # CSS 模块
```

## 配置说明

通过环境变量配置 Worker 代理地址：

```bash
VITE_WORKER_URL=https://your-worker.workers.dev npm run build
```

## 许可证

MIT License
