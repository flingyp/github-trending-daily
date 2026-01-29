import type { ProjectAnalysis, TrendingAnalysisResult } from '../../types/index.js'

export function generateEmail(analysis: TrendingAnalysisResult): string {
  const { date, projects, summary } = analysis

  const languageStats = calculateLanguageStats(projects)
  const avgScore = calculateAverageScore(projects)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub Trending 每日推送 - ${date}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <div class="max-w-4xl mx-auto p-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-lg p-8 text-white text-center">
      <h1 class="text-4xl font-bold mb-2">🚀 GitHub Trending 每日推送</h1>
      <p class="text-xl opacity-90">${date} · 共 ${projects.length} 个热门项目</p>
    </div>

    <!-- Summary -->
    <div class="bg-white p-6 border-b border-gray-200">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">✨ 今日重点推荐</h2>
      <p class="text-gray-700 leading-relaxed">${summary}</p>
    </div>

    <!-- Statistics -->
    <div class="bg-gray-50 p-6 border-b border-gray-200">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div class="bg-white p-4 rounded-lg shadow-sm">
          <div class="text-3xl font-bold text-purple-600">${projects.length}</div>
          <div class="text-sm text-gray-600">项目总数</div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow-sm">
          <div class="text-3xl font-bold text-indigo-600">${avgScore.toFixed(1)}</div>
          <div class="text-sm text-gray-600">平均推荐分</div>
        </div>
        <div class="bg-white p-4 rounded-lg shadow-sm">
          <div class="text-3xl font-bold text-pink-600">${Object.keys(languageStats).length}</div>
          <div class="text-sm text-gray-600">语言种类</div>
        </div>
      </div>
    </div>

    <!-- Language Distribution -->
    <div class="bg-white p-6 border-b border-gray-200">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">📊 语言分布</h2>
      <div class="flex flex-wrap gap-2">
        ${Object.entries(languageStats).map(([lang, count]) => `
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            ${lang}: ${count}
          </span>
        `).join('')}
      </div>
    </div>

    <!-- Projects List -->
    <div class="bg-white border-b border-gray-200">
      ${projects.map((project, index) => generateProjectCard(project, index)).join('')}
    </div>

    <!-- Footer -->
    <div class="bg-gray-800 rounded-b-lg p-6 text-center text-gray-300">
      <p class="text-sm mb-2">由 AI 自动分析生成，仅供参考</p>
      <p class="text-xs text-gray-500">© 2025 GitHub Trending Daily</p>
    </div>
  </div>
</body>
</html>`
}

function generateProjectCard(project: ProjectAnalysis, index: number): string {
  const scoreColor = getScoreColor(project.recommendationScore)
  const scoreBadge = project.recommendationScore >= 8
    ? '🔥 高推荐'
    : project.recommendationScore >= 6 ? '⭐ 推荐' : '👀 关注'

  return `
    <div class="p-6 border-b border-gray-100 ${index === 0 ? 'bg-yellow-50' : ''}">
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          <h3 class="text-xl font-bold text-gray-900 mb-1">
            <span class="text-gray-600 mr-2">#${index + 1}</span>
            <a href="${project.name.startsWith('http') ? project.name : `https://github.com/${project.name}`}" 
               class="text-indigo-600 hover:text-indigo-800" 
               target="_blank" 
               rel="noopener noreferrer">
              ${project.name}
            </a>
          </h3>
          <p class="text-gray-600 mb-3">${project.summary}</p>
        </div>
        <div class="text-right ml-4">
          <div class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${scoreColor}">
            ${scoreBadge} (${project.recommendationScore}/10)
          </div>
        </div>
      </div>

      <div class="mb-4">
        <h4 class="text-sm font-semibold text-gray-500 mb-2">主要技术栈</h4>
        <div class="flex flex-wrap gap-2">
          ${project.techStack.map((tech: string) => `
            <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
              ${tech}
            </span>
          `).join('')}
        </div>
      </div>

      <div class="mb-4">
        <h4 class="text-sm font-semibold text-gray-500 mb-2">核心功能</h4>
        <ul class="list-disc list-inside text-gray-700 space-y-1">
          ${project.features.map((feature: string) => `
            <li>${feature}</li>
          `).join('')}
        </ul>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg">
        <h4 class="text-sm font-semibold text-gray-500 mb-2">❓ 为什么 Trending</h4>
        <p class="text-gray-700">${project.trendingReason}</p>
      </div>

      <div class="mt-4 pt-4 border-t border-gray-100">
        <h4 class="text-sm font-semibold text-gray-500 mb-2">💡 推荐理由</h4>
        <p class="text-gray-700">${project.recommendationReason}</p>
      </div>

      <div class="mt-4 text-center">
        <a href="${project.name.startsWith('http') ? project.name : `https://github.com/${project.name}`}" 
           class="inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
           target="_blank"
           rel="noopener noreferrer">
          📦 查看项目
        </a>
      </div>
    </div>
  `
}

function getScoreColor(score: number): string {
  if (score >= 8)
    return 'bg-red-100 text-red-800'
  if (score >= 6)
    return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-800'
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
