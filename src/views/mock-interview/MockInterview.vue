<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useInterviewStore } from '@/stores/modules/interview'
import { useReportStore } from '@/stores/modules/report'
import type { ChatMessage, AnswerEvaluation } from '@/types/interview'
import type { InterviewReport, QuestionReview } from '@/types/report'

const router = useRouter()
const interviewStore = useInterviewStore()
const reportStore = useReportStore()

const answerText = ref('')
const evaluating = ref(false)
const showingHint = ref(false)
const hintText = ref('')
const chatContainer = ref<HTMLElement | null>(null)
const submitting = ref(false)

const currentQuestion = computed(() => interviewStore.currentQuestion)
const isLastQuestion = computed(() => interviewStore.isLastQuestion)
const hasCurrentAnswer = computed(() => {
  const q = currentQuestion.value
  if (!q) return true
  return interviewStore.evaluations.some((e) => e.questionId === q.id)
})

const canSubmit = computed(() => {
  return answerText.value.trim().length > 0 && !submitting.value && !hasCurrentAnswer.value
})

const completedQuestions = computed(() => {
  return interviewStore.questions.slice(0, interviewStore.currentQuestionIndex).map((q, i) => ({
    ...q,
    answered: interviewStore.evaluations.some((e) => e.questionId === q.id),
    score: interviewStore.evaluations.find((e) => e.questionId === q.id)?.totalScore,
  }))
})

onMounted(() => {
  interviewStore.loadFromStorage()

  if (!interviewStore.hasSession || interviewStore.questions.length === 0) {
    ElMessage.warning('请先配置面试参数')
    router.push('/interview-config')
    return
  }

  if (interviewStore.status === 'finished') {
    router.push('/interview-report')
    return
  }

  // Show current question if no messages yet
  if (interviewStore.messages.length === 0 && currentQuestion.value) {
    showCurrentQuestion()
  }
})

function showCurrentQuestion() {
  if (!currentQuestion.value) return
  const msg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'interviewer',
    content: currentQuestion.value.question,
    createdAt: new Date().toISOString(),
    questionId: currentQuestion.value.id,
    status: 'done',
  }
  interviewStore.addMessage(msg)
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

async function handleSubmit() {
  if (!canSubmit.value || !currentQuestion.value) return

  submitting.value = true

  const userMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: answerText.value.trim(),
    createdAt: new Date().toISOString(),
    questionId: currentQuestion.value.id,
    status: 'done',
  }
  interviewStore.addMessage(userMsg)
  answerText.value = ''
  await scrollToBottom()

  // Generate mock evaluation
  evaluating.value = true
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 800))

  const evaluation = generateMockEvaluation(
    currentQuestion.value,
    userMsg.content
  )
  interviewStore.addEvaluation(evaluation)

  const evalMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'system',
    content: formatEvaluation(evaluation),
    createdAt: new Date().toISOString(),
    questionId: currentQuestion.value.id,
    status: 'done',
  }
  interviewStore.addMessage(evalMsg)

  evaluating.value = false
  submitting.value = false
  showingHint.value = false
  await scrollToBottom()
}

function handleSkip() {
  if (!currentQuestion.value) return

  const userMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: '（我不会这道题）',
    createdAt: new Date().toISOString(),
    questionId: currentQuestion.value.id,
    status: 'done',
  }
  interviewStore.addMessage(userMsg)

  const evaluation: AnswerEvaluation = {
    questionId: currentQuestion.value.id,
    totalScore: 0,
    accuracy: 0,
    completeness: 0,
    expression: 0,
    projectRelevance: 0,
    depth: 0,
    strengths: [],
    weaknesses: ['未能作答，建议重点复习该知识点'],
    improvedAnswer: currentQuestion.value.referenceAnswer,
    followUpQuestion: '',
  }
  interviewStore.addEvaluation(evaluation)

  const evalMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'system',
    content: formatEvaluation(evaluation),
    createdAt: new Date().toISOString(),
    questionId: currentQuestion.value.id,
    status: 'done',
  }
  interviewStore.addMessage(evalMsg)

  answerText.value = ''
  showingHint.value = false
  scrollToBottom()
}

function handleShowHint() {
  if (!currentQuestion.value) return
  showingHint.value = true
  hintText.value = generateHint(currentQuestion.value)
}

function handleNextQuestion() {
  if (isLastQuestion.value) {
    handleFinish()
    return
  }

  interviewStore.nextQuestion()
  answerText.value = ''
  showingHint.value = false
  hintText.value = ''

  showCurrentQuestion()
}

function handleFinish() {
  ElMessageBox.confirm(
    '所有题目已完成，是否查看面试报告？',
    '面试结束',
    {
      confirmButtonText: '查看报告',
      cancelButtonText: '稍后再说',
      type: 'success',
    }
  ).then(() => {
    interviewStore.finishInterview()
    generateReport()
    router.push('/interview-report')
  }).catch(() => {
    interviewStore.finishInterview()
  })
}

function generateMockEvaluation(
  question: typeof interviewStore.questions[number],
  answer: string
): AnswerEvaluation {
  const answerLen = answer.length
  const baseScore =
    answerLen > 200 ? 85 :
    answerLen > 100 ? 70 :
    answerLen > 50 ? 55 :
    40

  const variance = Math.floor(Math.random() * 10) - 5
  const totalScore = Math.min(98, Math.max(20, baseScore + variance))

  return {
    questionId: question.id,
    totalScore,
    accuracy: Math.min(100, totalScore + Math.floor(Math.random() * 6) - 3),
    completeness: Math.min(100, totalScore + Math.floor(Math.random() * 10) - 5),
    expression: Math.min(100, totalScore + Math.floor(Math.random() * 8) - 4),
    projectRelevance: question.tags.includes('项目表达') ? totalScore : Math.floor(totalScore * 0.7),
    depth: question.difficulty === 'hard'
      ? Math.min(100, totalScore - 10)
      : totalScore,
    strengths: totalScore > 70
      ? ['回答结构清晰，思路明确', '对核心概念有较好的理解', '能够结合实际场景作答']
      : totalScore > 50
        ? ['基本回答了核心问题', '有一定的知识储备']
        : ['尝试作答态度积极'],
    weaknesses: totalScore > 70
      ? ['可以补充更多实际项目经验', '部分细节可以更深入']
      : totalScore > 50
        ? ['知识点覆盖不够全面', '表达可以更精炼', '缺少实际案例支撑']
        : ['知识点掌握不牢固', '回答缺乏深度', '建议系统复习该模块'],
    improvedAnswer: `参考回答：\n\n${question.referenceAnswer}\n\n建议结合你的实际项目经验来补充具体案例。`,
    followUpQuestion: totalScore > 60
      ? `针对你的回答，能否再展开说说在实际项目中你是如何应用这一知识点的？`
      : '',
  }
}

function formatEvaluation(evaluation: AnswerEvaluation): string {
  const stars = evaluation.totalScore >= 85 ? '⭐⭐⭐⭐⭐' :
    evaluation.totalScore >= 70 ? '⭐⭐⭐⭐' :
    evaluation.totalScore >= 60 ? '⭐⭐⭐' :
    evaluation.totalScore >= 40 ? '⭐⭐' : '⭐'

  return `## 📊 当前回答评分

| 维度 | 得分 |
|------|------|
| 总分 | **${evaluation.totalScore}** ${stars} |
| 准确性 | ${evaluation.accuracy} |
| 完整性 | ${evaluation.completeness} |
| 表达能力 | ${evaluation.expression} |
| 项目结合度 | ${evaluation.projectRelevance} |
| 回答深度 | ${evaluation.depth} |

**✅ 优点：**
${evaluation.strengths.map((s) => `- ${s}`).join('\n')}

**⚠️ 不足：**
${evaluation.weaknesses.map((w) => `- ${w}`).join('\n')}

**📝 优化建议：**
${evaluation.improvedAnswer}

${evaluation.followUpQuestion ? `**💬 追问：**\n${evaluation.followUpQuestion}` : ''}`
}

function generateHint(question: typeof interviewStore.questions[number]): string {
  if (question.tags.includes('JavaScript')) {
    return '💡 提示：可以从核心概念 → 使用场景 → 实际案例 → 注意事项 这几个层次来组织你的回答。'
  }
  if (question.tags.includes('Vue3')) {
    return '💡 提示：建议从 Vue3 的特性入手，结合 Composition API 和实际开发经验来回答。'
  }
  if (question.tags.includes('TypeScript')) {
    return '💡 提示：可以从类型系统的角度出发，结合代码示例来说明你的观点。'
  }
  if (question.tags.includes('WebGIS') || question.tags.includes('Cesium') || question.tags.includes('OpenLayers')) {
    return '💡 提示：GIS 相关问题建议从技术选型、性能优化、实际业务场景三个方面来回答。'
  }
  if (question.tags.includes('性能优化')) {
    return '💡 提示：可以从网络、渲染、内存、工程化等多个维度来进行系统性分析。'
  }
  if (question.tags.includes('项目表达')) {
    return '💡 提示：用 STAR 法则来组织回答 — 场景(Situation) → 任务(Task) → 行动(Action) → 结果(Result)。'
  }
  return '💡 提示：先给出核心结论，再展开论述；多用具体例子，避免空泛表达。'
}

function getCurrentEvaluation() {
  const q = currentQuestion.value
  if (!q) return null
  return interviewStore.evaluations.find((e) => e.questionId === q.id) || null
}

function generateReport() {
  const { questions, evaluations, config, sessionId } = interviewStore

  const validEvals = evaluations.filter((e) => e.totalScore > 0)
  const totalScore = validEvals.length > 0
    ? Math.round(validEvals.reduce((sum, e) => sum + e.totalScore, 0) / validEvals.length)
    : 0

  const allStrengths: string[] = []
  const allWeaknesses: string[] = []
  evaluations.forEach((e) => {
    e.strengths.forEach((s) => {
      if (!allStrengths.includes(s)) allStrengths.push(s)
    })
    e.weaknesses.forEach((w) => {
      if (!allWeaknesses.includes(w)) allWeaknesses.push(w)
    })
  })

  const questionReviews: QuestionReview[] = questions.map((q) => {
    const evaluation = evaluations.find((e) => e.questionId === q.id)
    const userMsg = interviewStore.messages.find(
      (m) => m.questionId === q.id && m.role === 'user'
    )
    return {
      questionId: q.id,
      question: q.question,
      userAnswer: userMsg?.content || '（未作答）',
      score: evaluation?.totalScore || 0,
      suggestion: evaluation?.improvedAnswer || '',
      referenceAnswer: q.referenceAnswer,
    }
  })

  const report: InterviewReport = {
    sessionId,
    totalScore,
    abilityScores: {
      technicalFoundation: Math.round(
        questions.filter((q) => q.tags.includes('JavaScript') || q.tags.includes('TypeScript')).length > 0
          ? validEvals.reduce((s, e) => s + e.accuracy, 0) / Math.max(1, validEvals.length)
          : 50 + Math.random() * 30
      ),
      projectExperience: Math.round(
        questions.filter((q) => q.tags.includes('项目表达')).length > 0
          ? validEvals.reduce((s, e) => s + e.projectRelevance, 0) / Math.max(1, validEvals.length)
          : 50 + Math.random() * 30
      ),
      expressiveness: Math.round(
        validEvals.reduce((s, e) => s + e.expression, 0) / Math.max(1, validEvals.length)
      ),
      depthOfThinking: Math.round(
        validEvals.reduce((s, e) => s + e.depth, 0) / Math.max(1, validEvals.length)
      ),
      comprehensiveness: Math.round(
        validEvals.reduce((s, e) => s + e.completeness, 0) / Math.max(1, validEvals.length)
      ),
    },
    strengths: allStrengths.slice(0, 5),
    weaknesses: allWeaknesses.slice(0, 5),
    suggestedTopics: [
      ...new Set(allWeaknesses.map((w) => {
        if (w.includes('知识点')) return 'JavaScript 基础'
        if (w.includes('项目')) return '项目经验整理'
        if (w.includes('表达')) return '面试表达训练'
        if (w.includes('深度')) return '技术深度提升'
        return '综合能力提升'
      })),
    ],
    questionReviews,
  }

  reportStore.setReport(report)
}

const modeLabel = computed(() => {
  const map: Record<string, string> = {
    'tech-basic': '技术基础面试',
    'project-deep': '项目深挖面试',
    'baguwen': '八股文训练',
    'scenario': '场景题训练',
    'comprehensive': '综合模拟面试',
  }
  return map[interviewStore.config?.interviewMode || ''] || '面试'
})

// Restore messages auto-display on refresh
onMounted(() => {
  if (interviewStore.messages.length > 0 && interviewStore.status === 'in-progress') {
    nextTick(() => scrollToBottom())
  }
})
</script>

<template>
  <div class="mock-interview-page">
    <!-- No session guard -->
    <div v-if="!interviewStore.hasSession || interviewStore.questions.length === 0" class="empty-state">
      <el-empty description="没有正在进行的面试" />
      <el-button type="primary" @click="router.push('/interview-config')">去配置面试</el-button>
    </div>

    <template v-else>
      <!-- Left: Progress Panel -->
      <div class="interview-left">
        <el-card shadow="never" class="progress-card">
          <template #header>
            <div class="progress-header">
              <span class="progress-title">面试进度</span>
              <el-tag size="small" type="primary">{{ modeLabel }}</el-tag>
            </div>
          </template>

          <div class="progress-stats">
            <div class="stat-item">
              <span class="stat-label">当前进度</span>
              <span class="stat-value">
                {{ interviewStore.currentQuestionIndex + 1 }} / {{ interviewStore.questions.length }}
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">已完成</span>
              <span class="stat-value">{{ interviewStore.evaluations.filter(e => e.totalScore > 0).length }} 题</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">跳过</span>
              <span class="stat-value">{{ interviewStore.evaluations.filter(e => e.totalScore === 0).length }} 题</span>
            </div>
          </div>

          <div class="stat-item" v-if="currentQuestion">
            <span class="stat-label">当前难度</span>
            <el-tag
              size="small"
              :type="currentQuestion.difficulty === 'hard' ? 'danger' : currentQuestion.difficulty === 'easy' ? 'success' : 'warning'"
            >
              {{ currentQuestion.difficulty === 'hard' ? '困难' : currentQuestion.difficulty === 'easy' ? '简单' : '中等' }}
            </el-tag>
          </div>

          <div class="stat-item" v-if="currentQuestion">
            <span class="stat-label">当前标签</span>
            <div class="stat-tags">
              <el-tag v-for="tag in currentQuestion.tags" :key="tag" size="small" class="mini-tag">
                {{ tag }}
              </el-tag>
            </div>
          </div>

          <el-divider />

          <div class="question-list">
            <div class="list-title">题目列表</div>
            <div
              v-for="(q, index) in interviewStore.questions"
              :key="q.id"
              class="question-item"
              :class="{
                'is-current': index === interviewStore.currentQuestionIndex,
                'is-answered': interviewStore.evaluations.some(e => e.questionId === q.id),
              }"
            >
              <div class="q-index">
                <el-icon v-if="interviewStore.evaluations.some(e => e.questionId === q.id && e.totalScore > 0)" color="#67c23a" :size="16">
                  <component is="CircleCheck" />
                </el-icon>
                <el-icon v-else-if="interviewStore.evaluations.some(e => e.questionId === q.id && e.totalScore === 0)" color="#f56c6c" :size="16">
                  <component is="CircleClose" />
                </el-icon>
                <span v-else class="q-dot">{{ index + 1 }}</span>
              </div>
              <span class="q-text">
                第{{ index + 1 }}题
                <span v-if="index === interviewStore.currentQuestionIndex" class="current-badge">当前</span>
              </span>
            </div>
          </div>
        </el-card>
      </div>

      <!-- Center: Chat Area -->
      <div class="interview-center">
        <div class="chat-area" ref="chatContainer">
          <div
            v-for="msg in interviewStore.messages"
            :key="msg.id"
            class="chat-message"
            :class="`msg-${msg.role}`"
          >
            <div class="msg-avatar">
              <span v-if="msg.role === 'interviewer'">🤖</span>
              <span v-else-if="msg.role === 'user'">👤</span>
              <span v-else>📋</span>
            </div>
            <div class="msg-bubble" :class="`bubble-${msg.role}`">
              <div class="msg-content" v-html="msg.content.replace(/\n/g, '<br>')" />
            </div>
          </div>

          <!-- Evaluating indicator -->
          <div v-if="evaluating" class="chat-message msg-system">
            <div class="msg-avatar"><span>📋</span></div>
            <div class="msg-bubble bubble-system">
              <div class="evaluating-dots">
                <span></span><span></span><span></span>
              </div>
              正在评分...
            </div>
          </div>
        </div>

        <!-- Hint -->
        <div v-if="showingHint && hintText" class="hint-bar">
          {{ hintText }}
        </div>

        <!-- Input Area -->
        <div class="input-area" v-if="!hasCurrentAnswer">
          <el-input
            v-model="answerText"
            type="textarea"
            :rows="4"
            placeholder="在此输入你的回答... (按 Ctrl+Enter 提交)"
            :disabled="submitting"
            @keydown.ctrl.enter="handleSubmit"
          />
          <div class="input-actions">
            <div class="input-actions-left">
              <el-button
                size="small"
                text
                type="info"
                @click="handleShowHint"
                :disabled="showingHint"
              >
                查看提示
              </el-button>
            </div>
            <div class="input-actions-right">
              <el-button
                size="small"
                type="warning"
                @click="handleSkip"
                :disabled="submitting"
              >
                我不会
              </el-button>
              <el-button
                size="small"
                type="primary"
                @click="handleSubmit"
                :disabled="!canSubmit"
                :loading="submitting"
              >
                提交回答
              </el-button>
            </div>
          </div>
        </div>

        <!-- Next/Finish after answering -->
        <div v-else class="next-action-bar">
          <div class="next-info">
            <span v-if="getCurrentEvaluation()">
              得分：{{ getCurrentEvaluation()?.totalScore }} 分
            </span>
          </div>
          <el-button
            type="primary"
            @click="handleNextQuestion"
          >
            {{ isLastQuestion ? '结束面试，查看报告' : '下一题' }}
          </el-button>
        </div>
      </div>

      <!-- Right: Question Info -->
      <div class="interview-right">
        <el-card shadow="never" class="info-card">
          <template #header>
            <span>题目辅助信息</span>
          </template>

          <div v-if="currentQuestion" class="info-content">
            <div class="info-section">
              <div class="info-label">考察点</div>
              <div class="info-text">
                {{ currentQuestion.tags.join('、') }} 相关知识点
              </div>
            </div>

            <div class="info-section">
              <div class="info-label">题型</div>
              <div class="info-text">
                {{ currentQuestion.type === 'tech-basic' ? '技术基础' :
                   currentQuestion.type === 'project-deep' ? '项目深挖' :
                   currentQuestion.type === 'baguwen' ? '八股文' :
                   currentQuestion.type === 'scenario' ? '场景题' : '综合题' }}
              </div>
            </div>

            <div class="info-section">
              <div class="info-label">参考思路</div>
              <div class="info-text">
                请先尝试独立作答，回答后系统会给出详细评分和参考答案。
              </div>
            </div>

            <!-- Score Card (after evaluation) -->
            <div v-if="getCurrentEvaluation()" class="score-card">
              <el-divider />
              <div class="info-label">当前评分</div>
              <div class="score-total">
                {{ getCurrentEvaluation()?.totalScore }}
                <span class="score-unit">分</span>
              </div>
              <div class="score-details">
                <div class="score-row">
                  <span>准确性</span>
                  <el-progress :percentage="getCurrentEvaluation()?.accuracy || 0" :stroke-width="6" />
                </div>
                <div class="score-row">
                  <span>完整性</span>
                  <el-progress :percentage="getCurrentEvaluation()?.completeness || 0" :stroke-width="6" />
                </div>
                <div class="score-row">
                  <span>表达能力</span>
                  <el-progress :percentage="getCurrentEvaluation()?.expression || 0" :stroke-width="6" />
                </div>
                <div class="score-row">
                  <span>回答深度</span>
                  <el-progress :percentage="getCurrentEvaluation()?.depth || 0" :stroke-width="6" />
                </div>
              </div>
            </div>
          </div>

          <div v-else class="info-empty">
            <p>暂无题目信息</p>
          </div>
        </el-card>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mock-interview-page {
  height: 100%;
  display: flex;
  gap: 16px;
  min-height: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

/* Left Panel */
.interview-left {
  width: 240px;
  flex-shrink: 0;
}

.progress-card {
  height: 100%;
  overflow-y: auto;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-title {
  font-weight: 600;
}

.progress-stats {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 8px 4px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 4px;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}

.stat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.mini-tag {
  font-size: 11px;
}

.question-list {
  max-height: 300px;
  overflow-y: auto;
}

.list-title {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.question-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: default;
}

.question-item.is-current {
  background: #ecf5ff;
}

.q-index {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.q-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #909399;
}

.q-text {
  font-size: 13px;
  color: #606266;
}

.current-badge {
  font-size: 11px;
  color: #409eff;
  margin-left: 4px;
}

/* Center Chat */
.interview-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  margin-bottom: 12px;
}

.chat-message {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  align-items: flex-start;
}

.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: #f5f7fa;
  flex-shrink: 0;
}

.msg-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.7;
}

.bubble-interviewer {
  background: #f0f6ff;
  border: 1px solid #d9ecff;
  color: #303133;
}

.bubble-user {
  background: #409eff;
  color: #fff;
  margin-left: auto;
}

.bubble-system {
  background: #fdf6ec;
  border: 1px solid #faecd8;
  color: #303133;
}

.msg-user {
  flex-direction: row-reverse;
}

.msg-content {
  word-break: break-word;
}

.evaluating-dots {
  display: inline-flex;
  gap: 4px;
  margin-right: 8px;
}

.evaluating-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #e6a23c;
  animation: dot-bounce 1.4s infinite ease-in-out both;
}

.evaluating-dots span:nth-child(1) { animation-delay: -0.32s; }
.evaluating-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Hint */
.hint-bar {
  padding: 10px 16px;
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #e6a23c;
}

/* Input */
.input-area {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  padding: 12px;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.input-actions-right {
  display: flex;
  gap: 8px;
}

.next-action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f0f9eb;
  border-radius: 8px;
  border: 1px solid #e1f3d8;
}

.next-info {
  font-size: 14px;
  color: #67c23a;
  font-weight: 500;
}

/* Right Panel */
.interview-right {
  width: 280px;
  flex-shrink: 0;
}

.info-card {
  height: 100%;
  overflow-y: auto;
}

.info-section {
  margin-bottom: 16px;
}

.info-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.info-text {
  font-size: 14px;
  color: #303133;
  line-height: 1.6;
}

.score-card {
  margin-top: 12px;
}

.score-total {
  font-size: 36px;
  font-weight: 700;
  color: #409eff;
  text-align: center;
  margin: 8px 0;
}

.score-unit {
  font-size: 16px;
  color: #909399;
}

.score-details {
  margin-top: 8px;
}

.score-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #606266;
}

.score-row span {
  width: 56px;
  flex-shrink: 0;
}

.score-row .el-progress {
  flex: 1;
}

.info-empty {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}
</style>
