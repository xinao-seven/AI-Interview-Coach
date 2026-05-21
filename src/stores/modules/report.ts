import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InterviewReport } from '@/types/report'

export const useReportStore = defineStore('report', () => {
  const report = ref<InterviewReport | null>(null)

  const hasReport = computed(() => report.value !== null)

  function setReport(r: InterviewReport) {
    report.value = r
    saveToStorage()
  }

  function updateReport(fields: Partial<InterviewReport>) {
    if (report.value) {
      Object.assign(report.value, fields)
      saveToStorage()
    }
  }

  function clearReport() {
    report.value = null
    localStorage.removeItem('report')
  }

  function saveToStorage() {
    if (report.value) {
      localStorage.setItem('report', JSON.stringify(report.value))
    }
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

  return {
    report,
    hasReport,
    setReport,
    updateReport,
    clearReport,
    loadFromStorage,
  }
})
