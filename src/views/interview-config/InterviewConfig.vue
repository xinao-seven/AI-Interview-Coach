<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElAlert } from 'element-plus'
import { useResumeStore } from '@/stores/modules/resume'
import { useInterviewStore } from '@/stores/modules/interview'
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

function generateMockQuestions(): InterviewQuestion[] {
  const { targetRole, interviewMode, difficulty, questionCount, focusAreas } = config.value

  // Question templates by mode and focus area
  const templates: Record<string, Record<string, string[]>> = {
    'tech-basic': {
      'HTML/CSS': [
        '请解释 HTML5 语义化标签及其对 SEO 的影响',
        'CSS 实现水平垂直居中的几种方式，各有什么优缺点？',
        '谈谈你对 BFC 的理解及其应用场景',
      ],
      'JavaScript': [
        '请解释 JavaScript 的事件循环机制',
        '闭包的原理和使用场景是什么？',
        '谈谈你对原型链的理解',
        'Promise.all 和 Promise.race 的区别是什么？',
      ],
      'TypeScript': [
        'TypeScript 中 interface 和 type 的区别是什么？',
        '请解释泛型的使用场景，并举例说明',
        '谈谈 TypeScript 的类型推导机制',
      ],
      'Vue3': [
        'Vue3 Composition API 和 Options API 的区别？',
        '请解释 Vue3 的响应式原理（Proxy）',
        'Vue3 中 watch 和 watchEffect 的区别？',
        '谈谈你对 Vue3 Diff 算法的理解',
      ],
      '工程化': [
        'Webpack 和 Vite 的区别是什么？',
        '谈谈你对 CI/CD 的理解和实践经验',
        '如何搭建一个组件库的工程化环境？',
      ],
      'HTTP/浏览器': [
        '从输入 URL 到页面展示，发生了哪些过程？',
        '请解释 HTTP 强缓存和协商缓存的区别',
        '什么是跨域？如何解决跨域问题？',
      ],
      '性能优化': [
        '前端性能优化的常用手段有哪些？',
        '如何优化首屏加载速度？',
        '谈谈你对虚拟列表和懒加载的理解',
      ],
    },
    'project-deep': {
      '项目表达': [
        '请用 1 分钟介绍你最有挑战性的项目',
        '在这个项目中你遇到了什么技术难点？如何解决的？',
        '如果让你重新设计这个项目，你会做哪些改进？',
        '这个项目的架构是怎样的？为什么选择这种架构？',
      ],
      'WebGIS': [
        '你在 WebGIS 项目中使用了哪些地图框架？为什么选择它？',
        '如何优化大规模地理数据的渲染性能？',
        '谈谈你对空间数据可视化的理解',
      ],
      'Three.js': [
        'Three.js 中如何实现高性能的 3D 场景？',
        '请描述一次使用 Three.js 解决实际业务问题的经历',
      ],
      'Cesium': [
        'Cesium 中如何处理大量实体（Entity）的性能问题？',
        '谈谈 Cesium 中 3D Tiles 的加载和渲染原理',
      ],
    },
    'baguwen': {
      'JavaScript': [
        '请解释 var、let、const 的区别',
        '箭头函数和普通函数的区别是什么？',
        '什么是防抖和节流？如何实现？',
        '请解释深拷贝和浅拷贝的区别',
      ],
      'Vue3': [
        'v-if 和 v-show 的区别是什么？',
        'Vue Router 的 hash 模式和 history 模式有什么区别？',
        '请解释 Pinia 和 Vuex 的区别',
        'Vue3 中 ref 和 reactive 的区别？',
      ],
      'TypeScript': [
        'TypeScript 中 any、unknown、never 的区别是什么？',
        '什么是类型守卫？如何实现？',
      ],
      'HTTP/浏览器': [
        'GET 和 POST 请求的区别是什么？',
        '什么是 RESTful API？如何设计？',
        '请解释常见的 HTTP 状态码及其含义',
      ],
      '工程化': [
        '什么是 Tree Shaking？Vite 是如何实现 Tree Shaking 的？',
        '请解释 npm 的 semver 版本号规则',
      ],
    },
    'scenario': {
      'JavaScript': [
        '实现一个 Promise 并发控制函数，限制同时执行的 Promise 数量',
        '设计一个前端埋点系统，你会考虑哪些方面？',
      ],
      'Vue3': [
        '设计一个大型表单系统，如何处理复杂的表单联动和验证？',
        '设计一个通用的权限管理系统前端方案',
      ],
      '性能优化': [
        '一个页面加载很慢，请描述你的排查和优化思路',
        '设计一个前端监控 SDK，监控页面性能和错误',
      ],
      'WebGIS': [
        '设计一个实时车辆监控系统的前端方案',
        '如何处理地图上 10 万个 marker 的渲染性能？',
      ],
      'Three.js': [
        '设计一个 3D 数字孪生系统的前端架构',
        '如何实现一个在线 3D 编辑器？',
      ],
    },
    'comprehensive': {
      'JavaScript': [
        '谈谈你对 JavaScript 异步编程的理解',
        'ES6 之后你常用的新特性有哪些？',
      ],
      'Vue3': [
        'Vue3 组件通信有哪些方式？各适用于什么场景？',
        '谈谈你对 Vue3 编译优化的理解',
      ],
      'TypeScript': [
        '在实际项目中 TypeScript 给你带来了哪些收益？',
        '如何为一个已有的 JavaScript 项目添加 TypeScript？',
      ],
      '项目表达': [
        '请介绍一个你作为核心开发的项目的完整技术方案',
      ],
    },
  }

  const questions: InterviewQuestion[] = []
  const modeTemplates = templates[interviewMode] || templates['tech-basic']

  // Flatten all matching templates
  const availableQuestions: Array<{ question: string; area: string }> = []
  for (const area of focusAreas) {
    const areaQuestions = modeTemplates[area]
    if (areaQuestions) {
      areaQuestions.forEach((q) => {
        availableQuestions.push({ question: q, area })
      })
    }
  }

  // If no specific matches, fall back to general questions
  if (availableQuestions.length === 0) {
    const allAreas = Object.keys(modeTemplates)
    allAreas.forEach((area) => {
      modeTemplates[area].forEach((q) => {
        availableQuestions.push({ question: q, area })
      })
    })
  }

  // Shuffle and pick
  const shuffled = availableQuestions.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, questionCount)

  selected.forEach((item, index) => {
    questions.push({
      id: `q-${Date.now()}-${index}`,
      question: `${index + 1}. ${item.question}`,
      type: interviewMode,
      tags: [item.area, difficulty],
      difficulty,
      source: targetRole,
      referenceAnswer: '参考答案将在提交回答后展示。',
    })
  })

  return questions
}

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

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800))

  const questions = generateMockQuestions()

  resumeStore.loadFromStorage()
  if (resumeStore.resumeInfo) {
    interviewStore.setResumeSnapshot(resumeStore.resumeInfo)
  }
  interviewStore.setConfig({ ...config.value })
  interviewStore.setQuestions(questions)

  generating.value = false
  ElMessage.success(`成功生成 ${questions.length} 道面试题`)
  router.push('/mock-interview')
}
</script>

<template>
  <div class="interview-config-page">
    <div class="page-header">
      <h2>面试配置</h2>
      <p class="page-desc">请设置你的面试参数，系统将根据配置生成个性化面试题</p>
    </div>

    <el-alert
      v-if="!hasResume"
      title="请先完善简历信息"
      type="warning"
      :closable="false"
      show-icon
      class="resume-alert"
    >
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
            <el-option
              v-for="role in roleOptions"
              :key="role"
              :label="role"
              :value="role"
            />
          </el-select>
        </el-form-item>

        <!-- Interview Mode -->
        <el-form-item label="面试模式">
          <el-radio-group v-model="config.interviewMode">
            <el-radio
              v-for="mode in modeOptions"
              :key="mode.value"
              :value="mode.value"
              class="mode-radio"
            >
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
            <el-radio-button
              v-for="d in difficultyOptions"
              :key="d.value"
              :value="d.value"
            >
              {{ d.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- Question Count -->
        <el-form-item label="题目数量">
          <el-radio-group v-model="config.questionCount">
            <el-radio-button
              v-for="c in countOptions"
              :key="c"
              :value="c"
            >
              {{ c }} 题
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- Focus Areas -->
        <el-form-item label="考察方向">
          <el-checkbox-group v-model="config.focusAreas" class="focus-checkboxes">
            <el-checkbox
              v-for="area in focusAreaOptions"
              :key="area"
              :label="area"
              :value="area"
            >
              {{ area }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <!-- Summary -->
        <el-divider />
        <div class="config-summary">
          <el-tag type="info">{{ config.targetRole }}</el-tag>
          <el-tag type="primary">
            {{ modeOptions.find((m) => m.value === config.interviewMode)?.label }}
          </el-tag>
          <el-tag :type="config.difficulty === 'hard' ? 'danger' : config.difficulty === 'easy' ? 'success' : 'warning'">
            {{ difficultyOptions.find((d) => d.value === config.difficulty)?.label }}
          </el-tag>
          <el-tag>{{ config.questionCount }} 题</el-tag>
          <span class="summary-areas">
            考察：{{ config.focusAreas.join('、') || '未选择' }}
          </span>
        </div>

        <!-- Generate Button -->
        <el-form-item style="margin-top: 24px">
          <el-button
            type="primary"
            size="large"
            :loading="generating"
            @click="handleGenerate"
            style="width: 200px"
          >
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
