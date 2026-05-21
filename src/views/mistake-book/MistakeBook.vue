<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMistakeStore } from '@/stores/modules/mistake'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'

const router = useRouter()
const mistakeStore = useMistakeStore()

const filterTag = ref<string>('')
const filterType = ref<string>('')
const searchKeyword = ref('')
const expandedId = ref<string>('')

onMounted(() => {
  mistakeStore.loadFromStorage()
})

const filteredMistakes = computed(() => {
  let items = mistakeStore.mistakes

  if (filterTag.value) {
    items = items.filter((m) => m.tags.includes(filterTag.value))
  }
  if (filterType.value) {
    items = items.filter((m) => m.question.type === filterType.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    items = items.filter(
      (m) =>
        m.question.question.toLowerCase().includes(kw) ||
        m.userAnswer.toLowerCase().includes(kw) ||
        m.tags.some((t) => t.toLowerCase().includes(kw))
    )
  }

  return items
})

const allTags = computed(() => {
  const tagSet = new Set<string>()
  mistakeStore.mistakes.forEach((m) => m.tags.forEach((t) => tagSet.add(t)))
  return [...tagSet]
})

const weakPoints = computed(() => {
  const tagCount: Record<string, number> = {}
  mistakeStore.mistakes.forEach((m) => {
    m.tags.forEach((t) => {
      tagCount[t] = (tagCount[t] || 0) + 1
    })
  })
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
})

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '技术基础', value: 'tech-basic' },
  { label: '项目深挖', value: 'project-deep' },
  { label: '八股文', value: 'baguwen' },
  { label: '场景题', value: 'scenario' },
  { label: '综合题', value: 'comprehensive' },
]

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? '' : id
}

function handleRemove(id: string) {
  ElMessageBox.confirm('确定从错题本中移除此题吗？', '确认移除', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    mistakeStore.removeMistake(id)
    ElMessage.success('已移除')
  }).catch(() => {})
}

function handleClearAll() {
  if (mistakeStore.mistakes.length === 0) return
  ElMessageBox.confirm('确定清空所有错题吗？此操作不可恢复。', '确认清空', {
    confirmButtonText: '确定清空',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    mistakeStore.clearAll()
    ElMessage.success('错题本已清空')
  }).catch(() => {})
}

function scoreColor(score: number): string {
  if (score >= 70) return '#67c23a'
  if (score >= 40) return '#e6a23c'
  return '#f56c6c'
}
</script>

<template>
  <div class="mistake-page">
    <div class="page-header">
      <div class="header-left">
        <h2>错题本</h2>
        <span class="count-badge">{{ mistakeStore.mistakeCount }} 题</span>
      </div>
      <div class="header-right">
        <el-button
          v-if="mistakeStore.mistakeCount > 0"
          size="small"
          type="danger"
          text
          @click="handleClearAll"
        >
          清空全部
        </el-button>
      </div>
    </div>

    <!-- Empty State -->
    <el-empty
      v-if="mistakeStore.mistakeCount === 0"
      description="错题本为空，完成面试或知识点训练后可以将低分题目加入错题本"
      :image-size="100"
    >
      <template #default>
        <el-button type="primary" @click="router.push('/knowledge-training')">
          去知识点训练
        </el-button>
        <el-button @click="router.push('/interview-config')">
          开始模拟面试
        </el-button>
      </template>
    </el-empty>

    <template v-else>
      <!-- Weak Points Stats -->
      <el-card shadow="never" class="stats-card">
        <template #header><span>薄弱知识点统计</span></template>
        <div class="stats-chart">
          <div
            v-for="(entry, index) in weakPoints"
            :key="entry[0]"
            class="stat-bar-item"
          >
            <div class="stat-bar-label">{{ entry[0] }}</div>
            <div class="stat-bar-track">
              <div
                class="stat-bar-fill"
                :style="{
                  width: `${(entry[1] / weakPoints[0][1]) * 100}%`,
                  background: index < 3 ? '#f56c6c' : index < 5 ? '#e6a23c' : '#909399',
                }"
              />
            </div>
            <span class="stat-bar-count">{{ entry[1] }}题</span>
          </div>
        </div>
      </el-card>

      <!-- Filters -->
      <el-card shadow="never" class="filter-card">
        <div class="filter-row">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索错题..."
            clearable
            style="width: 240px"
          />
          <el-select v-model="filterTag" placeholder="按标签筛选" clearable style="width: 160px">
            <el-option label="全部标签" value="" />
            <el-option
              v-for="tag in allTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
          <el-select v-model="filterType" placeholder="按题型筛选" clearable style="width: 140px">
            <el-option
              v-for="t in typeOptions"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </el-select>
        </div>
      </el-card>

      <!-- Mistake List -->
      <div class="mistake-list">
        <div
          v-for="item in filteredMistakes"
          :key="item.question.id"
          class="mistake-item"
        >
          <div class="mistake-item-header" @click="toggleExpand(item.question.id)">
            <div class="mistake-title">
              <span class="mistake-index" :style="{ color: scoreColor(item.evaluation?.totalScore || 0) }">
                {{ item.evaluation?.totalScore || '-' }}分
              </span>
              <span class="mistake-question">{{ item.question.question }}</span>
            </div>
            <div class="mistake-meta">
              <el-tag
                v-for="t in item.tags"
                :key="t"
                size="small"
                class="mini-tag"
              >
                {{ t }}
              </el-tag>
              <el-icon
                :style="{
                  transform: expandedId === item.question.id ? 'rotate(180deg)' : '',
                  transition: 'transform 0.2s',
                }"
              >
                <component is="ArrowDown" />
              </el-icon>
            </div>
          </div>

          <div v-if="expandedId === item.question.id" class="mistake-detail">
            <div class="detail-section">
              <div class="detail-label">原问题</div>
              <div class="detail-text">{{ item.question.question }}</div>
            </div>

            <div class="detail-section">
              <div class="detail-label">你的回答</div>
              <div class="detail-text user-answer">{{ item.userAnswer || '（未作答）' }}</div>
            </div>

            <div class="detail-section">
              <div class="detail-label">AI 建议</div>
              <div class="detail-text suggestion">
                <MarkdownRenderer
                  v-if="item.evaluation?.improvedAnswer"
                  :content="item.evaluation.improvedAnswer"
                  variant="report"
                />
                <span v-else>暂无建议</span>
              </div>
            </div>

            <div class="detail-section">
              <div class="detail-label">参考答案</div>
              <div class="detail-text">
                <MarkdownRenderer :content="item.question.referenceAnswer" variant="report" />
              </div>
            </div>

            <div class="detail-actions">
              <el-button size="small" type="danger" text @click="handleRemove(item.question.id)">
                移出错题本
              </el-button>
            </div>
          </div>
        </div>

        <div v-if="filteredMistakes.length === 0 && mistakeStore.mistakeCount > 0" class="empty-filter">
          没有符合条件的错题
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mistake-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.count-badge {
  background: #f56c6c;
  color: #fff;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 12px;
}

/* Stats */
.stats-card {
  margin-bottom: 12px;
}

.stats-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-bar-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-bar-label {
  width: 80px;
  font-size: 13px;
  color: #606266;
  text-align: right;
  flex-shrink: 0;
}

.stat-bar-track {
  flex: 1;
  height: 20px;
  background: #f5f7fa;
  border-radius: 10px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.3s;
  min-width: 8px;
}

.stat-bar-count {
  font-size: 12px;
  color: #909399;
  width: 30px;
  flex-shrink: 0;
}

/* Filter */
.filter-card {
  margin-bottom: 12px;
}

.filter-row {
  display: flex;
  gap: 12px;
}

/* Mistake List */
.mistake-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mistake-item {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.mistake-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.mistake-item-header:hover {
  background: #f5f7fa;
}

.mistake-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.mistake-index {
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.mistake-question {
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mistake-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.mini-tag {
  font-size: 11px;
}

/* Detail */
.mistake-detail {
  padding: 0 16px 16px;
  border-top: 1px solid #ebeef5;
}

.detail-section {
  margin-top: 12px;
}

.detail-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.detail-text {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 6px;
  white-space: pre-wrap;
}

.detail-text.user-answer {
  background: #ecf5ff;
  border-left: 3px solid #409eff;
}

.detail-text.suggestion {
  background: #fdf6ec;
  border-left: 3px solid #e6a23c;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.empty-filter {
  text-align: center;
  color: #909399;
  padding: 24px 0;
}
</style>
