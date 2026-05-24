<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useInterviewStore } from '@/stores/modules/interview'
import { useReportStore } from '@/stores/modules/report'
import { useResumeStore } from '@/stores/modules/resume'
import { useHistoryStore } from '@/stores/modules/history'
import { evaluateAnswerStreamApi, generateReportApi } from '@/api/modules/ai'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import VirtualChatList from '@/components/VirtualChatList.vue'
import type { ChatMessage, AnswerEvaluation } from '@/types/interview'
import type { InterviewReport } from '@/types/report'

const router = useRouter()
const interviewStore = useInterviewStore()
const reportStore = useReportStore()
const resumeStore = useResumeStore()
const historyStore = useHistoryStore()

const answerText = ref('')
const evaluating = ref(false)
const streaming = ref(false)
const streamingText = ref('')
const showingHint = ref(false)
const hintText = ref('')
const virtualListRef = ref<InstanceType<typeof VirtualChatList> | null>(null)
const submitting = ref(false)
let stopStreamFn: (() => void) | null = null
let _msgSeq = 0  // 全局消息序号，防止 Date.now() 毫秒级碰撞导致消息覆盖

/** 生成唯一消息 ID */
function _nextMsgId(): string {
    return `msg-${Date.now()}-${++_msgSeq}`
}

const currentQuestion = computed(() => interviewStore.currentQuestion)
const isLastQuestion = computed(() => interviewStore.isLastQuestion)
const hasCurrentAnswer = computed(() => {
    const q = currentQuestion.value
    if (!q) return true
    // Question is "done" when: main evaluation exists AND no active follow-up pending
    const hasEval = interviewStore.evaluations.some((e) => e.questionId === q.id)
    const hasPendingFollowUp = interviewStore.hasActiveFollowUp
    return hasEval && !hasPendingFollowUp
})

const canSubmit = computed(() => {
    return answerText.value.trim().length > 0 && !submitting.value && !hasCurrentAnswer.value && !streaming.value
})

onMounted(() => {
    interviewStore.loadFromStorage()
    historyStore.loadFromStorage()

    if (!interviewStore.hasSession || interviewStore.questions.length === 0) {
        ElMessage.warning('请先配置面试参数')
        router.push('/interview-config')
        return
    }

    if (interviewStore.status === 'finished') {
        router.push('/interview-report')
        return
    }

    if (interviewStore.messages.length === 0 && currentQuestion.value) {
        showCurrentQuestion()
    }
})

/** Auto-advance to next question after a short delay, giving user time to glance at score */
let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutoAdvance() {
    // Clear any existing timer
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
    autoAdvanceTimer = setTimeout(() => {
        autoAdvanceTimer = null
        if (isLastQuestion.value) {
            handleFinish()
        } else {
            interviewStore.nextQuestion()
            answerText.value = ''
            showingHint.value = false
            hintText.value = ''
            showCurrentQuestion()
        }
    }, 2500) // 2.5s delay to skim the score
}

onUnmounted(() => {
    stopStreamFn?.()
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
})

function scrollToBottom() {
    virtualListRef.value?.scrollToBottom()
}

async function showCurrentQuestion() {
    if (!currentQuestion.value) return

    const msg: ChatMessage = {
        id: _nextMsgId(),
        role: 'interviewer',
        content: currentQuestion.value.question,
        createdAt: new Date().toISOString(),
        questionId: currentQuestion.value.id,
        status: 'done',
    }
    interviewStore.addMessage(msg)
    scrollToBottom()
}

async function handleSubmit() {
    if (!canSubmit.value || !currentQuestion.value) return

    submitting.value = true

    const isFollowUpAnswer = interviewStore.hasActiveFollowUp
    const followUpQ = interviewStore.activeFollowUpQuestion

    const userMsg: ChatMessage = {
        id: _nextMsgId(),
        role: 'user',
        content: answerText.value.trim(),
        createdAt: new Date().toISOString(),
        questionId: currentQuestion.value.id,
        status: 'done',
    }
    interviewStore.addMessage(userMsg)
    const userAnswer = answerText.value.trim()
    answerText.value = ''
    scrollToBottom()

    // Generate evaluation via API
    evaluating.value = true

    try {
        resumeStore.loadFromStorage()

        const followUpContext = isFollowUpAnswer
            ? {
                isFollowUp: true,
                followUpQuestion: followUpQ,
                mainAnswer: interviewStore.followUpStates[currentQuestion.value.id]?.mainAnswer || '',
            }
            : undefined

        // 创建评分结果消息（先空壳，流式填充）
        const evalMsgId = _nextMsgId()
        const evalMsg: ChatMessage = {
            id: evalMsgId,
            role: 'system',
            content: '',
            createdAt: new Date().toISOString(),
            questionId: currentQuestion.value.id,
            status: 'streaming',
        }
        interviewStore.addMessage(evalMsg)

        streaming.value = true
        streamingText.value = ''

        const controller = evaluateAnswerStreamApi(
            currentQuestion.value,
            userAnswer,
            resumeStore.resumeInfo,
            {
                onChunk: (_chunk) => {
                    streamingText.value += _chunk
                    interviewStore.updateMessage(evalMsgId, streamingText.value, 'streaming')
                    scrollToBottom()
                },
                onDone: (evaluation) => {
                    interviewStore.addEvaluation(evaluation)
                    interviewStore.updateMessage(evalMsgId, streamingText.value, 'done')
                    finishStreaming(evaluation, isFollowUpAnswer)
                },
                onError: (err) => {
                    ElMessage.error('评分失败: ' + err.message)
                    interviewStore.updateMessage(evalMsgId, streamingText.value || '评分失败，请重试', 'error')
                    finishStreamingError()
                },
            },
            followUpContext
        )
        stopStreamFn = () => controller.abort()
    } catch {
        ElMessage.error('评分失败，请重试')
    } finally {
        evaluating.value = false
        submitting.value = false
        showingHint.value = false
    }
}

/** 流式输出完成后的统一收尾 */
function finishStreaming(evaluation: AnswerEvaluation, isFollowUpAnswer: boolean) {
    streaming.value = false
    streamingText.value = ''
    stopStreamFn = null

    if (!isFollowUpAnswer && evaluation.followUpQuestion) {
        showFollowUpQuestion(evaluation.followUpQuestion)
    } else if (isFollowUpAnswer) {
        interviewStore.clearFollowUp(currentQuestion.value!.id)
        scheduleAutoAdvance()
    } else {
        scheduleAutoAdvance()
    }
    scrollToBottom()
}

/** 流式出错收尾 */
function finishStreamingError() {
    streaming.value = false
    streamingText.value = ''
    stopStreamFn = null
    evaluating.value = false
    submitting.value = false
}

/** Show the follow-up question as an interviewer chat message and activate follow-up state */
function showFollowUpQuestion(followUpText: string) {
    if (!currentQuestion.value) return

    // Find the user's main answer for context
    const mainAnswerMsg = [...interviewStore.messages]
        .reverse()
        .find((m) => m.role === 'user' && m.questionId === currentQuestion.value!.id)
    const mainAnswer = mainAnswerMsg?.content || ''

    // Set follow-up state in store
    interviewStore.setFollowUp(currentQuestion.value.id, followUpText, mainAnswer)

    // Show follow-up as interviewer message
    const followUpMsg: ChatMessage = {
        id: _nextMsgId(),
        role: 'interviewer',
        content: `**💬 追问：**\n${followUpText}`,
        createdAt: new Date().toISOString(),
        questionId: currentQuestion.value.id,
        status: 'done',
    }
    interviewStore.addMessage(followUpMsg)
    scrollToBottom()
}

function handleStopStreaming() {
    stopStreamFn?.()
    stopStreamFn = null
    streaming.value = false
    // Cancel auto-advance timer when user manually stops
    if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer)
        autoAdvanceTimer = null
    }
    if (streamingText.value) {
        // Finalize the last streaming message
        const lastStreaming = [...interviewStore.messages].reverse().find((m) => m.status === 'streaming')
        if (lastStreaming) {
            interviewStore.updateMessage(lastStreaming.id, streamingText.value + '\n\n*（已手动停止）*', 'done')
        }
    }
    streamingText.value = ''
    evaluating.value = false
    ElMessage.info('已停止生成')
}

function handleSkip() {
    if (!currentQuestion.value || streaming.value) return

    const isFollowUpSkip = interviewStore.hasActiveFollowUp

    const userMsg: ChatMessage = {
        id: _nextMsgId(),
        role: 'user',
        content: isFollowUpSkip ? '（我不会这道追问）' : '（我不会这道题）',
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
        weaknesses: [isFollowUpSkip ? '追问未能作答' : '未能作答，建议重点复习该知识点'],
        improvedAnswer: currentQuestion.value.referenceAnswer,
        followUpQuestion: '',
    }
    interviewStore.addEvaluation(evaluation)

    // Clear follow-up state if skipping follow-up
    if (isFollowUpSkip) {
        interviewStore.clearFollowUp(currentQuestion.value.id)
    }

    const evalMsg: ChatMessage = {
        id: _nextMsgId(),
        role: 'system',
        content: isFollowUpSkip
            ? '追问未能作答，请参考下方参考答案加强复习。\n\n**📝 参考答案：**\n' + currentQuestion.value.referenceAnswer
            : '未能作答，建议重点复习该知识点。\n\n**📝 参考答案：**\n' + currentQuestion.value.referenceAnswer,
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
    if (streaming.value) {
        ElMessage.warning('请等待当前内容生成完毕')
        return
    }

    // Cancel any pending auto-advance
    if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer)
        autoAdvanceTimer = null
    }

    // Prevent skipping if there's an active follow-up
    if (interviewStore.hasActiveFollowUp) {
        ElMessage.warning('请先回答追问再进入下一题')
        return
    }

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

async function handleFinish() {
    try {
        ElMessageBox.confirm(
            '所有题目已完成，是否查看面试报告？',
            '面试结束',
            {
                confirmButtonText: '查看报告',
                cancelButtonText: '稍后再说',
                type: 'success',
            }
        ).then(async () => {
            interviewStore.finishInterview()

            const session = {
                id: interviewStore.sessionId,
                config: interviewStore.config!,
                resumeSnapshot: interviewStore.resumeSnapshot || undefined,
                questions: interviewStore.questions,
                messages: interviewStore.messages,
                evaluations: interviewStore.evaluations,
                currentQuestionIndex: interviewStore.currentQuestionIndex,
                status: interviewStore.status as 'finished',
                createdAt: interviewStore.createdAt,
                finishedAt: interviewStore.finishedAt,
            }

            try {
                const report = await generateReportApi(session)
                reportStore.setReport(report)
                saveInterviewHistory(report)
            } catch {
                generateLocalReport()
                saveInterviewHistory(null)
            }

            router.push('/interview-report')
        }).catch(() => {
            interviewStore.finishInterview()
        })
    } catch {
        // User cancelled
    }
}



function generateHint(question: NonNullable<typeof currentQuestion.value>): string {
    if (!question) return '💡 提示：先给出核心结论，再展开论述。'
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



function saveInterviewHistory(report: InterviewReport | null) {
    // 统一通过 historyStore 保存，支持完整回看
    const session = {
        id: interviewStore.sessionId,
        config: interviewStore.config!,
        resumeSnapshot: interviewStore.resumeSnapshot || undefined,
        questions: interviewStore.questions,
        messages: interviewStore.messages,
        evaluations: interviewStore.evaluations,
        currentQuestionIndex: interviewStore.currentQuestionIndex,
        status: 'finished' as const,
        createdAt: interviewStore.createdAt,
        finishedAt: interviewStore.finishedAt || new Date().toISOString(),
    }
    historyStore.addHistory(session, report?.totalScore || 0)
}

function generateLocalReport() {
    const { questions, evaluations, sessionId } = interviewStore
    const validEvals = evaluations.filter((e) => e.totalScore > 0)
    const totalScore = validEvals.length > 0
        ? Math.round(validEvals.reduce((sum, e) => sum + e.totalScore, 0) / validEvals.length)
        : 0

    const report: InterviewReport = {
        sessionId,
        totalScore,
        abilityScores: {
            technicalFoundation: Math.round(40 + Math.random() * 50),
            projectExperience: Math.round(40 + Math.random() * 50),
            expressiveness: Math.round(40 + Math.random() * 50),
            depthOfThinking: Math.round(30 + Math.random() * 50),
            comprehensiveness: Math.round(40 + Math.random() * 50),
        },
        strengths: totalScore > 60 ? ['回答逻辑清晰'] : ['态度认真'],
        weaknesses: totalScore > 60 ? ['项目经验表达可以更精准'] : ['技术基础有待加强'],
        suggestedTopics: ['系统复习核心知识点', '多做模拟练习'],
        questionReviews: questions.map((q) => {
            const ev = evaluations.find((e) => e.questionId === q.id)
            const msg = interviewStore.messages.find((m) => m.questionId === q.id && m.role === 'user')
            return {
                questionId: q.id,
                question: q.question,
                userAnswer: msg?.content || '（未作答）',
                score: ev?.totalScore || 0,
                suggestion: ev?.improvedAnswer || '',
                referenceAnswer: q.referenceAnswer,
            }
        }),
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
</script>

<template>
    <div class="mock-interview-page">
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
                            <span class="stat-value">{{interviewStore.evaluations.filter(e => e.totalScore > 0).length
                            }} 题</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">跳过</span>
                            <span class="stat-value">{{interviewStore.evaluations.filter(e => e.totalScore ===
                                0).length}} 题</span>
                        </div>
                    </div>

                    <template v-if="currentQuestion">
                        <div class="stat-item">
                            <span class="stat-label">当前难度</span>
                            <el-tag size="small"
                                :type="currentQuestion.difficulty === 'hard' ? 'danger' : currentQuestion.difficulty === 'easy' ? 'success' : 'warning'">
                                {{ currentQuestion.difficulty === 'hard' ? '困难' : currentQuestion.difficulty === 'easy'
                                    ? '简单' : '中等' }}
                            </el-tag>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">当前标签</span>
                            <div class="stat-tags">
                                <el-tag v-for="tag in currentQuestion.tags" :key="tag" size="small" class="mini-tag">
                                    {{ tag }}
                                </el-tag>
                            </div>
                        </div>
                    </template>

                    <el-divider />

                    <div class="question-list">
                        <div class="list-title">题目列表</div>
                        <div v-for="(q, index) in interviewStore.questions" :key="q.id" class="question-item" :class="{
                            'is-current': index === interviewStore.currentQuestionIndex,
                            'is-answered': interviewStore.evaluations.some(e => e.questionId === q.id),
                        }">
                            <div class="q-index">
                                <el-icon
                                    v-if="interviewStore.evaluations.some(e => e.questionId === q.id && e.totalScore > 0)"
                                    color="#67c23a" :size="16">
                                    <component is="CircleCheck" />
                                </el-icon>
                                <el-icon
                                    v-else-if="interviewStore.evaluations.some(e => e.questionId === q.id && e.totalScore === 0)"
                                    color="#f56c6c" :size="16">
                                    <component is="CircleClose" />
                                </el-icon>
                                <span v-else class="q-dot">{{ index + 1 }}</span>
                            </div>
                            <span class="q-text">
                                第{{ index + 1 }}题
                                <span v-if="index === interviewStore.currentQuestionIndex"
                                    class="current-badge">当前</span>
                            </span>
                        </div>
                    </div>
                </el-card>
            </div>

            <!-- Center: Chat Area with Virtual List (full width) -->
            <div class="interview-center">
                <VirtualChatList ref="virtualListRef" :items="interviewStore.messages" :estimated-item-height="80"
                    :stick-to-bottom="true" class="chat-area">
                    <template #default="{ item: msg }">
                        <div class="chat-message" :class="`msg-${(msg as ChatMessage).role}`">
                            <div class="msg-avatar">
                                <span v-if="(msg as ChatMessage).role === 'interviewer'">🤖</span>
                                <span v-else-if="(msg as ChatMessage).role === 'user'">👤</span>
                                <span v-else>📋</span>
                            </div>
                            <div class="msg-bubble" :class="`bubble-${(msg as ChatMessage).role}`">
                                <div class="msg-content">
                                    <MarkdownRenderer v-if="(msg as ChatMessage).content"
                                        :content="(msg as ChatMessage).content" variant="chat"
                                        :enable-thinking-fold="true" />
                                    <span v-if="(msg as ChatMessage).status === 'streaming'"
                                        class="streaming-cursor">▍</span>
                                </div>
                            </div>
                        </div>
                    </template>
                </VirtualChatList>

                <!-- 评分等待提示（叠加在列表底部） -->
                <div v-if="evaluating && !streaming" class="evaluating-overlay">
                    <div class="evaluating-dots">
                        <span></span><span></span><span></span>
                    </div>
                    正在评分...
                </div>

                <!-- Stop Streaming Button -->
                <div v-if="streaming" class="stop-bar">
                    <span class="stop-hint">AI 正在生成内容...</span>
                    <el-button size="small" type="danger" text @click="handleStopStreaming">
                        停止生成
                    </el-button>
                </div>

                <!-- Hint -->
                <div v-if="showingHint && hintText" class="hint-bar">
                    {{ hintText }}
                </div>

                <!-- Input Area -->
                <div class="input-area" v-if="!hasCurrentAnswer">
                    <div v-if="interviewStore.hasActiveFollowUp" class="follow-up-notice">
                        💬 面试官正在追问：<strong>{{ interviewStore.activeFollowUpQuestion }}</strong>
                    </div>
                    <el-input v-model="answerText" type="textarea" :rows="4"
                        :placeholder="interviewStore.hasActiveFollowUp ? '请回答面试官的追问... (按 Ctrl+Enter 提交)' : '在此输入你的回答... (按 Ctrl+Enter 提交)'"
                        :disabled="submitting || streaming" @keydown.ctrl.enter="handleSubmit" />
                    <div class="input-actions">
                        <div class="input-actions-left">
                            <el-button size="small" text type="info" @click="handleShowHint"
                                :disabled="showingHint || streaming">
                                查看提示
                            </el-button>
                        </div>
                        <div class="input-actions-right">
                            <el-button size="small" type="warning" @click="handleSkip"
                                :disabled="submitting || streaming">
                                我不会
                            </el-button>
                            <el-button size="small" type="primary" @click="handleSubmit" :disabled="!canSubmit"
                                :loading="submitting">
                                {{ interviewStore.hasActiveFollowUp ? '提交追问回答' : '提交回答' }}
                            </el-button>
                        </div>
                    </div>
                </div>

                <!-- Next/Finish after answering -->
                <div v-else class="next-action-bar">
                    <span class="next-info">已收到评价，继续面试</span>
                    <el-button type="primary" @click="handleNextQuestion" :disabled="streaming">
                        {{ isLastQuestion ? '结束面试，查看报告' : '下一题' }}
                    </el-button>
                </div>
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
    position: relative;
}

.chat-area {
    flex: 1;
    background: #fff;
    border-radius: 8px;
    border: 1px solid #e4e7ed;
    margin-bottom: 12px;
    min-height: 0;
    /* VirtualChatList 接管滚动和 padding */
}

/* 评分等待叠加层 */
.evaluating-overlay {
    position: absolute;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    padding: 10px 18px;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
    font-size: 13px;
    color: #909399;
    z-index: 5;
}

.chat-message {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 6px 16px;
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

.streaming-cursor {
    display: inline;
    animation: blink 1s step-end infinite;
    color: #409eff;
    font-weight: bold;
}

@keyframes blink {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0;
    }
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

.evaluating-dots span:nth-child(1) {
    animation-delay: -0.32s;
}

.evaluating-dots span:nth-child(2) {
    animation-delay: -0.16s;
}

@keyframes dot-bounce {

    0%,
    80%,
    100% {
        transform: scale(0);
    }

    40% {
        transform: scale(1);
    }
}

/* Stop Bar */
.stop-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #fef0f0;
    border: 1px solid #fde2e2;
    border-radius: 8px;
    margin-bottom: 8px;
}

.stop-hint {
    font-size: 13px;
    color: #f56c6c;
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

.follow-up-notice {
    padding: 8px 12px;
    margin-bottom: 10px;
    background: #fdf2e9;
    border: 1px solid #f5cba7;
    border-radius: 6px;
    font-size: 13px;
    color: #e67e22;
    line-height: 1.5;
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
</style>
