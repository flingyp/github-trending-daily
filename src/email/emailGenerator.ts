import type { ProjectAnalysis, TrendingAnalysisResult } from '../../types/index.js'

export function generateEmail(analysis: TrendingAnalysisResult): string {
  const { date, projects, summary, theme, topProject, techTrends, newProjectCount } = analysis

  const languageStats = calculateLanguageStats(projects)
  const avgScore = calculateAverageScore(projects)
  const recommendedProjects = projects.filter(p => p.highlightLevel === 'recommended')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub Trending 每日推送 - ${date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; }
    a { text-decoration: none; color: #0066cc; }
    @media only screen and (max-width: 600px) {
      .stats-table, .grid-2 { width: 100% !important; }
      .stat-col { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body bgcolor="#f6f6f6" style="margin: 0; padding: 20px; background-color: #f6f6f6;">
  <table cellpadding="0" cellspacing="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
    
    <!-- Header -->
    <tr>
      <td style="background-color: #0066cc; padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 10px 0; font-weight: 600;">🚀 GitHub Trending 每日推送</h1>
        <p style="color: #ffffff; font-size: 18px; margin: 0 0 15px 0; opacity: 0.95;">${date}</p>
        ${theme ? `<div style="background-color: rgba(255,255,255,0.15); color: #ffffff; padding: 10px 20px; display: inline-block; border-radius: 20px; font-size: 16px; font-weight: 500;">🎯 今日主题: ${theme}</div>` : ''}
      </td>
    </tr>

    <!-- Stats -->
    <tr>
      <td style="padding: 30px; border-bottom: 1px solid #e5e5e5;">
        <table cellpadding="0" cellspacing="0" width="100%" class="stats-table">
          <tr>
            <td class="stat-col" style="width: 25%; text-align: center; padding: 15px 10px; background-color: #f8f9ff; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: 600; color: #0066cc; margin-bottom: 5px;">${projects.length}</div>
              <div style="font-size: 13px; color: #666; font-weight: 500;">📦 项目总数</div>
            </td>
            <td class="stat-col" style="width: 25%; text-align: center; padding: 15px 10px; background-color: #fff8f0; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: 600; color: #ff6600; margin-bottom: 5px;">${avgScore.toFixed(1)}</div>
              <div style="font-size: 13px; color: #666; font-weight: 500;">⭐ 平均分</div>
            </td>
            <td class="stat-col" style="width: 25%; text-align: center; padding: 15px 10px; background-color: #f0fff0; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: 600; color: #00aa44; margin-bottom: 5px;">${newProjectCount || 0}</div>
              <div style="font-size: 13px; color: #666; font-weight: 500;">🆕 新项目</div>
            </td>
            <td class="stat-col" style="width: 25%; text-align: center; padding: 15px 10px; background-color: #f0f8ff; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: 600; color: #0088cc; margin-bottom: 5px;">${techTrends?.length || 0}</div>
              <div style="font-size: 13px; color: #666; font-weight: 500;">🔥 技术趋势</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Tech Trends -->
    ${techTrends && techTrends.length > 0
      ? `
    <tr>
      <td style="padding: 25px 30px; border-bottom: 1px solid #e5e5e5;">
        <h2 style="font-size: 20px; margin: 0 0 15px 0; font-weight: 600; color: #333;">🔥 今日技术热词</h2>
        <table cellpadding="0" cellspacing="0">
          <tr>
            ${techTrends.map((trend, index) => `
              <td style="background-color: ${getSolidColor(index)}; color: #ffffff; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; margin-right: 10px; margin-bottom: 10px; display: inline-block;">
                ${trend}
              </td>
            `).join('')}
          </tr>
        </table>
      </td>
    </tr>
    `
      : ''}

    <!-- Top Project -->
    ${topProject
      ? `
    <tr>
      <td style="padding: 25px 30px; border-bottom: 1px solid #e5e5e5; background-color: #fff8f0;">
        <h2 style="font-size: 22px; margin: 0 0 20px 0; font-weight: 600; color: #333; text-align: center;">👑 今日王者项目</h2>
        ${generateProjectCard(topProject, 0, true)}
      </td>
    </tr>
    `
      : ''}

    <!-- Recommended Projects -->
    ${recommendedProjects.length > 0
      ? `
    <tr>
      <td style="padding: 25px 30px; border-bottom: 1px solid #e5e5e5;">
        <h2 style="font-size: 22px; margin: 0 0 20px 0; font-weight: 600; color: #333;">⭐ 精选推荐</h2>
        <table cellpadding="0" cellspacing="0" width="100%" class="grid-2">
          ${recommendedProjects.map((project, index) => `
            <tr>
              <td style="padding: 10px 5px;">
                ${generateProjectCard(project, index + (topProject ? 1 : 1), false)}
              </td>
            </tr>
          `).join('')}
        </table>
      </td>
    </tr>
    `
      : ''}

    <!-- Summary -->
    <tr>
      <td style="padding: 25px 30px; border-bottom: 1px solid #e5e5e5; background-color: #f8f9ff;">
        <h2 style="font-size: 18px; margin: 0 0 12px 0; font-weight: 600; color: #333;">✨ 今日重点推荐</h2>
        <p style="color: #555; margin: 0; font-size: 15px;">${summary}</p>
      </td>
    </tr>

    <!-- All Projects List -->
    <tr>
      <td style="padding: 25px 30px; border-bottom: 1px solid #e5e5e5;">
        <h2 style="font-size: 22px; margin: 0 0 20px 0; font-weight: 600; color: #333;">📋 所有项目</h2>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${projects.map((project, index) => `
            <tr>
              <td style="padding: 10px 0;">
                ${generateProjectCard(project, index, false, true)}
              </td>
            </tr>
          `).join('')}
        </table>
      </td>
    </tr>

    <!-- Language Distribution -->
    <tr>
      <td style="padding: 25px 30px; border-bottom: 1px solid #e5e5e5; background-color: #fafafa;">
        <h2 style="font-size: 18px; margin: 0 0 15px 0; font-weight: 600; color: #333;">📊 语言分布</h2>
        <table cellpadding="0" cellspacing="0">
          <tr>
            ${Object.entries(languageStats).map(([lang, count]) => `
              <td style="background-color: #e8f0fe; color: #1a73e8; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; margin-right: 8px; margin-bottom: 8px; display: inline-block;">
                ${getLanguageEmoji(lang)} ${lang}: ${count}
              </td>
            `).join('')}
          </tr>
        </table>
      </td>
    </tr>

    <!-- Tips -->
    <tr>
      <td style="padding: 25px 30px; border-bottom: 1px solid #e5e5e5; background-color: #f0f8ff;">
        <h2 style="font-size: 18px; margin: 0 0 12px 0; font-weight: 600; color: #333;">💡 每日小贴士</h2>
        <p style="color: #555; margin: 0; font-size: 14px;">${generateTips(analysis)}</p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #333; padding: 30px; text-align: center;">
        <p style="color: #aaa; margin: 0 0 8px 0; font-size: 13px;">由 AI 自动分析生成，仅供参考</p>
        <p style="color: #888; margin: 0; font-size: 11px;">© 2026 GitHub Trending Daily</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function generateProjectCard(project: ProjectAnalysis, index: number, isKing: boolean = false, isSimple: boolean = false): string {
  const scoreBgColor = isKing ? '#ff6600' : (project.recommendationScore >= 8 ? '#dc2626' : project.recommendationScore >= 6 ? '#d97706' : '#6b7280')
  const scoreTextColor = '#ffffff'
  const highlightLevel = project.highlightLevel || 'watch'
  const borderLeft = isKing ? '4px solid #ff6600' : (highlightLevel === 'recommended' ? '4px solid #6f42c1' : '1px solid #e5e5e5')
  const bgColor = isKing ? '#ffffff' : (highlightLevel === 'recommended' ? '#ffffff' : '#fafafa')

  const isNew = project.isNewProject
  const popularityText = getPopularityText(project.popularityTrend)
  const starsChangeText = project.starsChange ? `⬆️ +${project.starsChange}` : ''
  const projectUrl = project.name.startsWith('http') ? project.name : `https://github.com/${project.name}`

  if (isSimple && !isKing) {
    return `
    <table cellpadding="0" cellspacing="0" width="100%" style="background-color: ${bgColor}; border-radius: 6px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; border-left: ${borderLeft}; border: 1px solid #e5e5e5; border-left-width: ${isKing || highlightLevel === 'recommended' ? '4px' : '1px'};">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="60%">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color: #f0f0f0; color: #666; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-bottom: 8px;">${index + 1}</td>
                    ${highlightLevel !== 'watch' ? `<td style="padding: 4px 8px; margin-left: 8px;">${getBadge(highlightLevel)}</td>` : ''}
                    ${isNew ? `<td style="background-color: #28a745; color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; margin-left: 8px;">🆕 新</td>` : ''}
                  </tr>
                </table>
              </td>
              <td align="right" width="40%">
                <div style="background-color: ${scoreBgColor}; color: ${scoreTextColor}; padding: 8px 16px; border-radius: 20px; display: inline-block; font-size: 18px; font-weight: 600;">${project.recommendationScore}/10</div>
              </td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <h3 style="font-size: 18px; margin: 12px 0; font-weight: 600; color: #333;">
                  <a href="${projectUrl}" target="_blank" style="color: #0066cc; text-decoration: none;">${project.name}</a>
                  ${starsChangeText ? `<span style="font-size: 13px; color: #999; margin-left: 8px;">${starsChangeText}</span>` : ''}
                </h3>
              </td>
            </tr>
          </table>
          <p style="color: #666; font-size: 14px; margin: 0 0 12px 0; line-height: 1.5;">${project.summary}</p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td>
                ${project.category ? `<span style="background-color: #f0f0f0; color: #666; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500;">${project.category}</span>` : ''}
                ${popularityText ? `<span style="margin-left: 8px; font-size: 12px; color: #999;">${popularityText}</span>` : ''}
              </td>
              <td align="right">
                <a href="${projectUrl}" target="_blank" style="color: #0066cc; font-size: 14px; font-weight: 500; text-decoration: none;">查看详情 →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    `
  }

  return `
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 3px solid #ff6600;">
    <tr>
      <td style="padding: 25px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="85%">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 30px;">👑</td>
                  <td>
                    <h3 style="font-size: 24px; margin: 0 0 10px 0; font-weight: 600; color: #333;">
                      <a href="${projectUrl}" target="_blank" style="color: #0066cc; text-decoration: none;">${project.name}</a>
                    </h3>
                  </td>
                </tr>
              </table>
              <p style="color: #555; font-size: 15px; margin: 0 0 10px 0; line-height: 1.5;">${project.summary}</p>
              ${starsChangeText ? `<p style="color: #999; font-size: 13px; margin: 0 0 15px 0;">${starsChangeText} 今日新增</p>` : ''}
            </td>
            <td width="15%" align="right" valign="top">
              <div style="background-color: #ff6600; color: #ffffff; padding: 12px 20px; border-radius: 12px; display: inline-block; font-size: 28px; font-weight: 600;">${project.recommendationScore}<span style="font-size: 14px; font-weight: normal; margin-left: 2px;">/10</span></div>
              <p style="color: #999; font-size: 11px; margin: 8px 0 0 0;">${popularityText}</p>
            </td>
          </tr>
        </table>

        ${project.category
          ? `
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="background-color: #f0f0f0; color: #666; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;">📁 ${project.category}</span>
            </td>
          </tr>
        </table>
        `
          : ''}

        ${project.techStack && project.techStack.length > 0
          ? `
        <table cellpadding="0" cellspacing="0" width="100%" style="margin: 15px 0;">
          <tr>
            <td>
              <p style="font-size: 13px; font-weight: 600; color: #666; margin: 0 0 8px 0;">主要技术栈</p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  ${project.techStack.map((tech: string) => `
                    <td style="background-color: #e3f2fd; color: #1976d2; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; margin-right: 8px; display: inline-block;">
                      ${tech}
                    </td>
                  `).join('')}
                </tr>
              </table>
            </td>
          </tr>
        </table>
        `
          : ''}

        ${project.features && project.features.length > 0
          ? `
        <table cellpadding="0" cellspacing="0" width="100%" style="margin: 15px 0;">
          <tr>
            <td>
              <p style="font-size: 13px; font-weight: 600; color: #666; margin: 0 0 8px 0;">核心功能</p>
              <table cellpadding="0" cellspacing="0">
                ${project.features.map((feature: string) => `
                  <tr>
                    <td style="padding: 4px 0; color: #555; font-size: 14px;">• ${feature}</td>
                  </tr>
                `).join('')}
              </table>
            </td>
          </tr>
        </table>
        `
          : ''}

        <table cellpadding="0" cellspacing="0" width="100%" style="margin: 15px 0;">
          <tr>
            <td style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 3px solid #0066cc;">
              <p style="font-size: 13px; font-weight: 600; color: #666; margin: 0 0 6px 0;">❓ 为什么 Trending</p>
              <p style="color: #555; margin: 0; font-size: 14px; line-height: 1.5;">${project.trendingReason}</p>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" width="100%" style="margin: 15px 0;">
          <tr>
            <td style="background-color: #f3e5f5; padding: 15px; border-radius: 6px; border-left: 3px solid #6f42c1;">
              <p style="font-size: 13px; font-weight: 600; color: #666; margin: 0 0 6px 0;">💡 推荐理由</p>
              <p style="color: #555; margin: 0; font-size: 14px; line-height: 1.5;">${project.recommendationReason}</p>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${projectUrl}" target="_blank" style="background-color: #0066cc; color: #ffffff; padding: 12px 32px; border-radius: 6px; font-size: 16px; font-weight: 600; text-decoration: none; display: inline-block;">📦 查看项目</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `
}

function getSolidColor(index: number): string {
  const colors = [
    '#0066cc',
    '#0088aa',
    '#00aa66',
    '#cc0066',
    '#ff6600',
  ]
  return colors[index % colors.length] || '#0066cc'
}

function getPopularityText(trend?: string): string {
  switch (trend) {
    case 'new':
      return '🆕 新'
    case 'rising':
      return '📈 上升'
    case 'stable':
      return '📊 稳定'
    case 'declining':
      return '📉 下降'
    default:
      return '👀 关注'
  }
}

function getBadge(level: string): string {
  switch (level) {
    case 'top':
      return '<span style="background-color: #ff6600; color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;">🏆 王者</span>'
    case 'recommended':
      return '<span style="background-color: #6f42c1; color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;">⭐ 推荐</span>'
    default:
      return '<span style="background-color: #999; color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;">👀 关注</span>'
  }
}

function getLanguageEmoji(lang: string): string {
  const emojiMap: Record<string, string> = {
    'TypeScript': '📘',
    'JavaScript': '📒',
    'Python': '🐍',
    'Go': '🐹',
    'Rust': '🦀',
    'Java': '☕',
    'Ruby': '💎',
    'PHP': '🐘',
    'C++': '⚡',
    'C#': '🎯',
  }
  return emojiMap[lang] || '💾'
}

function calculateLanguageStats(projects: ProjectAnalysis[]): Record<string, number> {
  const stats: Record<string, number> = {}

  for (const project of projects) {
    for (const lang of project.techStack) {
      stats[lang] = (stats[lang] || 0) + 1
    }
  }

  return stats
}

function calculateAverageScore(projects: ProjectAnalysis[]): number {
  if (projects.length === 0)
    return 0
  const total = projects.reduce((sum, p) => sum + p.recommendationScore, 0)
  return total / projects.length
}

function generateTips(analysis: TrendingAnalysisResult): string {
  const { projects, newProjectCount, techTrends } = analysis
  let tips = ''

  if (newProjectCount && newProjectCount > 0) {
    tips += `今日有 ${newProjectCount} 个新项目首次出现在 Trending 列表中，值得特别关注。`
  }

  if (techTrends && techTrends.length > 0) {
    const topTrend = techTrends[0]
    tips += ` 今日最热门的技术趋势是"${topTrend}"，建议深入了解相关技术栈和最佳实践。`
  }

  const topProject = projects.find(p => p.highlightLevel === 'top')
  if (topProject) {
    tips += ` 最值得关注的是"${topProject.name}"，它在创新性和影响力方面表现突出。`
  }

  return tips || '建议关注今日高分推荐项目，它们在实用性和质量方面表现出色。'
}
