export interface InterviewConfig {
  targetRole: string
  interviewMode: string
  difficulty: string
  questionCount: number
  focusAreas: string[]
}

export interface InterviewQuestion {
  id: string
  question: string
  type: string
  tags: string[]
  difficulty: string
  source: string
  relatedProjectId?: string
  referenceAnswer: string
}

export interface ChatMessage {
  id: string
  role: 'interviewer' | 'user' | 'system'
  content: string
  createdAt: string
  questionId?: string
  status: 'pending' | 'streaming' | 'done' | 'error'
}

export interface AnswerEvaluation {
  questionId: string
  totalScore: number
  accuracy: number
  completeness: number
  expression: number
  projectRelevance: number
  depth: number
  strengths: string[]
  weaknesses: string[]
  improvedAnswer: string
  followUpQuestion: string
  /** AI 推理/思考过程（Markdown 格式，用于前端折叠展示） */
  thinking?: string
}

export interface InterviewSession {
  id: string
  config: InterviewConfig
  resumeSnapshot?: import('@/types/resume').ResumeInfo
  questions: InterviewQuestion[]
  messages: ChatMessage[]
  evaluations: AnswerEvaluation[]
  currentQuestionIndex: number
  status: 'idle' | 'configuring' | 'in-progress' | 'finished'
  createdAt: string
  finishedAt: string
  followUpStates?: Record<string, { question: string; mainAnswer: string }>
}

/** 历史面试记录（持久化到 localStorage） */
export interface InterviewHistoryItem {
  /** 会话 ID */
  sessionId: string
  /** 目标岗位 */
  role: string
  /** 面试模式 */
  mode: string
  /** 难度 */
  difficulty: string
  /** 题目数量 */
  questionCount: number
  /** 总分 */
  totalScore: number
  /** 完成时间 */
  finishedAt: string
  /** 完整会话数据（用于回看） */
  session: InterviewSession
}

