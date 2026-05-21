import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ResumeInfo, ResumeProject, ResumeExperience } from '@/types/resume'

function generateId(): string {
  return `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useResumeStore = defineStore('resume', () => {
  const resumeInfo = ref<ResumeInfo | null>(null)

  const hasResume = computed(() => resumeInfo.value !== null)
  const projects = computed(() => resumeInfo.value?.projects || [])
  const experiences = computed(() => resumeInfo.value?.experiences || [])

  function setResume(info: ResumeInfo) {
    resumeInfo.value = info
    saveToStorage()
  }

  function updateResume(fields: Partial<ResumeInfo>) {
    if (resumeInfo.value) {
      Object.assign(resumeInfo.value, fields)
      saveToStorage()
    }
  }

  function addProject(project: ResumeProject) {
    if (!resumeInfo.value) return
    const newProject = { ...project, id: project.id || generateId() }
    resumeInfo.value.projects.push(newProject)
    saveToStorage()
  }

  function updateProject(id: string, fields: Partial<ResumeProject>) {
    if (!resumeInfo.value) return
    const index = resumeInfo.value.projects.findIndex((p) => p.id === id)
    if (index !== -1) {
      Object.assign(resumeInfo.value.projects[index], fields)
      saveToStorage()
    }
  }

  function removeProject(id: string) {
    if (!resumeInfo.value) return
    resumeInfo.value.projects = resumeInfo.value.projects.filter((p) => p.id !== id)
    saveToStorage()
  }

  function addExperience(exp: ResumeExperience) {
    if (!resumeInfo.value) return
    resumeInfo.value.experiences.push({ ...exp, id: exp.id || generateId() })
    saveToStorage()
  }

  function removeExperience(id: string) {
    if (!resumeInfo.value) return
    resumeInfo.value.experiences = resumeInfo.value.experiences.filter((e) => e.id !== id)
    saveToStorage()
  }

  function clearResume() {
    resumeInfo.value = null
    localStorage.removeItem('resume')
  }

  function saveToStorage() {
    if (resumeInfo.value) {
      localStorage.setItem('resume', JSON.stringify(resumeInfo.value))
    }
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

  return {
    resumeInfo,
    hasResume,
    projects,
    experiences,
    setResume,
    updateResume,
    addProject,
    updateProject,
    removeProject,
    addExperience,
    removeExperience,
    clearResume,
    loadFromStorage,
  }
})
