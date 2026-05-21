import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InterviewConfig, InterviewQuestion, ChatMessage, AnswerEvaluation, InterviewSession } from '@/types/interview'
import type { ResumeInfo } from '@/types/resume'

export const useInterviewStore = defineStore('interview', () => {
  const config = ref<InterviewConfig | null>(null)
  const resumeSnapshot = ref<ResumeInfo | null>(null)
  const questions = ref<InterviewQuestion[]>([])
  const messages = ref<ChatMessage[]>([])
  const evaluations = ref<AnswerEvaluation[]>([])
  const currentQuestionIndex = ref(0)
  const sessionId = ref<string>('')
  const status = ref<'idle' | 'configuring' | 'in-progress' | 'finished'>('idle')
  const createdAt = ref<string>('')
  const finishedAt = ref<string>('')

  const currentQuestion = computed(() => {
    if (currentQuestionIndex.value < questions.value.length) {
      return questions.value[currentQuestionIndex.value]
    }
    return null
  })

  const isLastQuestion = computed(() => {
    return currentQuestionIndex.value >= questions.value.length - 1
  })

  const hasSession = computed(() => status.value !== 'idle')

  const answeredCount = computed(() => evaluations.value.length)

  function setConfig(c: InterviewConfig) {
    config.value = c
    status.value = 'configuring'
    saveToStorage()
  }

  function updateConfig(fields: Partial<InterviewConfig>) {
    if (config.value) {
      Object.assign(config.value, fields)
      saveToStorage()
    }
  }

  function setResumeSnapshot(info: ResumeInfo) {
    resumeSnapshot.value = info
  }

  function setQuestions(qs: InterviewQuestion[]) {
    questions.value = qs
    currentQuestionIndex.value = 0
    evaluations.value = []
    messages.value = []
    sessionId.value = `session-${Date.now()}`
    createdAt.value = new Date().toISOString()
    status.value = 'in-progress'
    saveToStorage()
  }

  function addMessage(msg: ChatMessage) {
    messages.value.push(msg)
    saveToStorage()
  }

  function updateMessage(id: string, content: string, msgStatus?: ChatMessage['status']) {
    const msg = messages.value.find((m) => m.id === id)
    if (msg) {
      msg.content = content
      if (msgStatus) msg.status = msgStatus
      saveToStorage()
    }
  }

  function addEvaluation(eval_: AnswerEvaluation) {
    evaluations.value.push(eval_)
    saveToStorage()
  }

  function updateEvaluation(questionId: string, fields: Partial<AnswerEvaluation>) {
    const evaluation = evaluations.value.find((e) => e.questionId === questionId)
    if (evaluation) {
      Object.assign(evaluation, fields)
      saveToStorage()
    }
  }

  function nextQuestion() {
    if (currentQuestionIndex.value < questions.value.length - 1) {
      currentQuestionIndex.value++
      saveToStorage()
    }
  }

  function finishInterview() {
    status.value = 'finished'
    finishedAt.value = new Date().toISOString()
    saveToStorage()
  }

  function resetSession() {
    config.value = null
    resumeSnapshot.value = null
    questions.value = []
    messages.value = []
    evaluations.value = []
    currentQuestionIndex.value = 0
    sessionId.value = ''
    status.value = 'idle'
    createdAt.value = ''
    finishedAt.value = ''
    localStorage.removeItem('interview-session')
  }

  function saveToStorage() {
    const session: InterviewSession = {
      id: sessionId.value,
      config: config.value!,
      resumeSnapshot: resumeSnapshot.value || undefined,
      questions: questions.value,
      messages: messages.value,
      evaluations: evaluations.value,
      currentQuestionIndex: currentQuestionIndex.value,
      status: status.value,
      createdAt: createdAt.value,
      finishedAt: finishedAt.value,
    }
    localStorage.setItem('interview-session', JSON.stringify(session))
  }

  function loadFromStorage() {
    const stored = localStorage.getItem('interview-session')
    if (stored) {
      try {
        const session: InterviewSession = JSON.parse(stored)
        config.value = session.config
        resumeSnapshot.value = session.resumeSnapshot || null
        questions.value = session.questions
        messages.value = session.messages
        evaluations.value = session.evaluations
        currentQuestionIndex.value = session.currentQuestionIndex
        sessionId.value = session.id
        status.value = session.status
        createdAt.value = session.createdAt
        finishedAt.value = session.finishedAt
      } catch {
        resetSession()
      }
    }
  }

  return {
    config,
    resumeSnapshot,
    questions,
    messages,
    evaluations,
    currentQuestionIndex,
    sessionId,
    status,
    createdAt,
    finishedAt,
    currentQuestion,
    isLastQuestion,
    hasSession,
    answeredCount,
    setConfig,
    updateConfig,
    setResumeSnapshot,
    setQuestions,
    addMessage,
    updateMessage,
    addEvaluation,
    updateEvaluation,
    nextQuestion,
    finishInterview,
    resetSession,
    loadFromStorage,
    saveToStorage,
  }
})
