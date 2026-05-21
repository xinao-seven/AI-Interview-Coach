import request from '@/api'
import type { ResumeInfo, ResumeProject } from '@/types/resume'
import type { InterviewConfig, InterviewQuestion, AnswerEvaluation, InterviewSession, ChatMessage } from '@/types/interview'
import type { InterviewReport } from '@/types/report'
import {
  mockParseResume,
  mockGenerateQuestions,
  mockEvaluateAnswer,
  mockGenerateReport,
  mockPolishProject,
  mockGenerateProjectQuestions,
} from '@/api/mock'

const isMock = import.meta.env.VITE_AI_MODE !== 'real'

// Utility: stream request for SSE
export function createStreamRequest(
  url: string,
  body: Record<string, unknown>,
  callbacks: {
    onMessage: (text: string) => void
    onError?: (error: Error) => void
    onDone?: () => void
  }
): AbortController {
  const controller = new AbortController()

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              callbacks.onDone?.()
              return
            }
            try {
              const parsed = JSON.parse(data)
              callbacks.onMessage(parsed.content || parsed.text || '')
            } catch {
              callbacks.onMessage(data)
            }
          }
        }
      }
      callbacks.onDone?.()
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err)
      }
    })

  return controller
}

// 1. Parse resume
export async function parseResumeApi(rawText: string): Promise<ResumeInfo> {
  if (isMock) return mockParseResume(rawText)
  return request.post('/resume/parse', { rawText }) as Promise<ResumeInfo>
}

// 2. Generate questions
export async function generateQuestionsApi(
  resumeInfo: ResumeInfo | null,
  config: InterviewConfig
): Promise<InterviewQuestion[]> {
  if (isMock) return mockGenerateQuestions(resumeInfo, config)
  return request.post('/interview/questions', { resumeInfo, config }) as Promise<InterviewQuestion[]>
}

// 3. Evaluate answer
export async function evaluateAnswerApi(
  question: InterviewQuestion,
  userAnswer: string,
  resumeInfo: ResumeInfo | null
): Promise<AnswerEvaluation> {
  if (isMock) return mockEvaluateAnswer(question, userAnswer, resumeInfo)
  return request.post('/interview/evaluate', {
    question,
    userAnswer,
    resumeInfo,
  }) as Promise<AnswerEvaluation>
}

// 4. Generate report
export async function generateReportApi(session: InterviewSession): Promise<InterviewReport> {
  if (isMock) return mockGenerateReport(session)
  return request.post('/interview/report', { session }) as Promise<InterviewReport>
}

// 5. Polish project
export async function polishResumeProjectApi(project: ResumeProject): Promise<{
  optimized: ResumeProject
  suggestions: string[]
}> {
  if (isMock) return mockPolishProject(project)
  return request.post('/project/polish', { project }) as Promise<{
    optimized: ResumeProject
    suggestions: string[]
  }>
}

// 6. Generate project questions
export async function generateProjectQuestionsApi(project: ResumeProject): Promise<InterviewQuestion[]> {
  if (isMock) return mockGenerateProjectQuestions(project)
  return request.post('/project/questions', { project }) as Promise<InterviewQuestion[]>
}
