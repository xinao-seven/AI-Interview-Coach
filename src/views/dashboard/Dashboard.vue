<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useResumeStore } from '@/stores/modules/resume'
import { useInterviewStore } from '@/stores/modules/interview'
import { useReportStore } from '@/stores/modules/report'
import { useMistakeStore } from '@/stores/modules/mistake'
import type { InterviewReport } from '@/types/report'

const router = useRouter()
const resumeStore = useResumeStore()
const interviewStore = useInterviewStore()
const reportStore = useReportStore()
const mistakeStore = useMistakeStore()

interface HistoryEntry {
    sessionId: string
    totalScore: number
    role: string
    mode: string
    questionCount: number
    finishedAt: string
}

const history = ref<HistoryEntry[]>([])

const hasResume = computed(() => resumeStore.hasResume)
const hasCurrentSession = computed(() => interviewStore.status === 'in-progress')
const lastReport = computed(() => reportStore.report)
const mistakeCount = computed(() => mistakeStore.mistakeCount)
const topWeakPoints = computed(() => {
    const tagCount: Record<string, number> = {}
    mistakeStore.mistakes.forEach((m) => {
        m.tags.forEach((t) => {
            tagCount[t] = (tagCount[t] || 0) + 1
        })
    })
    return Object.entries(tagCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
})

const totalInterviews = computed(() => history.value.length)
const averageScore = computed(() => {
    if (history.value.length === 0) return 0
    return Math.round(
        history.value.reduce((sum, h) => sum + h.totalScore, 0) / history.value.length
    )
})

const modeMap: Record<string, string> = {
    'tech-basic': '技术基础面试',
    'project-deep': '项目深挖面试',
    'baguwen': '八股文训练',
    'scenario': '场景题训练',
    'comprehensive': '综合模拟面试',
}

onMounted(() => {
    resumeStore.loadFromStorage()
    interviewStore.loadFromStorage()
    reportStore.loadFromStorage()
    mistakeStore.loadFromStorage()
    loadHistory()
})

function loadHistory() {
    try {
        const stored = localStorage.getItem('interview-history')
        if (stored) {
            history.value = JSON.parse(stored)
        }
    } catch {
        history.value = []
    }
}

function scoreColor(score: number): string {
    if (score >= 85) return '#67c23a'
    if (score >= 70) return '#409eff'
    if (score >= 50) return '#e6a23c'
    return '#f56c6c'
}

const quickActions = [
    { path: '/interview-config', label: '开始新面试', desc: '配置并开始模拟面试', icon: '🎯', color: '#409eff' },
    { path: '/resume', label: '简历管理', desc: '完善简历获取精准题目', icon: '📄', color: '#67c23a' },
    { path: '/knowledge-training', label: '知识点训练', desc: '按分类系统练习', icon: '📖', color: '#e6a23c' },
    { path: '/project-coach', label: '项目深挖', desc: '准备项目相关追问', icon: '🔍', color: '#909399' },
    { path: '/mistake-book', label: '错题本', desc: `${mistakeCount.value} 道错题待复习`, icon: '📝', color: '#f56c6c' },
    { path: '/interview-report', label: '面试报告', desc: '查看最近面试结果', icon: '📊', color: '#409eff' },
]
</script>

<template>
    <div class="dashboard-page">
        <div class="page-header">
            <div>
                <h2>欢迎回来</h2>
                <p class="welcome-text">
                    <template v-if="hasResume">
                        {{ resumeStore.resumeInfo?.name || '同学' }}，{{ resumeStore.resumeInfo?.targetRole || '准备面试' }}
                    </template>
                    <template v-else>
                        请先完善简历信息，开启你的面试训练之旅
                    </template>
                </p>
            </div>
            <el-button type="primary" size="large" @click="router.push('/interview-config')">
                开始新面试
            </el-button>
        </div>

        <!-- Resume Warning -->
        <el-alert v-if="!hasResume" title="建议先完善简历" type="info" :closable="false" show-icon class="info-alert">
            填写简历信息后，系统可以生成更贴合你背景的面试题目。
            <el-link type="primary" @click="router.push('/resume')">立即完善</el-link>
        </el-alert>

        <!-- Continue Session -->
        <el-alert v-if="hasCurrentSession" title="有进行中的面试" type="warning" :closable="false" show-icon
            class="info-alert">
            你有一个未完成的面试（第 {{ interviewStore.currentQuestionIndex + 1 }}/{{ interviewStore.questions.length }} 题）
            <el-link type="warning" @click="router.push('/mock-interview')">继续面试</el-link>
        </el-alert>

        <!-- Stats Row -->
        <el-row :gutter="16" class="stats-row">
            <el-col :span="6">
                <div class="stat-card">
                    <div class="stat-icon">📋</div>
                    <div class="stat-info">
                        <div class="stat-value">{{ totalInterviews }}</div>
                        <div class="stat-label">历史面试</div>
                    </div>
                </div>
            </el-col>
            <el-col :span="6">
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-info">
                        <div class="stat-value" :style="{ color: scoreColor(averageScore) }">
                            {{ averageScore || '-' }}
                        </div>
                        <div class="stat-label">平均分</div>
                    </div>
                </div>
            </el-col>
            <el-col :span="6">
                <div class="stat-card">
                    <div class="stat-icon">📝</div>
                    <div class="stat-info">
                        <div class="stat-value">{{ mistakeCount }}</div>
                        <div class="stat-label">错题数</div>
                    </div>
                </div>
            </el-col>
            <el-col :span="6">
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <div class="stat-value">{{ resumeStore.projects.length }}</div>
                        <div class="stat-label">项目数</div>
                    </div>
                </div>
            </el-col>
        </el-row>

        <!-- Quick Actions -->
        <el-card shadow="never" class="section-card">
            <template #header><span>快捷入口</span></template>
            <div class="action-grid">
                <div v-for="action in quickActions" :key="action.path" class="action-card"
                    @click="router.push(action.path)">
                    <div class="action-card-icon" :style="{ background: action.color + '1a', color: action.color }">
                        {{ action.icon }}
                    </div>
                    <div class="action-card-info">
                        <span class="action-card-label">{{ action.label }}</span>
                        <span class="action-card-desc">{{ action.desc }}</span>
                    </div>
                </div>
            </div>
        </el-card>

        <!-- Content Row -->
        <el-row :gutter="16">
            <!-- History -->
            <el-col :span="12">
                <el-card shadow="never" class="section-card">
                    <template #header><span>最近面试</span></template>
                    <div v-if="history.length === 0" class="empty-block">
                        <span class="empty-text">暂无面试记录</span>
                        <el-button size="small" type="primary" @click="router.push('/interview-config')">
                            开始第一次面试
                        </el-button>
                    </div>
                    <div v-else class="history-list">
                        <div v-for="(entry, i) in history.slice(0, 5)" :key="entry.sessionId" class="history-item">
                            <span class="history-idx">{{ history.length - i }}</span>
                            <div class="history-info">
                                <span class="history-role">{{ entry.role }}</span>
                                <span class="history-mode">{{ modeMap[entry.mode] || entry.mode }} · {{
                                    entry.questionCount
                                    }}题</span>
                            </div>
                            <span class="history-score" :style="{ color: scoreColor(entry.totalScore) }">
                                {{ entry.totalScore }}分
                            </span>
                            <span class="history-time">{{ new Date(entry.finishedAt).toLocaleDateString('zh-CN')
                                }}</span>
                        </div>
                    </div>
                </el-card>
            </el-col>

            <!-- Weak Points -->
            <el-col :span="12">
                <el-card shadow="never" class="section-card">
                    <template #header><span>薄弱知识点 Top 5</span></template>
                    <div v-if="topWeakPoints.length === 0" class="empty-block">
                        <span class="empty-text">暂无薄弱点数据</span>
                        <span class="empty-hint">完成面试后会自动统计</span>
                    </div>
                    <div v-else class="weak-list">
                        <div v-for="(entry, i) in topWeakPoints" :key="entry[0]" class="weak-item">
                            <span class="weak-rank">{{ i + 1 }}</span>
                            <span class="weak-tag">{{ entry[0] }}</span>
                            <el-progress :percentage="Math.round((entry[1] / topWeakPoints[0][1]) * 100)"
                                :stroke-width="8" :color="i < 2 ? '#f56c6c' : i < 4 ? '#e6a23c' : '#909399'"
                                :show-text="false" style="flex: 1" />
                            <span class="weak-count">{{ entry[1] }}题</span>
                        </div>
                    </div>
                </el-card>
            </el-col>
        </el-row>

        <!-- Recommended Training -->
        <el-card shadow="never" class="section-card">
            <template #header><span>推荐训练方向</span></template>
            <div class="recommend-list">
                <el-tag v-if="!hasResume" type="warning" size="large" effect="plain" class="rec-tag">
                    完善简历信息
                </el-tag>
                <el-tag v-for="(entry, i) in topWeakPoints" :key="entry[0]"
                    :type="i < 2 ? 'danger' : i < 4 ? 'warning' : 'info'" size="large" effect="plain" class="rec-tag">
                    {{ entry[0] }} ({{ entry[1] }}题)
                </el-tag>
                <el-tag v-if="totalInterviews < 3" type="primary" size="large" effect="plain" class="rec-tag">
                    多做模拟面试
                </el-tag>
                <el-tag type="success" size="large" effect="plain" class="rec-tag">
                    整理项目经验
                </el-tag>
            </div>
        </el-card>
    </div>
</template>

<style scoped>
.dashboard-page {
    max-width: 900px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
}

.page-header h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 600;
}

.welcome-text {
    margin: 0;
    color: #606266;
    font-size: 14px;
}

.info-alert {
    margin-bottom: 16px;
}

/* Stats */
.stats-row {
    margin-bottom: 16px;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px 16px;
    background: #fff;
    border-radius: 8px;
    border: 1px solid #e4e7ed;
}

.stat-icon {
    font-size: 28px;
}

.stat-value {
    font-size: 26px;
    font-weight: 700;
    color: #303133;
    line-height: 1.2;
}

.stat-label {
    font-size: 13px;
    color: #909399;
}

/* Quick Actions */
.section-card {
    margin-bottom: 16px;
}

.action-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

.action-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.action-card:hover {
    border-color: #409eff;
    background: #f0f6ff;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.action-card-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
}

.action-card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.action-card-label {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
}

.action-card-desc {
    font-size: 12px;
    color: #909399;
}

/* Empty */
.empty-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 0;
}

.empty-text {
    color: #909399;
    font-size: 14px;
}

.empty-hint {
    color: #c0c4cc;
    font-size: 12px;
}

/* History */
.history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: #fafafa;
    border-radius: 8px;
}

.history-idx {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e4e7ed;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #909399;
    flex-shrink: 0;
}

.history-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.history-role {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
}

.history-mode {
    font-size: 12px;
    color: #909399;
}

.history-score {
    font-weight: 700;
    font-size: 16px;
    flex-shrink: 0;
}

.history-time {
    font-size: 12px;
    color: #c0c4cc;
    flex-shrink: 0;
}

/* Weak Points */
.weak-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.weak-item {
    display: flex;
    align-items: center;
    gap: 10px;
}

.weak-rank {
    width: 20px;
    font-size: 12px;
    font-weight: 700;
    color: #909399;
    text-align: center;
}

.weak-tag {
    width: 72px;
    font-size: 13px;
    color: #606266;
}

.weak-count {
    font-size: 12px;
    color: #909399;
    width: 26px;
}

/* Recommend */
.recommend-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.rec-tag {
    cursor: default;
}
</style>
