import type { ClaudeMessage, TrendingAnalysisResult } from '../../types/index.js'
import { logger } from './logger.js'

export function extractJSON(messages: ClaudeMessage[]): TrendingAnalysisResult {
  logger.info(`extractJSON: 收到 ${messages.length} 条消息`)
  logger.info(`extractJSON: messages 类型`, typeof messages)

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (!message)
      continue
    // logger.info(`extractJSON: 消息 ${i} type=${message.type}, hasContent=${!!message.content}, contentLength=${Array.isArray(message.content) ? message.content.length : 'N/A'}`)

    if (message.type === 'assistant') {
      const content = message.content
      if (Array.isArray(content)) {
        // logger.info(`extractJSON: 消息 ${i} 是 assistant 类型，有 ${content.length} 个 content item`)
        for (let j = 0; j < content.length; j++) {
          const item = content[j]
          if (!item)
            continue
          // logger.info(`extractJSON:   item ${j} type=${item.type}, hasText=${!!item.text}, textLength=${item.text ? item.text.length : 0}`)
          if (item.type === 'text' && item.text) {
            const parsed = tryExtractJSON(item.text)
            if (parsed) {
              // logger.info(`extractJSON: 从消息 ${i} 的第 ${j} 个 content item 中提取到 JSON`)
              return parsed
            }
          }
        }
      }
    }
    else if (message.type === 'result' && message.result) {
      const parsed = tryExtractJSON(message.result)
      if (parsed) {
        // logger.info(`extractJSON: 从消息 ${i} 的 result 字段中提取到 JSON`)
        return parsed
      }
    }
  }

  const errorMsg = '无法从 Claude 响应中提取有效的 JSON 数据'
  logger.error(errorMsg)
  logger.info('所有消息详情:', JSON.stringify(messages, null, 2))
  throw new Error(errorMsg)
}

function tryExtractJSON(text: string): TrendingAnalysisResult | null {
  let cleanText = text.trim()

  const codeBlockMatch = cleanText.match(/```(?:json)?\n([\s\S]*?)\n```/)
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleanText = codeBlockMatch[1].trim()
  }

  try {
    return JSON.parse(cleanText)
  }
  catch {
    const jsonBracketsMatch = cleanText.match(/\{[\s\S]*\}/)
    if (jsonBracketsMatch) {
      try {
        return JSON.parse(jsonBracketsMatch[0])
      }
      catch {
        return null
      }
    }
    return null
  }
}
