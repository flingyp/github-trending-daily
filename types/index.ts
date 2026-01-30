// ========================================
// Trending 相关类型
// ========================================

export interface TrendingRepository {
  name: string
  fullName: string
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
  summary: string
  techStack: string[]
  features: string[]
  trendingReason: string
  recommendationScore: number
  recommendationReason: string
  isNewProject?: boolean
  starsChange?: number | null
  popularityTrend?: 'new' | 'rising' | 'stable' | 'declining'
  highlightLevel?: 'top' | 'recommended' | 'watch'
  category?: string
}

export interface TrendingAnalysisResult {
  date: string
  projects: ProjectAnalysis[]
  summary: string
  theme?: string
  topProject?: ProjectAnalysis
  techTrends?: string[]
  newProjectCount?: number
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

// ========================================
// Claude Agent 消息类型
// ========================================

export interface ClaudeMessageContent {
  type: string
  text?: string
}

export interface ClaudeMessage {
  type: string
  subtype?: string
  content?: ClaudeMessageContent[]
  result?: string
  errors?: string[]
  event?: unknown
  parent_tool_use_id?: string | null
}
