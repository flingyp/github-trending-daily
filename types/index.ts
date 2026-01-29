// ========================================
// Trending 相关类型
// ========================================

export interface TrendingRepository {
  name: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  url: string;
}

// ========================================
// Claude 分析结果类型
// ========================================

export interface ProjectAnalysis {
  name: string;
  summary: string;
  techStack: string[];
  features: string[];
  trendingReason: string;
  recommendationScore: number;
  recommendationReason: string;
}

export interface TrendingAnalysisResult {
  date: string;
  projects: ProjectAnalysis[];
  summary: string;
}

// ========================================
// 邮件相关类型
// ========================================

export interface EmailTemplate {
  subject: string;
  html: string;
  to: string;
  from: string;
}

export interface EmailConfig {
  from: string;
  to: string;
  subject?: string;
}
