# PubMed 文献研究助手

一个简单易用的 PubMed 医学文献搜索工具，支持中文关键词搜索、收藏管理和文献摘要查看。

## 功能特性

- 🔍 **快速搜索**：支持中英文关键词搜索 PubMed 文献
- 🌐 **自动翻译**：输入中文关键词会自动翻译成英文后搜索
- ⭐ **收藏管理**：收藏感兴趣的文献，支持导出
- 📄 **摘要查看**：一键查看文献摘要和关键词
- 🎯 **高级筛选**：按年份、作者、期刊等条件筛选
- 📥 **导出功能**：将收藏的文献导出为文本文件

## 使用方法

### 在线使用

直接访问：[https://bobbyreader.github.io/pubmed-assistant/](https://bobbyreader.github.io/pubmed-assistant/)

### 本地使用

1. 克隆仓库：
```bash
git clone https://github.com/bobbyreader/pubmed-assistant.git
cd pubmed-assistant
```

2. 在浏览器中打开 `index.html` 文件即可使用

## 配置说明

### 代理配置（可选）

如果网络访问 PubMed 受限，可以配置 Cloudflare Worker 作为代理：

1. 访问 [Cloudflare Workers](https://workers.cloudflare.com/) 创建 Worker
2. 使用以下代码创建 Worker：
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }
    const response = await fetch(targetUrl);
    return new Response(response.body, response);
  }
};
```

3. 修改 `index.html` 中的代理地址（第 577 行）：
```javascript
const WORKER_URL = 'https://your-worker.workers.dev';  // 替换为你的 Worker 地址
```

如果未配置代理，系统会尝试使用公开的 CORS 代理。

## 功能说明

### 搜索文献

1. 在搜索框输入关键词（支持中文）
2. 点击"搜索文献"按钮
3. 查看搜索结果

### 高级筛选

1. 点击"显示/隐藏筛选条件"展开筛选面板
2. 设置年份范围、作者、期刊等条件
3. 点击搜索应用筛选

### 收藏文献

1. 在搜索结果中点击"⭐ 收藏"按钮
2. 收藏的文献会自动保存到浏览器本地存储
3. 在"我的收藏"标签页查看和管理收藏

### 导出收藏

1. 切换到"我的收藏"标签页
2. 点击"导出收藏"按钮
3. 下载生成的文本文件

## 技术栈

- 纯 HTML/CSS/JavaScript
- 无需后端服务器
- 使用 PubMed E-utilities API
- LocalStorage 本地存储

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关链接

- [PubMed 官网](https://pubmed.ncbi.nlm.nih.gov/)
- [PubMed E-utilities API 文档](https://www.ncbi.nlm.nih.gov/books/NBK25497/)
