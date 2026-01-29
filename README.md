# GitHub Trending 每日推送

一个自动化脚本，在 GitHub Actions 上定时运行，通过自定义 MCP Server 获取 GitHub Trending 页面的热门项目列表，然后让 Claude AI 通过 Web Search 工具自主地获取每个项目的详细信息、进行分析，并生成邮件通过 Resend 发送到指定邮箱。

## ✨ 特性

- 🚀 **自动化执行**：通过 GitHub Actions 定时每天 09:00 UTC 自动运行
- 🤖 **Claude AI 分析**：使用 Claude AI 进行深度的智能分析
- 🌐 **Web Search**：Claude 自主使用 Web Search 获取项目详细信息
- 📧 **邮件推送**：通过 Resend 发送精美的 HTML 邮件
- 🎨 **响应式设计**：邮件模板基于 Tailwind CSS，支持移动端
- 🔧 **自定义模型**：支持使用非 Anthropic 官方的模型（OpenAI、DeepSeek 等）
- 📊 **多维度分析**：包括项目简介、技术栈、核心功能、trending 原因和推荐指数

## 📋 环境要求

- Node.js 18+ (或 Bun 1.3.7+)
- Claude API Key（或兼容的 OpenAI API Key）
- Resend API Key

## 🚀 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置以下变量：

```env
# Claude API（必填）
ANTHROPIC_API_KEY=sk-ant-xxx

# 自定义模型配置（可选）
ANTHROPIC_BASE_URL=https://api.openai.com/v1
ANTHROPIC_MODEL=gpt-4o

# Resend 邮件服务（必填）
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_TO_EMAIL=recipient@example.com

# 日志配置
LOG_LEVEL=info
```

### 3. 本地运行

```bash
bun start
```

或使用热重载模式：

```bash
bun dev
```

### 4. 部署到 GitHub Actions

1. 将代码推送到 GitHub 仓库
2. 在 GitHub 仓库的 Settings → Secrets and variables → Actions 中配置以下 Secrets：
   - `ANTHROPIC_API_KEY`：Claude API 密钥（必填）
   - `ANTHROPIC_BASE_URL`：自定义 API 端点（可选）
   - `ANTHROPIC_MODEL`：自定义模型名称（可选）
   - `RESEND_API_KEY`：Resend API 密钥（必填）
   - `RESEND_FROM_EMAIL`：发件人邮箱（必填）
   - `RESEND_TO_EMAIL`：收件人邮箱（必填）

3. 开启 GitHub Actions 工作流（已配置每天 09:00 UTC 自动运行）

## 📁 项目结构

```
github-trending-daily/
├── src/
│   ├── index.ts                      # 主入口
│   ├── mcp/
│   │   └── trendingMcpServer.ts      # Trending MCP Server
│   ├── claude/
│   │   └── agent.ts                  # Claude Agent Prompt
│   ├── email/
│   │   ├── emailGenerator.ts         # 邮件生成器
│   │   └── emailSender.ts            # 邮件发送器
│   └── utils/
│       ├── jsonExtractor.ts          # JSON 提取器
│       └── logger.ts                 # 日志工具
├── types/
│   └── index.ts                      # TypeScript 类型定义
├── .github/
│   └── workflows/
│       └── daily-trending.yml        # GitHub Actions 工作流
└── .env.example                      # 环境变量示例
```

## 🔧 技术栈

- **运行时**：Bun
- **语言**：TypeScript
- **Claude SDK**：@anthropic-ai/claude-agent-sdk
- **HTML 解析**：cheerio
- **邮件服务**：Resend
- **CI/CD**：GitHub Actions

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

感谢 Claude AI、Anthropic、Resend 和开源社区的支持。
