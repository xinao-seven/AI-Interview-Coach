<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElAlert } from 'element-plus'
import { useResumeStore } from '@/stores/modules/resume'
import { useInterviewStore } from '@/stores/modules/interview'
import { generateQuestionsApi } from '@/api/modules/ai'
import type { InterviewConfig, InterviewQuestion } from '@/types/interview'

const router = useRouter()
const resumeStore = useResumeStore()
const interviewStore = useInterviewStore()

const hasResume = computed(() => resumeStore.hasResume)

const roleOptions = [
    '前端开发工程师',
    'Vue 开发工程师',
    'WebGIS 开发工程师',
    'AI 前端应用开发工程师',
    '实习 / 校招前端岗位',
]

const modeOptions = [
    { label: '技术基础面试', value: 'tech-basic', desc: 'HTML/CSS/JS/TS 基础知识和原理' },
    { label: '项目深挖面试', value: 'project-deep', desc: '围绕简历项目深入提问' },
    { label: '八股文训练', value: 'baguwen', desc: '经典面试题和概念问答' },
    { label: '场景题训练', value: 'scenario', desc: '实际开发场景分析和方案设计' },
    { label: '综合模拟面试', value: 'comprehensive', desc: '混合技术和项目问题' },
]

const difficultyOptions = [
    { label: '简单', value: 'easy' },
    { label: '中等', value: 'medium' },
    { label: '困难', value: 'hard' },
]

const countOptions = [5, 10, 15]

const focusAreaOptions = [
    'HTML/CSS',
    'JavaScript',
    'TypeScript',
    'Vue3',
    '工程化',
    'HTTP/浏览器',
    '性能优化',
    'WebGIS',
    'Three.js',
    'Cesium',
    'OpenLayers',
    '项目表达',
]

const config = ref<InterviewConfig>({
    targetRole: '前端开发工程师',
    interviewMode: 'tech-basic',
    difficulty: 'medium',
    questionCount: 5,
    focusAreas: ['Vue3', 'TypeScript', 'JavaScript'],
})

const generating = ref(false)

onMounted(() => {
    
    resumeStore.loadFromStorage()
    // Restore previous config if exists
    if (interviewStore.config) {
        config.value = { ...interviewStore.config }
    }
})

async function handleGenerate() {
    if (!hasResume.value) {
        ElMessage.warning('请先在「简历管理」页面完善你的简历信息')
        return
    }

    if (config.value.focusAreas.length === 0) {
        ElMessage.warning('请至少选择一个考察方向')
        return
    }

    generating.value = true

    try {
        console.log('InterviewConfig mounted, loading resume from storage...')
        resumeStore.loadFromStorage()
        console.log('Resume loaded:', resumeStore.resumeInfo)
        if (resumeStore.resumeInfo) {
            interviewStore.setResumeSnapshot(resumeStore.resumeInfo)
        }
        const questions = await generateQuestionsApi(resumeStore.resumeInfo, config.value)

        interviewStore.setConfig({ ...config.value })
        interviewStore.setQuestions(questions)

        generating.value = false
        ElMessage.success(`成功生成 ${questions.length} 道面试题`)
        router.push('/mock-interview')
    } catch {
        generating.value = false
        ElMessage.error('题目生成失败，请检查后端服务是否启动后重试')
    }
}
</script>

<template>
    <div class="interview-config-page">
        <div class="page-header">
            <h2>面试配置</h2>
            <p class="page-desc">请设置你的面试参数，系统将根据配置生成个性化面试题</p>
        </div>

        <el-alert v-if="!hasResume" title="请先完善简历信息" type="warning" :closable="false" show-icon class="resume-alert">
            <template #default>
                系统检测到你还没有填写简历信息，建议先前往
                <el-link type="warning" @click="router.push('/resume')">简历管理</el-link>
                页面完善个人简历，以获得更精准的面试题目。
            </template>
        </el-alert>

        <el-card shadow="never" class="config-card">
            <el-form label-width="120px" label-position="left" class="config-form">
                <!-- Target Role -->
                <el-form-item label="目标岗位">
                    <el-select v-model="config.targetRole" style="width: 320px">
                        <el-option v-for="role in roleOptions" :key="role" :label="role" :value="role" />
                    </el-select>
                </el-form-item>

                <!-- Interview Mode -->
                <el-form-item label="面试模式">
                    <el-radio-group v-model="config.interviewMode">
                        <el-radio v-for="mode in modeOptions" :key="mode.value" :value="mode.value" class="mode-radio">
                            <div class="mode-label">
                                <span class="mode-name">{{ mode.label }}</span>
                                <span class="mode-desc">{{ mode.desc }}</span>
                            </div>
                        </el-radio>
                    </el-radio-group>
                </el-form-item>

                <!-- Difficulty -->
                <el-form-item label="难度选择">
                    <el-radio-group v-model="config.difficulty">
                        <el-radio-button v-for="d in difficultyOptions" :key="d.value" :value="d.value">
                            {{ d.label }}
                        </el-radio-button>
                    </el-radio-group>
                </el-form-item>

                <!-- Question Count -->
                <el-form-item label="题目数量">
                    <el-radio-group v-model="config.questionCount">
                        <el-radio-button v-for="c in countOptions" :key="c" :value="c">
                            {{ c }} 题
                        </el-radio-button>
                    </el-radio-group>
                </el-form-item>

                <!-- Focus Areas -->
                <el-form-item label="考察方向">
                    <el-checkbox-group v-model="config.focusAreas" class="focus-checkboxes">
                        <el-checkbox v-for="area in focusAreaOptions" :key="area" :label="area" :value="area">
                            {{ area }}
                        </el-checkbox>
                    </el-checkbox-group>
                </el-form-item>

                <!-- Summary -->
                <el-divider />
                <div class="config-summary">
                    <el-tag type="info">{{ config.targetRole }}</el-tag>
                    <el-tag type="primary">
                        {{modeOptions.find((m) => m.value === config.interviewMode)?.label}}
                    </el-tag>
                    <el-tag
                        :type="config.difficulty === 'hard' ? 'danger' : config.difficulty === 'easy' ? 'success' : 'warning'">
                        {{difficultyOptions.find((d) => d.value === config.difficulty)?.label}}
                    </el-tag>
                    <el-tag>{{ config.questionCount }} 题</el-tag>
                    <span class="summary-areas">
                        考察：{{ config.focusAreas.join('、') || '未选择' }}
                    </span>
                </div>

                <!-- Generate Button -->
                <el-form-item style="margin-top: 24px">
                    <el-button type="primary" size="large" :loading="generating" @click="handleGenerate"
                        style="width: 200px">
                        {{ generating ? '正在生成面试题...' : '生成面试题' }}
                    </el-button>
                    <span class="generate-hint">
                        将根据简历信息和面试配置生成个性化题目
                    </span>
                </el-form-item>
            </el-form>
        </el-card>
    </div>
</template>

<style scoped>
.interview-config-page {
    max-width: 800px;
    margin: 0 auto;
}

.page-header {
    margin-bottom: 20px;
}

.page-header h2 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 600;
}

.page-desc {
    color: #909399;
    font-size: 14px;
    margin: 0;
}

.resume-alert {
    margin-bottom: 16px;
}

.config-card {
    border: 1px solid #e4e7ed;
}

.config-form {
    padding: 8px 0;
}

.mode-radio {
    display: block;
    margin-bottom: 12px;
    height: auto !important;
    padding: 8px 0;
}

.mode-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.mode-name {
    font-weight: 500;
    font-size: 15px;
}

.mode-desc {
    font-size: 13px;
    color: #909399;
}

.focus-checkboxes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px 16px;
}

.config-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 0;
}

.summary-areas {
    color: #606266;
    font-size: 14px;
    margin-left: 8px;
}

.generate-hint {
    margin-left: 16px;
    color: #909399;
    font-size: 13px;
}
</style>
