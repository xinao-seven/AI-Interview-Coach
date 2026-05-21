<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useReportStore } from '@/stores/modules/report'
import { useInterviewStore } from '@/stores/modules/interview'
import AbilityRadarChart from '@/components/AbilityRadarChart.vue'
import QuestionReviewList from '@/components/QuestionReviewList.vue'

const router = useRouter()
const reportStore = useReportStore()
const interviewStore = useInterviewStore()

const report = computed(() => reportStore.report)

const modeLabel = computed(() => {
  const map: Record<string, string> = {
    'tech-basic': '技术基础面试',
    'project-deep': '项目深挖面试',
    'baguwen': '八股文训练',
    'scenario': '场景题训练',
    'comprehensive': '综合模拟面试',
  }
  return map[interviewStore.config?.interviewMode || ''] || '未知'
})

const difficultyLabel = computed(() => {
  const map: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
  }
  return map[interviewStore.config?.difficulty || ''] || '未知'
})

const interviewInfo = computed(() => ({
  role: interviewStore.config?.targetRole || '未知',
  mode: modeLabel.value,
  difficulty: difficultyLabel.value,
  questionCount: interviewStore.questions.length,
  finishedAt: interviewStore.finishedAt
    ? new Date(interviewStore.finishedAt).toLocaleString('zh-CN')
    : '未知',
}))

function totalScoreColor(score: number): string {
  if (score >= 85) return '#67c23a'
  if (score >= 70) return '#409eff'
  if (score >= 50) return '#e6a23c'
  return '#f56c6c'
}

function totalScoreLabel(score: number): string {
  if (score >= 85) return '优秀'
  if (score >= 70) return '良好'
  if (score >= 50) return '一般'
  return '需提升'
}

function exportMarkdown() {
  if (!report.value) return

  const r = report.value
  const info = interviewInfo.value

  let md = `# AI 面试教练 - 面试报告\n\n`
  md += `## 基本信息\n\n`
  md += `| 项目 | 内容 |\n|------|------|\n`
  md += `| 岗位 | ${info.role} |\n`
  md += `| 模式 | ${info.mode} |\n`
  md += `| 难度 | ${info.difficulty} |\n`
  md += `| 题目数量 | ${info.questionCount} |\n`
  md += `| 完成时间 | ${info.finishedAt} |\n\n`

  md += `## 总体评分\n\n`
  md += `**总分：${r.totalScore}** (${totalScoreLabel(r.totalScore)})\n\n`

  md += `### 能力维度\n\n`
  md += `| 维度 | 得分 |\n|------|------|\n`
  md += `| 技术基础 | ${r.abilityScores.technicalFoundation} |\n`
  md += `| 项目经验 | ${r.abilityScores.projectExperience} |\n`
  md += `| 表达能力 | ${r.abilityScores.expressiveness} |\n`
  md += `| 思维深度 | ${r.abilityScores.depthOfThinking} |\n`
  md += `| 全面性 | ${r.abilityScores.comprehensiveness} |\n\n`

  md += `## 优势总结\n\n`
  r.strengths.forEach((s) => { md += `- ${s}\n` })
  md += `\n## 薄弱点总结\n\n`
  r.weaknesses.forEach((w) => { md += `- ${w}\n` })
  md += `\n## 推荐复习方向\n\n`
  r.suggestedTopics.forEach((t) => { md += `- ${t}\n` })

  md += `\n## 题目回顾\n\n`
  r.questionReviews.forEach((qr, i) => {
    md += `### 第${i + 1}题 (${qr.score}分)\n\n`
    md += `**问题：** ${qr.question}\n\n`
    md += `**你的回答：** ${qr.userAnswer}\n\n`
    md += `**参考答案：** ${qr.referenceAnswer}\n\n`
    if (qr.suggestion) {
      md += `**AI 建议：** ${qr.suggestion}\n\n`
    }
    md += `---\n\n`
  })

  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `面试报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.md`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('报告已导出')
}

onMounted(() => {
  reportStore.loadFromStorage()
  interviewStore.loadFromStorage()

  if (!report.value) {
    // Try to generate from interview store if session exists
    if (interviewStore.status === 'finished') {
      ElMessage.info('未找到报告数据，请先完成一次模拟面试')
      router.push('/mock-interview')
    }
  }
})
</script>

<template>
  <div class="report-page">
    <div class="page-header">
      <h2>面试报告</h2>
      <el-button type="primary" @click="exportMarkdown" :disabled="!report" v-if="report">
        导出 Markdown
      </el-button>
    </div>

    <!-- No report -->
    <el-empty
      v-if="!report"
      description="暂无报告数据"
      :image-size="120"
    >
      <template #default>
        <el-button type="primary" @click="router.push('/interview-config')">
          开始一次模拟面试
        </el-button>
      </template>
    </el-empty>

    <template v-else>
      <!-- Basic Info -->
      <el-card shadow="never" class="section-card">
        <template #header><span>面试信息</span></template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="目标岗位">{{ interviewInfo.role }}</el-descriptions-item>
          <el-descriptions-item label="面试模式">{{ interviewInfo.mode }}</el-descriptions-item>
          <el-descriptions-item label="难度">{{ interviewInfo.difficulty }}</el-descriptions-item>
          <el-descriptions-item label="题目数量">{{ interviewInfo.questionCount }} 题</el-descriptions-item>
          <el-descriptions-item label="完成时间" :span="2">{{ interviewInfo.finishedAt }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- Total Score + Radar -->
      <el-row :gutter="16">
        <el-col :span="8">
          <el-card shadow="never" class="section-card total-score-card">
            <template #header><span>总体评分</span></template>
            <div class="total-score-content">
              <div
                class="total-score-circle"
                :style="{ borderColor: totalScoreColor(report.totalScore) }"
              >
                <span
                  class="total-score-num"
                  :style="{ color: totalScoreColor(report.totalScore) }"
                >
                  {{ report.totalScore }}
                </span>
                <span class="total-score-unit">分</span>
              </div>
              <el-tag
                :type="report.totalScore >= 85 ? 'success' : report.totalScore >= 70 ? '' : report.totalScore >= 50 ? 'warning' : 'danger'"
                size="large"
              >
                {{ totalScoreLabel(report.totalScore) }}
              </el-tag>
            </div>
          </el-card>
        </el-col>
        <el-col :span="16">
          <el-card shadow="never" class="section-card">
            <template #header><span>能力雷达图</span></template>
            <AbilityRadarChart :ability-scores="report.abilityScores" height="280px" />
          </el-card>
        </el-col>
      </el-row>

      <!-- Strengths & Weaknesses -->
      <el-row :gutter="16">
        <el-col :span="12">
          <el-card shadow="never" class="section-card">
            <template #header><span style="color: #67c23a">优势总结</span></template>
            <ul class="summary-list success">
              <li v-for="s in report.strengths" :key="s">{{ s }}</li>
            </ul>
            <el-empty v-if="!report.strengths.length" description="暂无" :image-size="60" />
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never" class="section-card">
            <template #header><span style="color: #f56c6c">薄弱点总结</span></template>
            <ul class="summary-list danger">
              <li v-for="w in report.weaknesses" :key="w">{{ w }}</li>
            </ul>
            <el-empty v-if="!report.weaknesses.length" description="暂无" :image-size="60" />
          </el-card>
        </el-col>
      </el-row>

      <!-- Suggested Topics -->
      <el-card shadow="never" class="section-card">
        <template #header><span>推荐复习方向</span></template>
        <div class="topics-row">
          <el-tag
            v-for="topic in report.suggestedTopics"
            :key="topic"
            size="large"
            type="warning"
            effect="plain"
          >
            {{ topic }}
          </el-tag>
        </div>
        <el-empty v-if="!report.suggestedTopics.length" description="暂无" :image-size="60" />
      </el-card>

      <!-- Question Reviews -->
      <el-card shadow="never" class="section-card">
        <template #header><span>逐题回顾</span></template>
        <QuestionReviewList :reviews="report.questionReviews" />
      </el-card>

      <!-- Bottom Action -->
      <div class="bottom-actions">
        <el-button size="large" @click="router.push('/mock-interview')">
          返回面试
        </el-button>
        <el-button size="large" type="primary" @click="router.push('/interview-config')">
          开始新面试
        </el-button>
        <el-button size="large" type="success" @click="exportMarkdown">
          导出 Markdown 报告
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.report-page {
  max-width: 960px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.section-card {
  margin-bottom: 16px;
}

.total-score-card {
  height: 100%;
}

.total-score-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 0;
}

.total-score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 6px solid #409eff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.total-score-num {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
}

.total-score-unit {
  font-size: 16px;
  color: #909399;
}

.summary-list {
  margin: 0;
  padding-left: 18px;
}

.summary-list li {
  font-size: 14px;
  color: #606266;
  line-height: 2;
}

.summary-list.success li::marker {
  color: #67c23a;
}

.summary-list.danger li::marker {
  color: #f56c6c;
}

.topics-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bottom-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 24px 0 40px;
}
</style>
