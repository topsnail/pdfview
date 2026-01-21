# PDF 智库

一个基于 Cloudflare Workers 和 PDF.js 的 PDF 文件管理系统，提供完整的 PDF 文件上传、管理、预览和分享功能。

## 功能特性

- 📁 **文件管理**：上传、查看、删除、恢复 PDF 文件
- 🏷️ **标签系统**：为文件添加标签，支持标签搜索
- 🔍 **搜索功能**：支持文件名和标签搜索
- 📱 **响应式设计**：适配桌面端和移动端
- 🎨 **现代界面**：美观的 UI 设计，流畅的用户体验
- 🔒 **身份验证**：基于密码的简单身份验证
- 📤 **文件分享**：生成可公开访问的分享链接
- 🗑️ **回收站**：支持文件恢复和彻底删除

## 技术栈

- **前端**：HTML5 + CSS3 + JavaScript
- **PDF 渲染**：PDF.js 5.4.530 (ES 模块)
- **后端**：Cloudflare Workers
- **存储**：Cloudflare R2 + KV
- **部署**：Cloudflare Pages

## 项目结构

```
├── index.html          # 主页面（文件管理系统）
├── script.js           # 前端逻辑
├── style.css           # 样式文件
├── viewer.html         # PDF 预览页面
├── _worker.js          # Cloudflare Workers 后端
├── fonts/              # 字体文件
│   └── noto-sans-sc-regular.otf  # 中文字体
└── pdfjs-5.4.530/      # PDF.js 库
    ├── build/          # 核心库文件
    └── web/            # Web 相关资源
        ├── cmaps/      # 字符映射文件
        ├── standard_fonts/  # 标准字体
        └── locale/      # 语言文件（已精简）
```

## 部署指南

### 1. Cloudflare Pages 部署

#### 前置要求
- Cloudflare 账号
- Git 版本控制

#### 部署步骤

1. **克隆仓库**
   ```bash
   git clone <your-repository-url>
   cd <repository-name>
   ```

2. **创建 Cloudflare Pages 项目**
   - 登录 Cloudflare 控制台
   - 导航到 "Pages" 选项卡
   - 点击 "Create a project"
   - 选择你的 Git 仓库
   - 配置构建设置：
     - **框架预设**：None
     - **构建命令**：`echo "Building..."`
     - **构建输出目录**：`/`
     - **环境变量**：添加以下变量：
       - `ACCESS_PASSWORD`：设置你的管理密码

3. **配置 Cloudflare Workers**
   - 在 Cloudflare 控制台中，导航到 "Workers & Pages" → "Workers"
   - 创建一个新的 Worker
   - 将 `_worker.js` 的内容复制到 Worker 代码中
   - 配置 Worker 绑定：
     - **KV Namespace**：创建一个名为 `PDF_FILES` 的 KV 命名空间
     - **R2 Bucket**：创建一个名为 `MY_BUCKET` 的 R2 存储桶

4. **配置路由**
   - 在 Pages 项目设置中，配置自定义域名（可选）
   - 确保 Worker 路由正确映射到 API 路径

### 2. 本地开发

#### 前置要求
- Node.js
- Cloudflare Wrangler CLI

#### 开发步骤

1. **安装依赖**
   ```bash
   npm install -g wrangler
   ```

2. **配置 Wrangler**
   ```bash
   wrangler init
   ```

3. **本地开发服务器**
   ```bash
   wrangler dev
   ```

4. **预览**
   打开浏览器访问 `http://localhost:8787`

## 环境变量

| 变量名 | 类型 | 描述 |
|--------|------|------|
| `ACCESS_PASSWORD` | 字符串 | 管理密码，用于 API 身份验证 |
| `PDF_FILES` | KV 命名空间 | 存储文件元数据 |
| `MY_BUCKET` | R2 存储桶 | 存储 PDF 文件二进制数据 |

## 使用说明

### 登录
1. 打开应用首页
2. 输入 `ACCESS_PASSWORD` 设置的密码
3. 点击 "解锁" 按钮

### 上传文件
1. 在 "库" 标签页中
2. 填写 "输入显示标题"（必填）
3. 填写 "标签(逗号分隔)"（可选）
4. 点击 "选择 PDF 文件" 按钮选择文件
5. 点击 "开始上传" 按钮

### 管理文件
- **查看**：点击文件名链接在新标签页中预览
- **分享**：点击分享图标，链接会自动复制到剪贴板
- **删除**：点击删除图标，文件会移到回收站
- **恢复**：在 "回收站" 标签页中点击恢复图标
- **彻底删除**：在 "回收站" 标签页中选择文件后点击 "删除" 按钮

### 搜索文件
- 在搜索框中输入关键词搜索文件名
- 使用 `#标签` 格式搜索特定标签的文件

## 性能优化

- **PDF 懒加载**：PDF 页面按需加载，提升渲染性能
- **本地 PDF.js**：使用本地 PDF.js 库，减少外部依赖
- **字体优化**：精简语言文件，只保留必要的字体支持
- **响应式设计**：在不同设备上都能获得最佳体验

## 安全考虑

- **身份验证**：基于密码的简单身份验证
- **API 保护**：所有 API 请求都需要携带密码
- **分享链接**：公开可访问，但需要知道完整链接
- **存储安全**：文件存储在 Cloudflare R2，安全可靠

## 自定义配置

### 调整界面
- 修改 `style.css` 文件中的 CSS 变量来自定义颜色和样式
- 修改 `script.js` 文件中的逻辑来调整功能行为

### 扩展功能
- 添加用户系统，支持多用户
- 实现文件分类和文件夹功能
- 添加文件版本控制
- 集成更多 PDF 工具，如合并、分割等

## 故障排除

### 常见问题

1. **PDF 无法预览**
   - 检查 PDF.js 文件是否完整
   - 确保网络连接正常
   - 尝试刷新页面

2. **上传失败**
   - 检查文件大小是否超过限制
   - 确保 Cloudflare R2 配置正确
   - 检查 Worker 日志获取详细错误信息

3. **分享链接无效**
   - 确保文件未被删除
   - 检查链接格式是否正确
   - 验证 R2 存储桶权限

### 日志查看
- 在 Cloudflare Workers 控制台查看 API 请求日志
- 在浏览器开发者工具中查看前端错误

## 许可证

MIT License

## 更新日志

- v1.0.0：初始版本
  - 实现基本文件管理功能
  - 集成 PDF.js 渲染
  - 部署到 Cloudflare Pages

---

**提示**：本项目为个人或小团队使用的轻量级 PDF 管理解决方案，不适合处理大量文件或高并发场景。