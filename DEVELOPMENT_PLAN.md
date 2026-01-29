 # GitHub Trending 每日推送项目开发计划（基于 Claude Web Search + MCP）

## 项目概述

搭建一个自动化脚本，在 GitHub Actions 上定时运行，通过 **自定义 MCP Server** 获取 GitHub Trending 页面的热门项目列表，然后让 **Claude AI 通过 Web Search 工具自主地**获取每个项目的详细信息、进行分析，并生成邮件通过 Resend 发送到指定邮箱。

## ⚠️ 重要：支持自定义模型配置

本项目支持使用非 Anthropic 官方的模型，可以通过环境变量自定义配置：
- **API 端点 URL**: 支持自定义 API base URL（如使用第三方代理或兼容 OpenAI API 的服务）
- **模型名称**: 支持使用任意模型名称（如 `gpt-4o`, `claude-3.5-sonnet` 等）
- **API 密钥**: 支持自定义 API key

具体配置方法见 [环境变量配置](#环境变量配置) 部分。

## 核心设计理念

**完全自主流程**：脚本提供 MCP 工具 + Web Search → Claude 自主决策调用 → 获取数据 → 分析 → 返回结构化结果

与传统方案的区别：
- ❌ 传统：脚本写死流程，硬编码每个步骤 → 调用 Claude 分析
- ✅ 本方案：Claude 通过 MCP 工具 + Web Search 完全自主获取数据并分析

**执行流程**：
```
1. 脚本启动并连接 Trending MCP Server
2. 提供工具：get_trending_repositories (MCP) + web_search (Claude 内置)
3. Claude 收到初始 Prompt："获取并分析今日 GitHub Trending"
4. Claude 自主决策：
   - 调用 get_trending_repositories 获取项目列表
   - 对每个项目使用 web_search 获取详细信息（搜索 GitHub 页面、README、文档）
   - 分析所有项目
5. Claude 返回结构化 JSON 分析结果
6. 脚本提取 JSON，生成邮件并发送
```

## 技术栈

 - **运行时**: Bun
 - **语言**: TypeScript
 - **Claude SDK**: 两种选择
   - 选项A: `@anthropic-ai/claude-agent-sdk`（推荐）- Agent SDK，内置 Tool Use 执行、MCP 支持，更简洁
   - 选项B: `@anthropic-ai/sdk`（经典）- Client SDK，需手动实现 Tool Use 循环
 - **Claude Web Search**: 内置服务器端工具（无需额外配置）
 - **HTML 解析**: cheerio
 - **邮件服务**: Resend (resend 包)
- **CI/CD**: GitHub Actions

## 项目架构

```
github-trending-daily/
├── src/
│   ├── index.ts                          # 主入口，协调所有模块
│   ├── mcp/
│   │   └── trendingMcpServer.ts          # 自定义 Trending MCP Server（唯一 MCP）
│   ├── claude/
│   │   ├── toolUseExecutor.ts            # Claude Tool Use 执行器（含 Web Search）
│   │   └── agent.ts                      # Claude Agent + Prompt 管理
│   ├── email/
│   │   ├── emailGenerator.ts             # HTML 邮件生成
│   │   └── emailSender.ts                # Resend 邮件发送
│   └── utils/
│       ├── jsonExtractor.ts              # JSON 提取器
│       └── logger.ts                     # 日志工具
├── types/
│   └── index.ts                          # TypeScript 类型定义
├── .github/
│   └── workflows/
│       └── daily-trending.yml            # GitHub Actions 定时任务
└── .env.example                          # 环境变量示例
```

## 核心功能模块

### 1. Trending MCP Server (`src/mcp/trendingMcpServer.ts`)

**功能**:
- 本地 MCP Server，提供爬取 GitHub Trending 页面的能力
- 解析 HTML，提取项目基本信息
- 通过 stdio 协议与客户端通信

**核心工具**:
```typescript
{
  name: "get_trending_repositories",
  description: "获取 GitHub Trending 页面的热门开源项目列表",
  input_schema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "返回数量，默认 10"
      },
      language: {
        type: "string",
        description: "过滤语言，如 'javascript', 'python'"
      },
      timeframe: {
        type: "string",
        enum: ["daily", "weekly", "monthly"],
        description: "时间范围，默认 daily"
      }
    }
  }
}
```

**输出示例**:
```json
[
  {
    "name": "owner/repo",
    "description": "项目描述",
    "language": "TypeScript",
    "stars": 1234,
    "forks": 56,
    "url": "https://github.com/owner/repo"
  }
]
```

**依赖**: cheerio

### 2. Claude Tool Use 执行器

**说明**：本方案提供两种实现方式，一种是使用 Claude Agent SDK（推荐，更简洁），一种是使用 Claude Client SDK（需手动实现 Tool Use 循环）。

#### 选项A：使用 Claude Agent SDK（推荐）

**功能**:
- 使用 Agent SDK 的 `query()` 函数，自动处理 Tool Use 执行循环
- 内置 Web Search 工具（WebSearch）
- 通过 `mcpServers` 配置自动加载 Trending MCP Server
- 自动管理对话历史和上下文

 **核心实现**:
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

async function executeTask(agentPrompt: string): Promise<any[]> {
  const messages: any[] = []

  // 支持自定义模型配置
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4.5'

  for await (const message of query({
    prompt: agentPrompt,
    options: {
      model,
      allowedTools: ['WebSearch'],
      mcpServers: {
        trending: {
          command: 'bun',
          args: ['run', './src/mcp/trendingServer.ts']
        }
      }
    }
  })) {
    messages.push(message)

    // 检查是否完成
    if (message.type === 'result'
      && (message.subtype === 'success' || message.subtype?.startsWith('error_'))) {
      return messages
    }
  }

  return messages
}
```

**特性**:
- 自动执行 Web Search（通过 allowedTools: ["WebSearch"]）
- 自动执行 MCP 工具（通过 mcpServers 配置）
- 自动处理多轮对话和工具调用
- 支持并行工具调用
- 内置错误处理

**依赖**: @anthropic-ai/claude-agent-sdk

#### 选项B：使用 Claude Client SDK（手动实现）

**功能**:
- 实现 Claude Tool Use 的完整执行循环
- 集成 Web Search 工具（服务器端工具）
- 处理多轮对话（Claude 调用工具 → 返回结果 → 继续分析）
- 管理对话历史和上下文

 **核心流程**:
```typescript
import Anthropic from '@anthropic-ai/sdk'

class ToolUseExecutor {
  private anthropic: Anthropic

  constructor(apiKey: string) {
    // 支持自定义 API 端点
    const baseURL = process.env.ANTHROPIC_BASE_URL
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4.5'

    this.anthropic = new Anthropic({
      apiKey,
      baseURL: baseURL || undefined,
      defaultQuery: baseURL ? undefined : undefined
    })

    this.model = model
  }

  private model: string

  async execute(initialPrompt: string): Promise<any[]> {
    const messages = [{ role: 'user', content: initialPrompt }]

    // 定义工具：Web Search 工具
    const tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 20
      }
    ]

    let maxTurns = 30 // 防止无限循环

    while (maxTurns-- > 0) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        tools,
        messages
      })

      // 检查是否需要调用工具
      const toolUses = response.content.filter((c: any) => c.type === 'tool_use')

      if (toolUses.length === 0) {
        return response.content // Claude 完成响应
      }

      // 并行执行工具调用
      const toolResults = await Promise.allSettled(
        toolUses.map((tool: any) => this.callTool(tool))
      )

      // 构造 tool_results
      const toolResultsContent = toolUses.map((toolUse: any, index: number) => ({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: toolResults[index].status === 'fulfilled'
          ? toolResults[index].value
          : { error: toolResults[index].reason.message }
      }))

      // 添加工具调用和结果到消息历史
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResultsContent })
    }

    throw new Error('超过最大轮数限制')
  }

  private async callTool(tool: any): Promise<any> {
    // Web Search 是服务器端工具，由 Anthropic API 自动执行
    // 不需要手动实现，返回工具的输入参数即可
    return tool.input
  }
}
```

**特性**:
- 完全控制 Tool Use 执行流程
- 集成 Web Search 工具（服务器端，无需实现）
- 支持并行工具调用
- 自动重试失败的工具调用
- 超时控制
- 错误处理和降级

**依赖**: @anthropic-ai/sdk

### 3. Claude Agent (`src/claude/agent.ts`)

**功能**:
- 管理 Claude 的初始 Prompt
- 定义搜索策略和任务流程
- 处理返回结果

**初始 Prompt 设计**:
```
你是一个 GitHub Trending 分析专家。请完成以下任务：

1. 获取并分析 GitHub Trending 今天的 Top 10 热门项目

2. 对每个项目，使用 Web Search 工具获取详细信息：
   - 第1次搜索：项目的 GitHub 页面概览
     - 搜索关键词示例："vercel/ai-sdk GitHub" 或 "GitHub owner/repo"
   - 第2次搜索：项目的 README、文档或详细介绍
     - 搜索关键词示例："vercel/ai-sdk README documentation features"
   - 搜索技巧：
     * 使用精确的项目名称（owner/repo 格式）
     * 添加关键词如 "README"、"features"、"documentation"、"overview"
     * 优先访问 GitHub 官方页面
     * 如果第一次搜索已经包含足够信息，可以跳过第二次搜索

3. 基于获取到的信息，对每个项目进行分析（中文输出），包括：
   - 项目简介（1-2句话）
   - 主要技术栈（列出关键技术和框架）
   - 核心功能（3-5个要点）
   - 为什么会 trending（分析热点原因）
   - 推荐指数（1-10分）及理由

最后，以 JSON 格式返回所有项目的分析结果，格式如下：
```json
{
  "date": "2026-01-29",
  "projects": [
    {
      "name": "owner/repo",
      "summary": "项目简介",
      "techStack": ["技术1", "技术2"],
      "features": ["功能1", "功能2", "功能3"],
      "trendingReason": "trending原因",
      "recommendationScore": 8,
      "recommendationReason": "推荐理由"
    }
  ],
  "summary": "今日重点推荐..."
}
```

请确保返回的 JSON 是有效的，不要包含任何其他文本。

重要限制：
- 每个项目最多使用 2 次 web_search
- 总搜索次数不超过 20 次
- 只分析前 10 个项目
- 如果无法获取详细信息，基于项目描述和语言标签进行合理推断
```

### 4. JSON Extractor (`src/utils/jsonExtractor.ts`)

**功能**:
- 从 Claude 的响应中提取 JSON 数据
- 支持多种 JSON 格式（代码块、纯 JSON、混合文本）

**实现**:
```typescript
function extractJSON(content: any[]): any {
  for (const item of content) {
    if (item.type === "text") {
      const text = item.text

      // 尝试提取 ```json ... ``` 代码块
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      // 尝试直接解析整个文本
      try {
        return JSON.parse(text)
      } catch {
        // 尝试提取文档中的最后一个 JSON 对象
        const jsonBrackets = text.match(/\{[\s\S]*\}/)
        if (jsonBrackets) {
          return JSON.parse(jsonBrackets[0])
        }
      }
    }
  }
  throw new Error("无法从 Claude 响应中提取有效的 JSON 数据")
}
```

### 5. Email Generator (`src/email/emailGenerator.ts`)

**功能**:
- 基于 Claude 返回的 JSON 数据生成 HTML 邮件
- 支持多种邮件样式模板
- 响应式设计

**特性**:
- Tailwind CSS 通过 CDN 引入（无需构建）
- 支持自定义邮件颜色和主题
- 移动端友好

**邮件结构**:
```html
<!-- 邮件头部 -->
<div>日期、项目数量、统计数据</div>

<!-- 语言分布 -->
<div>各语言的项目数量饼图</div>

<!-- 项目列表 -->
<div class="project" v-for="project in projects">
  <h2>项目标题和链接</h2>
  <div class="analysis">Claude 分析内容</div>
  <button>查看项目</button>
</div>

<!-- 页脚 -->
<div>退订链接、版权信息</div>
```

### 6. Email Sender (`src/email/emailSender.ts`)

**功能**:
- 使用 Resend API 发送 HTML 邮件
- 支持重试机制
- 错误处理

**依赖**: resend

### 7. Main Entry Point (`src/index.ts`)

**功能**:
- 协调所有模块
- 执行完整流程
- 错误处理和日志记录

**完整流程**:
```typescript
async function main() {
  logger.info('开始执行 GitHub Trending 分析任务')

  const apiKey = process.env.ANTHROPIC_API_KEY || ''

  // 1. 创建 Claude Tool Use 执行器
  const executor = new ToolUseExecutor(apiKey)
  logger.info('已创建 Tool Use 执行器')

  // 2. 执行任务（Claude 自主决策）
  const agentPrompt = getAgentPrompt()
  const response = await executor.execute(agentPrompt)
  logger.info('Claude 分析完成')

  // 3. 提取 JSON 结果
  const analysis = extractJSON(response)
  logger.info(`成功分析了 ${analysis.projects.length} 个项目`)

  // 4. 生成邮件
  const emailHtml = generateEmail(analysis)
  logger.info('邮件模板已生成')

  // 5. 发送邮件
  await sendEmail(emailHtml)
  logger.info('邮件已发送')

  logger.info('任务完成！')
}
```

## 类型定义

### types/index.ts

```typescript
// ========================================
// Trending 相关类型
// ========================================

export interface TrendingRepository {
  name: string // "owner/repo"
  fullName: string // "owner/repo"
  description: string
  language: string
  stars: number
  forks: number
  url: string
}

// ========================================
// Claude 分析结果类型
// ========================================

export interface ProjectAnalysis {
  name: string
  summary: string // 项目简介
  techStack: string[] // 主要技术栈
  features: string[] // 核心功能
  trendingReason: string // 为什么会 trending
  recommendationScore: number // 推荐指数 1-10
  recommendationReason: string // 推荐理由
}

export interface TrendingAnalysisResult {
  date: string
  projects: ProjectAnalysis[]
  summary: string // 今日重点推荐
}

// ========================================
// 邮件相关类型
// ========================================

export interface EmailTemplate {
  subject: string
  html: string
  to: string
  from: string
}

export interface EmailConfig {
  from: string
  to: string
  subject?: string
}
```

 ## 环境变量配置

### .env.example

```env
# Claude API - 基础配置
ANTHROPIC_API_KEY=sk-ant-xxx

# 📌 自定义模型配置（可选）
# 如果使用非 Anthropic 官方模型（如第三方代理、OpenAI 兼容 API 等），可以配置以下变量：

# 自定义 API 端点 URL（不使用 Anthropic 官方 API 时设置）
# 示例: https://api.openai.com/v1 或自定义代理地址
ANTHROPIC_BASE_URL=

# 自定义模型名称（不使用 Anthropic 官方模型时设置）
# 示例: gpt-4o, claude-3.5-sonnet, deepseek-chat 等
ANTHROPIC_MODEL=

# Resend 邮件服务
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_TO_EMAIL=recipient@example.com

# 日志配置
LOG_LEVEL=info

# Trending 配置
TRENDING_LIMIT=10          # 每次分析的项目数量
TRENDING_TIMEFRAME=daily  # 时间范围: daily/weekly/monthly
TRENDING_LANGUAGE=        # 过滤语言，留空则获取全部
```

### 自定义模型配置示例

#### 示例 1：使用官方 Anthropic 模型（默认）

```env
ANTHROPIC_API_KEY=sk-ant-xxx
# 不需要设置 ANTHROPIC_BASE_URL 和 ANTHROPIC_MODEL
```

#### 示例 2：使用 OpenAI GPT-4o

```env
ANTHROPIC_API_KEY=sk-proj-xxx              # OpenAI API Key
ANTHROPIC_BASE_URL=https://api.openai.com/v1
ANTHROPIC_MODEL=gpt-4o
```

#### 示例 3：使用第三方代理服务

```env
ANTHROPIC_API_KEY=your-proxy-key           # 代理服务的 API Key
ANTHROPIC_BASE_URL=https://your-proxy.com/v1
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

#### 示例 4：使用 DeepSeek 模型

```env
ANTHROPIC_API_KEY=sk-your-deepseek-key
ANTHROPIC_BASE_URL=https://api.deepseek.com/v1
ANTHROPIC_MODEL=deepseek-chat
```

## GitHub Actions 配置

 ### .github/workflows/daily-trending.yml

```yaml
name: GitHub Trending Daily

on:
  schedule:
    - cron: '0 9 * * *' # 每天 09:00 UTC 执行
  workflow_dispatch: # 允许手动触发

jobs:
  send-trending:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run trending script
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          # 📌 自定义模型配置（可选）
          # 如果使用非 Anthropic 官方模型，可以配置以下变量：
          # ANTHROPIC_BASE_URL: ${{ secrets.ANTHROPIC_BASE_URL }}
          # ANTHROPIC_MODEL: ${{ secrets.ANTHROPIC_MODEL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
          RESEND_TO_EMAIL: ${{ secrets.RESEND_TO_EMAIL }}
          TRENDING_LIMIT: 10
          TRENDING_TIMEFRAME: daily
        run: bun run src/index.ts

      - name: Display execution log
        if: always()
        run: |
          echo "任务执行完成"
          echo "检查日志以获取详细信息"
```

 ### GitHub Secrets 配置

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中配置：

| Secret 名称 | 说明 | 获取方式 | 必填 |
|------------|------|---------|------|
| `ANTHROPIC_API_KEY` | 模型 API 密钥（支持 Anthropic、OpenAI 或自定义代理） | https://console.anthropic.com/settings/keys | 是 |
| `ANTHROPIC_BASE_URL` | 自定义 API 端点 URL（可选） | 各平台 API 文档 | 否 |
| `ANTHROPIC_MODEL` | 自定义模型名称（可选） | 各平台模型列表 | 否 |
| `RESEND_API_KEY` | Resend API 密钥 | https://resend.com/api-keys | 是 |
| `RESEND_FROM_EMAIL` | 发件人邮箱 | 需要在 Resend 中验证域名 | 是 |
| `RESEND_TO_EMAIL` | 收件人邮箱 | 你的邮箱地址 | 是 |

**说明**：
- 如果使用 Anthropic 官方 API，只需配置 `ANTHROPIC_API_KEY`
- 如果使用其他平台（如 OpenAI、DeepSeek 等），需要配置：
  - `ANTHROPIC_API_KEY`：对应平台的 API Key
  - `ANTHROPIC_BASE_URL`：对应平台的 API 端点 URL
  - `ANTHROPIC_MODEL`：对应平台的模型名称
- 示例：使用 OpenAI GPT-4o
  - `ANTHROPIC_API_KEY`: `sk-proj-xxx`
  - `ANTHROPIC_BASE_URL`: `https://api.openai.com/v1`
  - `ANTHROPIC_MODEL`: `gpt-4o`

## 开发步骤

### 第一步：安装依赖

```bash
# 使用 Agent SDK（推荐）
bun install @anthropic-ai/claude-agent-sdk cheerio resend

# 或使用 Client SDK
bun install @anthropic-ai/sdk cheerio resend

# 安装开发依赖（两种方式都需要）
bun install -D @types/node
```

### 第二步：创建类型定义

创建 `types/index.ts` 文件，定义所有 TypeScript 接口（参考上面的类型定义）

### 第三步：实现自定义 Trending MCP Server

**文件**: `src/mcp/trendingMcpServer.ts`

**实现要点**:
1. 创建 MCP Server 基础结构
2. 实现 `get_trending_repositories` 工具
3. 使用 `cheerio` 解析 GitHub Trending HTML
4. 返回结构化的 JSON 数据

**工具实现示例**:
```typescript
async function getTrendingRepositories(args: { limit?: number, language?: string, timeframe?: string }) {
  const url = buildTrendingURL(args.language, args.timeframe)
  const html = await fetch(url).then(r => r.text())
  const $ = cheerio.load(html)

  const repos: TrendingRepository[] = []
  $('article.Box-row').each((i, el) => {
    // 解析每个项目
    repos.push({
      name: $(el).find('h2 a').text().trim(),
      description: $(el).find('p').text().trim(),
      // ... 其他字段
    })
  })

  return repos.slice(0, args.limit || 10)
}
```

### 第四步：实现 Claude Tool Use 执行器

#### 方式A：使用 Agent SDK（推荐）

**无需手动实现** - Agent SDK 自动处理 Tool Use 执行循环。直接在 `src/index.ts` 中使用 `query()` 函数即可。

#### 方式B：使用 Client SDK（手动实现）

**文件**: `src/claude/toolUseExecutor.ts`

**实现要点**:
1. 实现 Claude Tool Use 的完整执行循环
2. 集成 Web Search 工具（服务器端工具）
3. 实现重试和错误处理

**核心逻辑**:
```typescript
import Anthropic from '@anthropic-ai/sdk'

interface ToolUse {
  type: 'tool_use'
  id: string
  name: string
  input: any
}

interface Message {
  role: 'user' | 'assistant'
  content: any[]
}

class ToolUseExecutor {
  private anthropic: Anthropic
  private model: string

  constructor(apiKey: string) {
    // 支持自定义 API 端点
    const baseURL = process.env.ANTHROPIC_BASE_URL

    this.anthropic = new Anthropic({
      apiKey,
      baseURL: baseURL || undefined,
      defaultQuery: baseURL ? undefined : undefined
    })

    // 支持自定义模型名称
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4.5'
  }

  async execute(initialPrompt: string): Promise<any[]> {
    const messages: Message[] = [{ role: 'user', content: initialPrompt }]

    const tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 20
      }
    ]

    let maxTurns = 30

    while (maxTurns-- > 0) {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4.5',
        max_tokens: 4096,
        tools,
        messages
      })

      const toolUses = response.content.filter((c: any) => c.type === 'tool_use')

      if (toolUses.length === 0) {
        return response.content
      }

      const toolResults = await Promise.allSettled(
        toolUses.map((tool: ToolUse) => this.executeToolCall(tool))
      )

      const toolResultsContent = toolUses.map((toolUse: ToolUse, index: number) => ({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: toolResults[index].status === 'fulfilled'
          ? toolResults[index].value
          : { error: toolResults[index].reason.message }
      }))

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResultsContent })
    }

    throw new Error('超过最大轮数限制')
  }

  private async executeToolCall(tool: ToolUse): Promise<any> {
    // Web Search 是服务器端工具，由 Anthropic API 自动执行
    // 不需要手动实现，返回工具的输入参数即可
    return tool.input
  }
}

export { ToolUseExecutor }
```

### 第五步：实现 Claude Agent

**文件**: `src/claude/agent.ts`

**实现要点**:
1. 定义初始 Prompt（包含搜索策略）
2. 定义任务描述和期望输出格式
3. 处理返回结果

**注意**：无论选择 Agent SDK 还是 Client SDK，这里的 Prompt 设计都是相同的。

**Prompt 设计**（参考下面的 Prompt，重点说明 Web Search 使用策略）：

```typescript
export function getAgentPrompt(): string {
  return `你是一个 GitHub Trending 分析专家。请完成以下任务：

1. 调用 get_trending_repositories 工具获取今天的 GitHub Trending 项目列表（limit=10）

2. 对每个项目，使用 web_search 工具获取详细信息：
   - 第1次搜索：项目的 GitHub 页面概览
     - 搜索关键词示例："vercel/ai-sdk GitHub" 或 "GitHub owner/repo"
   - 第2次搜索：项目的 README、文档或详细介绍
     - 搜索关键词示例："vercel/ai-sdk README documentation features"
   - 搜索技巧：
     * 使用精确的项目名称（owner/repo 格式）
     * 添加关键词如 "README"、"features"、"documentation"、"overview"
     * 优先访问 GitHub 官方页面
     * 如果第一次搜索已经包含足够信息，可以跳过第二次搜索

3. 基于获取到的信息，对每个项目进行分析（中文输出），包括：
   - 项目简介（1-2句话）
   - 主要技术栈（列出关键技术和框架）
   - 核心功能（3-5个要点）
   - 为什么会 trending（分析热点原因）
   - 推荐指数（1-10分）及理由

最后，以 JSON 格式返回所有项目的分析结果，格式如下：
\`\`\`json
{
  "date": "2026-01-29",
  "projects": [
    {
      "name": "owner/repo",
      "summary": "项目简介",
      "techStack": ["技术1", "技术2"],
      "features": ["功能1", "功能2", "功能3"],
      "trendingReason": "trending原因",
      "recommendationScore": 8,
      "recommendationReason": "推荐理由"
    }
  ],
  "summary": "今日重点推荐..."
}
\`\`\`

请确保返回的 JSON 是有效的，不要包含任何其他文本。

重要限制：
- 每个项目最多使用 2 次 web_search
- 总搜索次数不超过 20 次
- 只分析前 10 个项目
- 如果无法获取详细信息，基于项目描述和语言标签进行合理推断`
}
```

**注意**：Agent SDK 中的 Web Search 工具名称是 `WebSearch`（大写），不是 `web_search`。但在 Prompt 中描述搜索策略时，可以使用 `web_search` 作为通用术语，SDK 会自动处理工具名称映射。

### 第六步：实现 JSON 提取器

**文件**: `src/utils/jsonExtractor.ts`

**实现要点**:
1. 支持 JSON 代码块格式
2. 支持纯 JSON 格式
3. 支持混合文本中的 JSON
4. 严格的 JSON 验证

### 第七步：实现邮件生成器和发送器

**文件**: `src/email/emailGenerator.ts` 和 `src/email/emailSender.ts`

**实现要点**:
1. 基于分析结果生成 HTML
2. 使用 Tailwind CSS CDN
3. 响应式设计
4. 实现发送逻辑

### 第八步：编写主入口

**文件**: `src/index.ts`

#### 方式A：使用 Agent SDK（推荐）

**实现要点**:
1. 使用 Agent SDK 的 `query()` 函数
2. 配置 `mcpServers` 自动加载 Trending MCP Server
3. 配置 `allowedTools` 启用 Web Search 工具
4. 从响应中提取 JSON 结果
5. 错误处理和日志记录

 **完整流程**:
```typescript
import { query } from '@anthropic-ai/claude-agent-sdk'
import { getAgentPrompt } from './claude/agent'
import { generateEmail } from './email/emailGenerator'
import { sendEmail } from './email/emailSender'
import { extractJSON } from './utils/jsonExtractor'
import { logger } from './utils/logger'

async function main() {
  logger.info('开始执行 GitHub Trending 分析任务')

  try {
    const messages: any[] = []

    // 支持自定义模型配置
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4.5'

    // 1. 执行任务（Claude 自主决策，使用 Agent SDK）
    const agentPrompt = getAgentPrompt()

    for await (const message of query({
      prompt: agentPrompt,
      options: {
        model,
        allowedTools: ['WebSearch'],
        mcpServers: {
          trending: {
            command: 'bun',
            args: ['run', './src/mcp/trendingServer.ts']
          }
        }
      }
    })) {
      messages.push(message)
      logger.debug(`收到消息: ${message.type}`)

      // 检查是否完成
      if (message.type === 'result'
        && (message.subtype === 'success' || message.subtype?.startsWith('error_'))) {
        logger.info('Claude 分析完成')
        break
      }

      if (message.type === 'result' && message.subtype?.startsWith('error_')) {
        const errorMsg = (message as any).errors?.join(', ') || '任务执行失败'
        throw new Error(errorMsg)
      }
    }

    // 2. 提取 JSON 结果
    const analysis = extractJSON(messages)
    logger.info(`成功分析了 ${analysis.projects.length} 个项目`)

    // 3. 生成邮件
    const emailHtml = generateEmail(analysis)
    logger.info('邮件模板已生成')

    // 4. 发送邮件
    await sendEmail(emailHtml)
    logger.info('邮件已发送')

    logger.info('任务完成！')
  }
  catch (error) {
    logger.error('任务执行失败:', error)
    process.exit(1)
  }
}

main()
```

#### 方式B：使用 Client SDK

**实现要点**:
1. 初始化 Trending MCP Server 客户端
2. 创建 Claude Tool Use 执行器
3. 执行完整流程
4. 错误处理和日志记录

 **完整流程**:
```typescript
import { getAgentPrompt } from './claude/agent'
import { ToolUseExecutor } from './claude/toolUseExecutor'
import { generateEmail } from './email/emailGenerator'
import { sendEmail } from './email/emailSender'
import { extractJSON } from './utils/jsonExtractor'
import { logger } from './utils/logger'

async function main() {
  logger.info('开始执行 GitHub Trending 分析任务')

  const apiKey = process.env.ANTHROPIC_API_KEY || ''

  try {
    // 1. 创建 Claude Tool Use 执行器（支持自定义 BASE_URL 和模型）
    const executor = new ToolUseExecutor(apiKey)
    logger.info('已创建 Tool Use 执行器')

    // 2. 执行任务（Claude 自主决策）
    const agentPrompt = getAgentPrompt()
    const response = await executor.execute(agentPrompt)
    logger.info('Claude 分析完成')

    // 3. 提取 JSON 结果
    const analysis = extractJSON(response)
    logger.info(`成功分析了 ${analysis.projects.length} 个项目`)

    // 4. 生成邮件
    const emailHtml = generateEmail(analysis)
    logger.info('邮件模板已生成')

    // 5. 发送邮件
    await sendEmail(emailHtml)
    logger.info('邮件已发送')

    logger.info('任务完成！')
  }
  catch (error) {
    logger.error('任务执行失败:', error)
    process.exit(1)
  }
}

main()
```

## 关键技术难点与解决方案

### 难点 1：Web Search 搜索质量

**问题**：Web Search 可能返回不相关的结果或噪音

**解决方案**：
1. 在 Prompt 中明确搜索策略：
   ```
   搜索技巧：
   - 使用精确的项目名称（owner/repo 格式）
   - 添加关键词如 "README"、"features"、"documentation"、"overview"
   - 优先访问 GitHub 官方页面（通常是 github.com/owner/repo）
    ```
2. 使用 `allowed_domains` 限制搜索范围（在 Prompt 中指导 Claude）：
   ```
   在搜索时，优先搜索以下域名：
   - github.com
   - docs.github.com
   ```
3. 在 Prompt 中提供搜索示例

### 难点 2：搜索次数控制

**问题**：Claude 可能消耗过多的搜索次数，增加成本

**解决方案**：
1. 在 Prompt 中明确限制：
   ```
   重要限制：
   - 每个项目最多使用 2 次 web_search
   - 总搜索次数不超过 20 次
   - 如果第一次搜索已经包含足够信息，可以跳过第二次搜索
   ```
2. 使用 `max_uses` 参数强制限制
3. 监控搜索使用情况

### 难点 3：信息完整性

**问题**：Web Search 可能无法获取到完整的 README 或代码信息

**解决方案**：
1. 指导 Claude 使用多轮搜索：
   ```
   第1次搜索：项目的 GitHub 页面概览
   第2次搜索：项目的 README、文档或详细介绍
   ```
2. 如果搜索失败，使用基础信息进行推理分析
3. 在 Prompt 中明确降级策略：
   ```
   如果无法获取详细技术栈或功能信息，
   基于项目描述和语言标签进行合理推断
   ```

### 难点 4：Claude 返回的 JSON 提取

**问题**：Claude 可能返回混合了文本和 JSON 的内容，或者 JSON 在代码块中

**解决方案**：
- 实现智能 JSON 提取器（`src/utils/jsonExtractor.ts`）
- 支持多种 JSON 格式
- 在 Prompt 中明确要求："请确保返回的 JSON 是有效的，不要包含任何其他文本"
- 添加 JSON 验证和解析失败处理

### 难点 5：Tool Use 的工具选择优化

**问题**：Claude 可能不知道该调用哪些工具，或者调用顺序不正确

**解决方案**：
1. 在 Prompt 中明确流程：
   ```
   请按以下顺序执行任务：
   1. 首先调用 get_trending_repositories 获取项目列表
   2. 然后对每个项目使用 web_search 获取详细信息
   3. 最后进行综合分析
   ```
2. 在工具描述中添加详细说明和示例
3. 使用 `tool_choice: "auto"` 让 Claude 自主决策

### 难点 6：成本控制

**问题**：Web Search + Claude API 的成本可能较高

**解决方案**：
1. 限制 Trending 项目数量（`TRENDING_LIMIT=10`）
2. 限制每个项目的搜索次数（最多 2 次）
3. 使用 `max_tokens=4096` 控制输出长度
4. 监控 API 调用消耗
5. 实现缓存机制（可选，根据 repo 全名）

**成本估算**（分析 10 个项目）：
- Claude API tokens: ~30,000 input + ~10,000 output ≈ $0.05-0.08
- Web Search: 15-20 次搜索 @ $10/1000 = $0.15-0.20
- **总计**: $0.20-0.28/次

### 难点 7：Trending 页面结构变化

**问题**：GitHub 可能更改 Trending 页面的 HTML 结构

**解决方案**：
1. 实现灵活的解析逻辑
2. 添加监控和告警（解析失败时）
3. 实现多种解析策略（按优先级）
4. 定期检查页面结构变化

### 难点 8：Tool Use 执行超时

**问题**：Claude 可能陷入无限循环，或某个工具调用超时

**解决方案**：
1. 实现最大轮数限制（如最多 30 轮）
2. 为每个工具调用设置超时（如 60 秒）
3. 实现降级策略（工具调用失败时返回错误信息）
4. 添加执行进度日志

 ## 注意事项

### 0. 自定义模型配置（推荐）

本项目支持使用非 Anthropic 官方的模型，通过以下环境变量进行配置：

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `ANTHROPIC_API_KEY` | API 密钥（必填） | `sk-ant-xxx` `sk-proj-xxx` |
| `ANTHROPIC_BASE_URL` | API 端点（可选） | `https://api.openai.com/v1` |
| `ANTHROPIC_MODEL` | 模型名称（可选） | `gpt-4o` `deepseek-chat` |

**注意事项**：
- 如果使用 Anthropic 官方 API，只需配置 `ANTHROPIC_API_KEY` 即可
- 如果使用其他平台，需要同时配置这三个变量
- 确保目标平台的 API 与 Anthropic API 兼容（或提供兼容的接口）
- Web Search 功能目前仅支持 Anthropic 官方 API，使用其他平台时该功能可能不可用

**支持的第三方平台示例**：
- OpenAI (GPT-4o, GPT-4-turbo 等)
- DeepSeek (deepseek-chat, deepseek-coder 等)
- 其他兼容 OpenAI API 格式的服务

### 1. API 限制

- **Claude API**:
  - 速率限制：根据 API 密钥等级
  - Token 限制：每请求最多 8K tokens（建议 4K）
  - 并发限制：每个 API 密钥同时最多 5 个请求

- **Web Search**:
  - 需要在 Anthropic Console 中启用 Web Search
  - 有搜索次数限制（$10/1000 次搜索）
  - 域名过滤需要与组织级别设置兼容
  - ⚠️ 仅支持 Anthropic 官方 API

- **Trending 页面**:
  - 没有官方 API，依赖 HTML 解析
  - 可能有反爬机制
  - 建议添加请求间隔和 User-Agent

### 2. 错误处理

- **网络请求失败**:
  - 实现指数退避重试策略
  - 最多重试 3 次
  - 重试间隔：1s, 2s, 4s

- **Claude API 超时或失败**:
  - 实现降级方案（使用缓存或默认内容）
  - 记录错误详情
  - 发送告警通知（可选）

- **Web Search 失败**:
  Web Search 不计费失败，但仍需处理：
  - 记录失败详情
  - 使用基础信息降级
  - 尝试减少搜索次数

### 3. 成本优化

- **减少搜索次数**:
  - 限制分析的项目数量（TRENDING_LIMIT）
  - 每个项目最多 2 次搜索
  - 启用域过滤提高搜索质量

- **优化 Token 消耗**:
  - 简洁明了的 Prompt
  - 明确期望的输出格式
  - 使用 Few-shot 示例减少歧义

- **监控和告警**:
  - 记录每次执行的 token 消耗
  - 记录 Web Search 使用次数
  - 设置成本阈值（如每日 $5）
  - 超过阈值时发送告警

### 4. 邮件优化

- **避免被识别为垃圾邮件**:
  - 使用验证过的发件人域名
  - 添加 SPF、DKIM、DMARC 记录
  - 控制发送频率（每天一次）
  - 提供退订链接

- **响应式设计**:
  - 支持移动端浏览
  - 使用 Tailwind CSS
  - 测试多种邮箱客户端

### 5. 日志记录

- **记录内容**:
  - 执行开始/结束时间
  - API 调用次数和 token 消耗
  - Web Search 次数
  - 工具调用详情
  - 错误信息
  - 邮件发送状态
  - 成本计算

- **日志格式**:
  - JSON 格式（便于解析）
  - 包含时间戳
  - 包含请求 ID（用于追踪）

- **日志级别**:
  - `debug`: 详细的调试信息
  - `info`: 一般信息（推荐）
  - `warn`: 警告信息
  - `error`: 错误信息

### 6. 安全性

- **API Keys 管理**:
  - 使用环境变量
  - 不要提交到版本控制
  - 定期轮换 keys

- **输入验证**:
  - 验证 Claude 返回的 JSON 格式
  - 验证项目 URL 格式
  - 验证邮件地址格式

- **权限最小化**:
  - 只使用必要的 API 权限
  - 限制邮件发送的收件人列表

## 性能优化

### 1. 并发控制

- **并行工具调用**: Claude 支持并行调用多个 Web Search，利用这一点加速执行
- **并行项目分析**: Claude 可以并行搜索多个项目
- **限制并发数**: 避免同时发起过多搜索（建议最多 5 个）

### 2. 缓存策略

- **项目分析缓存**: 根据项目全名缓存分析结果（24 小时有效期）
- **Trending 数据缓存**: 短期缓存 Trending 数据（1 小时有效期）

### 3. 执行时间优化

- **预加载 MCP Servers**: 启动时预先连接 servers
- **减少不必要的搜索**: 只在需要时调用 Web Search
- **域过滤**: 通过 `allowed_domains` 提高搜索效率

## 监控和告警

### 1. 执行指标

- 总执行时间
- API 调用次数和 token 消耗
- Web Search 次数
- 成本计算
- 成功率

### 2. 告警配置

- 执行失败
- 成本超过阈值
- Token 消耗异常
- 搜索次数超过限制
- 邮件发送失败

### 3. 日志聚合

- 使用 GitHub Actions 日志
- 或第三方服务（如 Sentry、LogRocket）

## 成本对比

### 新架构 vs 原架构

| 项目 | 原架构（GitHub MCP） | 新架构（Web Search） |
|------|---------------------|---------------------|
| **Claude API** | $0.10-0.15/次 | $0.05-0.08/次 |
| **GitHub MCP** | $0（GitHub Token 免费） | - |
| **Web Search** | - | $0.15-0.20/次 |
| **总计** | $0.10-0.15/次 | **$0.20-0.28/次** |

虽然新架构成本略高，但有以下优势：
- ✅ 无需 GitHub Token
- ✅ 无需 Docker
- ✅ 依赖更少
- ✅ 更简单的架构
- ✅ 可以获取更多信息（官网、博客、讨论）

## 未来扩展

### 功能扩展

- [ ] 添加多语言支持（英文/中文切换）
- [ ] 支持 Trending Developers
- [ ] 添加 Trending 过滤器（按语言、时间范围）
- [ ] 添加自定义分析维度（如代码质量、社区活跃度）
- [ ] 添加项目对比功能
- [ ] 添加趋势图表（星标增长曲线）
- [ ] 支持 Webhook 通知（自定义回调 URL）

### 集成扩展

- [ ] 支持更多平台（GitLab、Bitbucket）
- [ ] 支持 Telegram/Slack/Matrix 推送
- [ ] 支持自定义邮件模板
- [ ] 支持多个收件人列表
- [ ] 集成更多 MCP Servers（可选）

### AI 扩展

- [ ] 支持自定义 Prompt 模板
- [ ] 支持多轮对话和交互式分析
- [ ] 支持模型切换（Sonnet/Haiku/Opus）
- [ ] 实现 Agent 记忆和学习

### 架构扩展

- [ ] 支持分布式执行（多节点）
- [ ] 实现实时监控 Dashboard
- [ ] 添加数据持久化（存储历史分析）
- [ ] 提供 API 接口（手动触发、查询历史）

## 测试策略

### 1. 单元测试

- Trending MCP Server 的工具解析
- JSON 提取器的各种格式
- 邮件模板生成
- 参数验证逻辑

### 2. 集成测试

- Web Search 集成
- Claude Tool Use 执行流程
- 邮件发送（使用测试 API）
- 完整端到端流程

### 3. 手动测试

- 本地运行并验证输出
- 检查邮件内容
- 验证 Web Search 搜索质量
- 测试错误场景

### 4. 自动化测试

- GitHub Actions 集成测试（定期运行）
- Mock Web Search（模拟搜索结果）
- Mock Claude API（使用测试响应）

## 故障排查

 ### 常见问题

**Q: Claude 一直调用工具，无法停止**
A: 检查初始 Prompt，确保明确了任务完成条件；添加最大轮数限制

**Q: Web Search 不工作**
A: 确认 Web Search 已在 Anthropic Console 中启用；检查 API 密钥权限；
   ⚠️ 注意：Web Search 仅支持 Anthropic 官方 API，使用自定义模型时该功能不可用

**Q: 如何使用非 Anthropic 官方模型（如 OpenAI GPT-4o）？**
A: 配置以下环境变量：
   ```env
   ANTHROPIC_API_KEY=sk-proj-xxx              # OpenAI API Key
   ANTHROPIC_BASE_URL=https://api.openai.com/v1
   ANTHROPIC_MODEL=gpt-4o
   ```
   注意：使用其他平台时，Web Search 功能可能不可用

**Q: 如何使用第三方代理服务？**
A: 配置代理服务的 API Key、Base URL 和模型名称：
   ```env
   ANTHROPIC_API_KEY=your-proxy-key
   ANTHROPIC_BASE_URL=https://your-proxy.com/v1
   ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
   ```

**Q: 无法提取 JSON 结果**
A: 检查 Claude 的输出格式；优化 Prompt；增加 JSON 提取器的容错能力

**Q: 搜索结果质量差**
A: 优化搜索策略；添加域过滤；在 Prompt 中提供搜索示例

**Q: 邮件发送失败**
A: 检查 Resend API Key；验证发件人域名是否已验证；查看错误日志

**Q: Trending 页面解析失败**
A: 检查页面结构是否变化；更新解析逻辑；添加监控告警

**Q: 成本过高**
A: 减少项目数量（TRENDING_LIMIT）；减少每个项目的搜索次数；使用缓存

### 调试技巧

1. **启用详细日志**: 设置 `LOG_LEVEL=debug`
2. **单步执行**: 暂时禁用某些功能，逐个测试
3. **Mock 工具调用**: 使用模拟数据测试 Claude 的逻辑
4. **监控 API 调用**: 查看实际调用的工具和参数
5. **检查对话历史**: 打印 messages 数组，查看 Claude 的思考过程
6. **测试 Web Search**: 单独测试搜索质量和相关性

## 参考资源

### 官方文档

- [Claude API 文档](https://docs.anthropic.com/en/api)
- [Claude Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Claude Web Search Tool](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool)
- [Resend 文档](https://resend.com/docs)
- [Bun 文档](https://bun.sh/docs)
- [Cheerio 文档](https://cheerio.js.org/)

### 示例代码

- [Claude Tool Use 示例](https://github.com/anthropics/anthropic-cookbook/tree/main/tool-use)
- [Web Search 示例](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool)
- [Trending 爬虫示例](https://github.com/hackergrrl/github-trending-scraper)

### 社区资源

- [Anthropic Console](https://console.anthropic.com) - API 管理
- [Claude Discord](https://discord.gg/anthropic) - 社区支持

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m "Add some AmazingFeature"`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request
