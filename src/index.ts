import type { ClaudeMessage } from '../types/index.js'
import process from 'node:process'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { getAgentPrompt } from './claude/agent.js'
import { generateEmail } from './email/emailGenerator.js'
import { sendEmail } from './email/emailSender.js'
import { extractJSON } from './utils/jsonExtractor.js'
import { logger } from './utils/logger.js'

function isTruthy(value: string | undefined): boolean {
  if (!value)
    return false
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const logLlmOutput = isTruthy(process.env.LOG_LLM_OUTPUT)
const logLlmStream = isTruthy(process.env.LOG_LLM_STREAM)
let hasStreamedText = false

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStreamEventType(event: unknown): string | null {
  if (!isRecord(event))
    return null
  return typeof event.type === 'string' ? event.type : null
}

function extractStreamText(event: unknown): string | null {
  if (!isRecord(event))
    return null

  if (event.type === 'content_block_delta') {
    const delta = event.delta
    if (isRecord(delta) && delta.type === 'text_delta' && typeof delta.text === 'string')
      return delta.text
  }

  if (event.type === 'content_block_start') {
    const contentBlock = event.content_block
    if (isRecord(contentBlock) && contentBlock.type === 'text' && typeof contentBlock.text === 'string' && contentBlock.text.length > 0)
      return contentBlock.text
  }

  return null
}

function ensureStreamNewline(): void {
  if (!hasStreamedText)
    return
  process.stdout.write('\n')
  hasStreamedText = false
}

function logClaudeOutput(message: ClaudeMessage): void {
  if (!logLlmOutput && !logLlmStream)
    return

  if (logLlmStream && message.type === 'stream_event') {
    const text = extractStreamText(message.event)
    if (text) {
      hasStreamedText = true
      process.stdout.write(text)
      return
    }

    const eventType = getStreamEventType(message.event)
    if (eventType === 'message_stop')
      ensureStreamNewline()
    return
  }

  if (logLlmOutput && !logLlmStream) {
    if (message.type === 'assistant' && Array.isArray(message.content)) {
      for (const item of message.content) {
        if (item?.type === 'text' && item.text) {
          logger.info(`[LLM] ${item.text}`)
        }
      }
      return
    }

    if (message.type === 'result' && message.result) {
      logger.info(`[LLM RESULT]\n${message.result}`)
    }
  }
}

async function main(): Promise<void> {
  logger.info('开始执行 GitHub Trending 分析任务')

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }

    const messages: ClaudeMessage[] = []
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4.5'
    const maxRepos = process.env.MAX_TRENDING_REPOS ? Number.parseInt(process.env.MAX_TRENDING_REPOS) : undefined
    if (maxRepos) {
      logger.warn(`降级模式：已设置 MAX_TRENDING_REPOS=${maxRepos}，最多分析前 ${maxRepos} 个项目`)
    }
    const agentPrompt = getAgentPrompt(maxRepos)

    logger.info('开始执行 Claude Agent 分析任务...')
    logger.debug(`使用模型: ${model}`)

    for await (const message of query({
      prompt: agentPrompt,
      options: {
        model,
        allowedTools: ['WebSearch', 'mcp__trending__get_trending_repositories'],
        includePartialMessages: logLlmStream,
        mcpServers: {
          trending: {
            command: 'bun',
            args: ['run', './src/mcp/trendingMcpServer.ts'],
          },
        },
        tools: {
          type: 'preset',
          preset: 'claude_code',
        },
        disallowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      },
    }) as AsyncIterable<ClaudeMessage>) {
      messages.push(message)
      logClaudeOutput(message)
      if (!logLlmStream)
        logger.debug(`收到消息: ${message.type}`)

      if (message.type === 'result'
        && (message.subtype === 'success' || message.subtype?.startsWith('error_'))) {
        ensureStreamNewline()
        logger.info('Claude 分析完成')

        if (message.subtype?.startsWith('error_')) {
          const errorMsg = message.errors?.join(', ') || '任务执行失败'
          logger.error('任务执行错误:', errorMsg)
          throw new Error(errorMsg)
        }
        break
      }
    }

    logger.info(`总共收到 ${messages.length} 条消息`)

    logger.info('提取 JSON 分析结果...')

    logger.info('所有消息类型:', messages.map(m => ({ type: m.type, subtype: m.subtype })))

    const analysis = extractJSON(messages)
    logger.info(`成功分析了 ${analysis.projects.length} 个项目`)
    logger.debug(`分析日期: ${analysis.date}`)

    logger.info('生成邮件模板...')
    const emailHtml = generateEmail(analysis)
    logger.debug(`邮件模板已生成 (长度: ${emailHtml.length} 字符)`)

    logger.info('发送邮件...')
    await sendEmail(emailHtml)
    logger.info('邮件已发送成功')

    logger.info('任务完成！')
  }
  catch (error) {
    logger.error('任务执行失败:', error)
    process.exit(1)
  }
}

main()
