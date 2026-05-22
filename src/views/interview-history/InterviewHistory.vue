<script setup lang="ts">
/**
 * InterviewHistory — 历史面试浏览与回看
 * =========================================
 *
 * 功能：
 * - 列表视图：按时间/分数排序的历史面试卡片
 * - 回看视图：只读聊天记录，使用虚拟列表渲染
 * - 删除/清空管理
 */

import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, View, RefreshLeft, Top, Bottom } from '@element-plus/icons-vue'
import { useHistoryStore } from '@/stores/modules/history'
import VirtualChatList from '@/components/VirtualChatList.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { InterviewHistoryItem, ChatMessage } from '@/types/interview'

const historyStore = useHistoryStore()

// ─── 状态 ──────────────────────────────────────

type ViewMode = 'list' | 'detail'
const viewMode = ref<ViewMode>('list')
const selectedHistory = ref<InterviewHistoryItem | null>(null)
const sortKey = ref<'time' | 'score'>('time')
const filterRole = ref('')
const filterMode = ref('')

// ─── 计算属性 ──────────────────────────────────

const allRoles = computed(() => {
  const set = new Set(historyStore.histories.map((h) => h.role))
  return [...set]
})

const modeLabels: Record<string, string> = {
  'tech-basic': '技术基础',
  'project-deep': '项目深挖',
  'baguwen': '八股文',
  'scenario': '场景题',
  'comprehensive': '综合模拟',
}

const difficultyLabels: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

const filteredHistories = computed(() => {
  let list = sortKey.value === 'time'
    ? historyStore.sortedByTime
    : historyStore.sortedByScore

  if (filterRole.value) list = list.filter((h) => h.role === filterRole.value)
  if (filterMode.value) list = list.filter((h) => h.mode === filterMode.value)
  return list
})

/** 回看时的聊天消息（只读） */
const replayMessages = computed<ChatMessage[]>(() => {
  return selectedHistory.value?.session?.messages || []
})

// ─── 方法 ──────────────────────────────────────

onMounted(() => historyStore.loadFromStorage())

function openDetail(item: InterviewHistoryItem) {
  selectedHistory.value = item
  viewMode.value = 'detail'
}

function backToList() {
  viewMode.value = 'list'
  selectedHistory.value = null
}

async function handleDelete(sessionId: string) {
  try {
    await ElMessageBox.confirm('确定删除这条面试记录？', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    historyStore.removeHistory(sessionId)
    ElMessage.success('已删除')
  } catch { /* cancelled */ }
}

async function handleClearAll() {
  try {
    await ElMessageBox.confirm(
      `确定清空全部 ${historyStore.count} 条历史记录？此操作不可恢复。`,
      '清空历史',
      { type: 'error', confirmButtonText: '确认清空', cancelButtonText: '取消' }
    )
    historyStore.clearAll()
    ElMessage.success('已清空')
  } catch { /* cancelled */ }
}

function formatDate(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString('zh-CN')
  } catch { return isoStr }
}

function scoreColor(s: number): string {
  if (s >= 85) return '#67c23a'
  if (s >= 70) return '#409eff'
  if (s >= 50) return '#e6a23c'
  return '#f56c6c'
}

const statCards = computed(() => [
  { label: '总面试次数', value: historyStore.count, unit: '次' },
  { label: '平均得分', value: historyStore.averageScore, unit: '分' },
  { label: '最高得分', value: historyStore.sortedByScore[0]?.totalScore || 0, unit: '分' },
])
</script>

<template>
  <div class="history-page">

    <!-- ═══ 列表视图 ═══ -->
    <template v-if="viewMode === 'list'">
      <!-- 统计卡片 -->
      <div class="stats-row">
        <div v-for="card in statCards" :key="card.label" class="stat-card">
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </div>
      </div>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-radio-group v-model="sortKey" size="small">
          <el-radio-button value="time">按时间</el-radio-button>
          <el-radio-button value="score">按分数</el-radio-button>
        </el-radio-group>
        <el-select v-model="filterRole" placeholder="按岗位" clearable size="small" style="width:150px">
          <el-option v-for="r in allRoles" :key="r" :label="r" :value="r" />
        </el-select>
        <el-select v-model="filterMode" placeholder="按模式" clearable size="small" style="width:130px">
          <el-option v-for="(label, key) in modeLabels" :key="key" :label="label" :value="key" />
        </el-select>
        <el-button v-if="historyStore.count > 0" size="small" type="danger" text @click="handleClearAll">
          清空全部
        </el-button>
      </div>

      <!-- 空状态 -->
      <el-empty v-if="filteredHistories.length === 0" description="暂无面试记录">
        <template v-if="historyStore.count === 0">
          <p style="color:#909399;font-size:13px">完成一次模拟面试后，记录会自动保存在这里</p>
        </template>
      </el-empty>

      <!-- 历史卡片列表 -->
      <div v-else class="history-list">
        <div
          v-for="item in filteredHistories"
          :key="item.sessionId"
          class="history-card"
          @click="openDetail(item)"
        >
          <div class="card-left">
            <div class="card-score" :style="{ color: scoreColor(item.totalScore) }">
              {{ item.totalScore }}
              <span class="score-unit">分</span>
            </div>
          </div>
          <div class="card-body">
            <div class="card-title">
              {{ item.role }}
              <el-tag size="small" type="info" style="margin-left:8px">
                {{ modeLabels[item.mode] || item.mode }}
              </el-tag>
              <el-tag size="small" style="margin-left:4px">
                {{ difficultyLabels[item.difficulty] || item.difficulty }}
              </el-tag>
            </div>
            <div class="card-meta">
              <span>{{ item.questionCount }} 题</span>
              <span class="meta-divider">|</span>
              <span>{{ formatDate(item.finishedAt) }}</span>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <el-button size="small" text type="primary" @click="openDetail(item)">
              <el-icon><View /></el-icon> 回看
            </el-button>
            <el-button size="small" text type="danger" @click="handleDelete(item.sessionId)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ 回看视图 ═══ -->
    <template v-else>
      <div class="detail-header">
        <el-button text @click="backToList">
          <el-icon><RefreshLeft /></el-icon> 返回列表
        </el-button>
        <div class="detail-info">
          <span class="detail-role">{{ selectedHistory?.role }}</span>
          <el-tag size="small">{{ modeLabels[selectedHistory?.mode || ''] }}</el-tag>
          <span class="detail-score" :style="{ color: scoreColor(selectedHistory?.totalScore || 0) }">
            {{ selectedHistory?.totalScore }} 分
          </span>
        </div>
        <span class="detail-time">{{ formatDate(selectedHistory?.finishedAt || '') }}</span>
      </div>

      <!-- 使用虚拟列表渲染聊天记录 -->
      <div class="replay-chat-wrapper">
        <VirtualChatList
          :items="replayMessages"
          :estimated-item-height="80"
          :stick-to-bottom="false"
        >
          <template #default="{ item: msg }">
            <div class="chat-message" :class="`msg-${(msg as ChatMessage).role}`">
              <div class="msg-avatar">
                <span v-if="(msg as ChatMessage).role === 'interviewer'">🤖</span>
                <span v-else-if="(msg as ChatMessage).role === 'user'">👤</span>
                <span v-else>📋</span>
              </div>
              <div class="msg-bubble" :class="`bubble-${(msg as ChatMessage).role}`">
                <MarkdownRenderer
                  v-if="(msg as ChatMessage).content"
                  :content="(msg as ChatMessage).content"
                  variant="chat"
                />
              </div>
            </div>
          </template>
        </VirtualChatList>
      </div>
    </template>

  </div>
</template>

<style scoped>
.history-page { height: 100%; display: flex; flex-direction: column; gap: 16px; }

/* 统计卡片 */
.stats-row { display: flex; gap: 16px; }
.stat-card {
  flex: 1; padding: 20px 24px; background: #fff; border-radius: 8px;
  text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.04);
}
.stat-value { font-size: 32px; font-weight: 700; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

/* 筛选栏 */
.filter-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

/* 历史卡片 */
.history-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.history-card {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 18px; background: #fff; border-radius: 8px;
  cursor: pointer; transition: box-shadow 0.2s, transform 0.15s;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.history-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.1); transform: translateY(-1px); }
.card-left { flex-shrink: 0; }
.card-score { font-size: 30px; font-weight: 700; }
.score-unit { font-size: 13px; font-weight: 400; }
.card-body { flex: 1; min-width: 0; }
.card-title { font-size: 15px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.card-meta { font-size: 12px; color: #909399; }
.meta-divider { margin: 0 6px; }
.card-actions { display: flex; gap: 4px; flex-shrink: 0; }

/* 回看视图 */
.detail-header {
  display: flex; align-items: center; gap: 16px; padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}
.detail-info { display: flex; align-items: center; gap: 8px; flex: 1; }
.detail-role { font-size: 15px; font-weight: 600; }
.detail-score { font-size: 18px; font-weight: 700; }
.detail-time { font-size: 12px; color: #909399; }
.replay-chat-wrapper { flex: 1; min-height: 0; background: #f9fafb; border-radius: 8px; overflow: hidden; }

/* 聊天消息样式（与 MockInterview 一致） */
.chat-message { display: flex; gap: 10px; padding: 8px 16px; align-items: flex-start; }
.msg-avatar { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; border-radius: 50%; background: #f0f2f5; }
.msg-bubble { padding: 10px 14px; border-radius: 10px; max-width: 75%; font-size: 14px; line-height: 1.65; }
.bubble-interviewer { background: #fff; border: 1px solid #e4e7ed; border-top-left-radius: 2px; }
.bubble-user { background: #ecf5ff; border: 1px solid #d9ecff; border-top-right-radius: 2px; margin-left: auto; }
.bubble-system { background: #fdf6ec; border: 1px solid #faecd8; }
.msg-user { flex-direction: row-reverse; }
</style>
