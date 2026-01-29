import { query } from '@anthropic-ai/claude-agent-sdk';
import { generateEmail } from './email/emailGenerator.js';
import { sendEmail } from './email/emailSender.js';
import { extractJSON } from './utils/jsonExtractor.js';
import { logger } from './utils/logger.js';
import { getAgentPrompt } from './claude/agent.js';

async function main(): Promise<void> {
  logger.info('开始执行 GitHub Trending 分析任务');

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable');
    }

    const messages: any[] = [];
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4.5';
    const agentPrompt = getAgentPrompt();

    logger.info('开始执行 Claude Agent 分析任务...');
    logger.debug(`使用模型: ${model}`);

    for await (const message of query({
      prompt: agentPrompt,
      options: {
        model,
        allowedTools: ['WebSearch', 'mcp__trending__get_trending_repositories'],
        mcpServers: {
          trending: {
            command: 'bun',
            args: ['run', './src/mcp/trendingMcpServer.ts'],
          },
        },
        tools: [],
        disallowedTools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
      },
    })) {
      messages.push(message);
      logger.debug(`收到消息: ${message.type}`);

      if (message.type === 'result' &&
          (message.subtype === 'success' || message.subtype?.startsWith('error_'))) {
        logger.info('Claude 分析完成');

        if (message.subtype?.startsWith('error_')) {
          const errorMsg = (message as any).errors?.join(', ') || '任务执行失败';
          logger.error('任务执行错误:', errorMsg);
          throw new Error(errorMsg);
        }
        break;
      }
    }

    logger.info(`总共收到 ${messages.length} 条消息`);

    logger.info('提取 JSON 分析结果...');
    
    logger.info('所有消息类型:', messages.map(m => ({ type: m.type, subtype: m.subtype })));
    
    const analysis = extractJSON(messages);
    logger.info(`成功分析了 ${analysis.projects.length} 个项目`);
    logger.debug(`分析日期: ${analysis.date}`);

    logger.info('生成邮件模板...');
    const emailHtml = generateEmail(analysis);
    logger.debug('邮件模板已生成 (长度: ' + emailHtml.length + ' 字符)');

    logger.info('发送邮件...');
    await sendEmail(emailHtml);
    logger.info('邮件已发送成功');

    logger.info('任务完成！');
  } catch (error) {
    logger.error('任务执行失败:', error);
    process.exit(1);
  }
}

main();
