import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ResumeInfo } from '@/types/resume'

export const useResumeStore = defineStore('resume', () => {
  const resumeInfo = ref<ResumeInfo | null>(null)

  const hasResume = computed(() => resumeInfo.value !== null)

  function setResume(info: ResumeInfo) {
    resumeInfo.value = info
    localStorage.setItem('resume', JSON.stringify(info))
  }

  function loadFromStorage() {
    const stored = localStorage.getItem('resume')
    if (stored) {
      try {
        resumeInfo.value = JSON.parse(stored)
      } catch {
        resumeInfo.value = null
      }
    }
  }

  function clearResume() {
    resumeInfo.value = null
    localStorage.removeItem('resume')
  }

  return {
    resumeInfo,
    hasResume,
    setResume,
    loadFromStorage,
    clearResume,
  }
})
