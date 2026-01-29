import process from 'node:process'
import { Resend } from 'resend'
import { logger } from '../utils/logger.js'

const resend = new Resend(process.env.RESEND_API_KEY || '')

const MAX_RETRIES = 3
const RETRY_DELAY = 1000
const emailSendEnabled = !['false', '0', 'no'].includes((process.env.EMAIL_SEND_ENABLED || '').toLowerCase())
const isDevelopment = process.env.NODE_ENV === 'development'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendEmailWithRetry(
  html: string,
  retryCount: number = 0,
): Promise<void> {
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const toEmail = process.env.RESEND_TO_EMAIL
  const date = new Date().toISOString().split('T')[0]

  if (!fromEmail || !toEmail) {
    throw new Error('Missing required email environment variables: RESEND_FROM_EMAIL or RESEND_TO_EMAIL')
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: `GitHub Trending 每日推送 - ${date}`,
      html,
    })

    if (error) {
      throw error
    }

    logger.info('邮件发送成功', { emailId: data.id })
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (retryCount < MAX_RETRIES) {
      logger.warn(`邮件发送失败，${RETRY_DELAY}ms 后重试 (${retryCount + 1}/${MAX_RETRIES})`, {
        error: errorMessage,
      })
      await sleep(RETRY_DELAY)
      await sendEmailWithRetry(html, retryCount + 1)
    }
    else {
      logger.error('邮件发送失败，已达到最大重试次数', { error })
      throw error
    }
  }
}

export async function sendEmail(html: string): Promise<void> {
  try {
    if (isDevelopment || !emailSendEnabled) {
      logger.info('开发模式或已关闭邮件发送，改为输出邮件内容到控制台')
      console.log(html)
      return
    }

    await sendEmailWithRetry(html)
  }
  catch (error: unknown) {
    logger.error('发送邮件时出错', error)
    throw error
  }
}
