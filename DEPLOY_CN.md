# Cloudflare Worker 代理部署指南

## 问题说明

在中国网络环境下，由于浏览器的 CORS（跨域资源共享）限制，前端无法直接访问 PubMed API。需要部署一个 Cloudflare Worker 作为代理来绕过这个限制。

## 部署步骤

### 1. 注册 Cloudflare 账号

1. 访问 [Cloudflare Workers](https://workers.cloudflare.com/)
2. 注册/登录账号

### 2. 创建 Worker

1. 点击 "Create a Service"
2. 给 Worker 命名（例如：`pubmed-proxy`）
3. 点击 "Deploy"

### 3. 编辑 Worker 代码

1. 进入创建的 Worker
2. 点击 "Edit code"
3. 将 `worker.js` 中的代码复制粘贴进去
4. 点击 "Deploy" 保存

### 4. 获取 Worker 地址

部署成功后，您的 Worker 地址格式为：
```
https://pubmed-proxy.你的用户名.workers.dev
```

### 5. 配置项目

1. 打开 `index.html` 文件
2. 找到第 580 行左右的 `WORKER_URL` 配置
3. 将您的 Worker 地址填入：
```javascript
const WORKER_URL = 'https://pubmed-proxy.你的用户名.workers.dev';
```

### 6. 测试

刷新浏览器页面，尝试搜索功能是否正常。

---

## Worker 代码说明

`worker.js` 文件包含了一个简单的 CORS 代理：

- 接收带有 `url` 参数的请求
- 转发请求到目标 URL
- 添加 CORS 头部允许跨域访问
- 返回原始响应

## 为什么使用 Cloudflare Workers？

1. **免费**：每日 10 万次免费请求
2. **快速**：全球边缘网络，响应迅速
3. **稳定**：在中国网络环境下访问稳定
4. **简单**：无需服务器，直接部署

---

## 常见问题

**Q: 没有部署 Worker 能否使用？**
A: 代码会尝试使用公开的 CORS 代理，但可能不稳定。建议部署自己的 Worker。

**Q: Worker 是否会被屏蔽？**
A: Cloudflare Workers 通常在中国可访问，如果不行可以尝试其他 Worker 名称。

**Q: 每日免费额度够用吗？**
A: 免费版每日 10 万次请求，对于个人使用绰绰有余。
