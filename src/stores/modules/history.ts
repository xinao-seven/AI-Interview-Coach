/**
 * useHistoryStore — 面试历史记录管理
 * ===================================
 *
 * 功能：
 * - 保存已完成的面试会话到 localStorage
 * - 最多保留 50 条记录（FIFO 淘汰）
 * - 提供按时间/分数排序、按岗位/模式筛选
 * - 支持完整回看（加载完整会话数据）
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InterviewHistoryItem, InterviewSession } from '@/types/interview'

const STORAGE_KEY = 'interview-history'
const MAX_ITEMS = 50

export const useHistoryStore = defineStore('history', () => {
  // ─── 状态 ──────────────────────────────────
  const histories = ref<InterviewHistoryItem[]>([])

  // ─── 计算属性 ──────────────────────────────

  const count = computed(() => histories.value.length)

  /** 按时间倒序排列 */
  const sortedByTime = computed(() =>
    [...histories.value].sort(
      (a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime()
    )
  )

  /** 按分数降序排列 */
  const sortedByScore = computed(() =>
    [...histories.value].sort((a, b) => b.totalScore - a.totalScore)
  )

  /** 平均分 */
  const averageScore = computed(() => {
    if (histories.value.length === 0) return 0
    const sum = histories.value.reduce((t, h) => t + h.totalScore, 0)
    return Math.round(sum / histories.value.length)
  })

  /** 统计各岗位出现次数最多的 */
  const topRoles = computed(() => {
    const map: Record<string, number> = {}
    for (const h of histories.value) {
      map[h.role] = (map[h.role] || 0) + 1
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([role, count]) => ({ role, count }))
  })

  /** 根据 mode 筛选 */
  function filterByMode(mode: string): InterviewHistoryItem[] {
    if (!mode) return histories.value
    return histories.value.filter((h) => h.mode === mode)
  }

  /** 根据岗位筛选 */
  function filterByRole(role: string): InterviewHistoryItem[] {
    if (!role) return histories.value
    return histories.value.filter((h) => h.role === role)
  }

  // ─── 操作方法 ──────────────────────────────

  /** 保存一次面试记录 */
  function addHistory(session: InterviewSession, totalScore: number) {
    const item: InterviewHistoryItem = {
      sessionId: session.id,
      role: session.config?.targetRole || '未知',
      mode: session.config?.interviewMode || '',
      difficulty: session.config?.difficulty || 'medium',
      questionCount: session.questions.length,
      totalScore,
      finishedAt: session.finishedAt || new Date().toISOString(),
      session: { ...session },
    }

    // 避免重复添加同一 session
    const existingIndex = histories.value.findIndex(
      (h) => h.sessionId === session.id
    )
    if (existingIndex !== -1) {
      histories.value[existingIndex] = item
    } else {
      histories.value.push(item)
    }

    // FIFO 淘汰：超出上限则移除最旧的
    if (histories.value.length > MAX_ITEMS) {
      histories.value.sort(
        (a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime()
      )
      histories.value.splice(0, histories.value.length - MAX_ITEMS)
    }

    saveToStorage()
  }

  /** 删除一条记录 */
  function removeHistory(sessionId: string) {
    histories.value = histories.value.filter((h) => h.sessionId !== sessionId)
    saveToStorage()
  }

  /** 清空全部历史 */
  function clearAll() {
    histories.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  /** 根据 sessionId 获取完整会话数据 */
  function getSession(sessionId: string): InterviewSession | null {
    const item = histories.value.find((h) => h.sessionId === sessionId)
    return item?.session ?? null
  }

  // ─── 持久化 ────────────────────────────────

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(histories.value))
    } catch {
      // localStorage 满了，不处理
    }
  }

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        histories.value = JSON.parse(stored)
      }
    } catch {
      histories.value = []
    }
  }

  return {
    histories,
    count,
    sortedByTime,
    sortedByScore,
    averageScore,
    topRoles,
    filterByMode,
    filterByRole,
    addHistory,
    removeHistory,
    clearAll,
    getSession,
    loadFromStorage,
  }
})
