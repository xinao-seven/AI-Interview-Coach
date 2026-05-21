import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InterviewQuestion, AnswerEvaluation } from '@/types/interview'

export interface MistakeItem {
  question: InterviewQuestion
  userAnswer: string
  evaluation: AnswerEvaluation | null
  addedAt: string
  tags: string[]
}

export const useMistakeStore = defineStore('mistake', () => {
  const mistakes = ref<MistakeItem[]>([])

  const mistakeCount = computed(() => mistakes.value.length)

  const tags = computed(() => {
    const tagSet = new Set<string>()
    mistakes.value.forEach((m) => m.tags.forEach((t) => tagSet.add(t)))
    return [...tagSet]
  })

  function getByTag(tag: string): MistakeItem[] {
    return mistakes.value.filter((m) => m.tags.includes(tag))
  }

  function addMistake(item: MistakeItem) {
    const exists = mistakes.value.find((m) => m.question.id === item.question.id)
    if (!exists) {
      mistakes.value.push(item)
      saveToStorage()
    }
  }

  function updateMistake(questionId: string, fields: Partial<MistakeItem>) {
    const index = mistakes.value.findIndex((m) => m.question.id === questionId)
    if (index !== -1) {
      Object.assign(mistakes.value[index], fields)
      saveToStorage()
    }
  }

  function removeMistake(questionId: string) {
    mistakes.value = mistakes.value.filter((m) => m.question.id !== questionId)
    saveToStorage()
  }

  function clearAll() {
    mistakes.value = []
    localStorage.removeItem('mistakes')
  }

  function saveToStorage() {
    localStorage.setItem('mistakes', JSON.stringify(mistakes.value))
  }

  function loadFromStorage() {
    const stored = localStorage.getItem('mistakes')
    if (stored) {
      try {
        mistakes.value = JSON.parse(stored)
      } catch {
        mistakes.value = []
      }
    }
  }

  return {
    mistakes,
    mistakeCount,
    tags,
    addMistake,
    updateMistake,
    removeMistake,
    clearAll,
    loadFromStorage,
    getByTag,
  }
})
