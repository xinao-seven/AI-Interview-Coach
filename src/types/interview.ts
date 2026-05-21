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
}

export interface InterviewSession {
  id: string
  config: InterviewConfig
  questions: InterviewQuestion[]
  messages: ChatMessage[]
  evaluations: AnswerEvaluation[]
  currentQuestionIndex: number
  status: 'idle' | 'configuring' | 'in-progress' | 'finished'
  createdAt: string
  finishedAt: string
}
