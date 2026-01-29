#!/usr/bin/env bun
import type { TrendingRepository } from '../../types/index.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import * as cheerio from 'cheerio'

interface TrendingToolArgs {
  limit?: number
  language?: string
  timeframe?: 'daily' | 'weekly' | 'monthly'
}

const server = new Server(
  {
    name: 'github-trending-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_trending_repositories',
        description: '获取 GitHub Trending 页面的热门开源项目列表',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: '返回数量，默认 10',
              default: 10,
            },
            language: {
              type: 'string',
              description: '过滤语言，如 "javascript", "python"',
            },
            timeframe: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly'],
              description: '时间范围，默认 daily',
              default: 'daily',
            },
          },
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_trending_repositories') {
    const args = (request.params.arguments ?? {}) as TrendingToolArgs
    const limit = typeof args.limit === 'number' ? args.limit : 10
    const filterLanguage = args.language
    const timeframe = (args.timeframe === 'weekly' || args.timeframe === 'monthly') ? args.timeframe : 'daily'

    let url = 'https://github.com/trending'

    if (filterLanguage) {
      url += `/${filterLanguage}`
    }

    if (timeframe !== 'daily') {
      url += `?since=${timeframe}`
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch GitHub Trending: ${response.statusText}`)
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const repositories: TrendingRepository[] = []

      $('article.Box-row').each((index, element) => {
        if (index >= limit)
          return false

        const $el = $(element)
        const titleLink = $el.find('h2 a')
        const name = titleLink.text().trim().replace(/\s+/g, '')

        const description = $el.find('p').first().text().trim()

        const languageSpan = $el.find('[itemprop="programmingLanguage"]').first()
        const repoLanguage = languageSpan.text().trim()

        const starsLink = $el.find('a[href*="/stargazers"]').first()
        const starsText = starsLink.text().trim()
        const stars = starsText ? Number.parseInt(starsText.replace(/,/g, '')) : 0

        const forksLink = $el.find('a[href*="/forks"]').first()
        const forksText = forksLink.text().trim()
        const forks = forksText ? Number.parseInt(forksText.replace(/,/g, '')) : 0

        const repoUrl = `https://github.com/${name}`

        if (name) {
          repositories.push({
            name,
            fullName: name,
            description,
            language: repoLanguage,
            stars,
            forks,
            url: repoUrl,
          })
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(repositories, null, 2),
          },
        ],
      }
    }
    catch (error: unknown) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
        isError: true,
      }
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
    isError: true,
  }
})

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main()
