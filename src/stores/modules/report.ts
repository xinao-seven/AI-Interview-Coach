import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { InterviewReport } from '@/types/report'

export const useReportStore = defineStore('report', () => {
  const report = ref<InterviewReport | null>(null)

  function setReport(r: InterviewReport) {
    report.value = r
    localStorage.setItem('report', JSON.stringify(r))
  }

  function loadFromStorage() {
    const stored = localStorage.getItem('report')
    if (stored) {
      try {
        report.value = JSON.parse(stored)
      } catch {
        report.value = null
      }
    }
  }

  function clearReport() {
    report.value = null
    localStorage.removeItem('report')
  }

  return {
    report,
    setReport,
    loadFromStorage,
    clearReport,
  }
})
