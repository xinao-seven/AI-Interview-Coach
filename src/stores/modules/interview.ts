import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InterviewConfig, InterviewQuestion, ChatMessage, AnswerEvaluation, InterviewSession } from '@/types/interview'

export const useInterviewStore = defineStore('interview', () => {
  const config = ref<InterviewConfig | null>(null)
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

  function setConfig(c: InterviewConfig) {
    config.value = c
    status.value = 'configuring'
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

  function addEvaluation(eval_: AnswerEvaluation) {
    evaluations.value.push(eval_)
    saveToStorage()
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
    setConfig,
    setQuestions,
    addMessage,
    addEvaluation,
    nextQuestion,
    finishInterview,
    resetSession,
    loadFromStorage,
    saveToStorage,
  }
})
