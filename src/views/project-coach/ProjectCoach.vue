<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useResumeStore } from '@/stores/modules/resume'
import { useMistakeStore } from '@/stores/modules/mistake'
import { polishResumeProjectApi, generateProjectQuestionsApi } from '@/api/modules/ai'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { ResumeProject, ResumeInfo } from '@/types/resume'
import type { InterviewQuestion } from '@/types/interview'

const resumeStore = useResumeStore()
const mistakeStore = useMistakeStore()

const selectedProjectId = ref<string>('')
const generating = ref('')
const results = ref<Record<string, string>>({})
const projectQuestions = ref<InterviewQuestion[]>([])
const optimizationResult = ref<{
  original: string
  optimized: string
  suggestions: string[]
} | null>(null)
const copiedBtn = ref('')

const projects = computed(() => resumeStore.projects)

const selectedProject = computed(() => {
  return projects.value.find((p) => p.id === selectedProjectId.value) || null
})

onMounted(() => {
  resumeStore.loadFromStorage()
  if (projects.value.length > 0) {
    selectedProjectId.value = projects.value[0].id
  }
})

async function handleGenerate(type: string) {
  if (!selectedProject.value) {
    ElMessage.warning('请先选择一个项目')
    return
  }

  generating.value = type

  try {
    switch (type) {
      case 'intro-1min':
        results.value[type] = generate1MinIntro(selectedProject.value)
        break
      case 'intro-3min':
        results.value[type] = generate3MinIntro(selectedProject.value)
        break
      case 'highlights':
        results.value[type] = generateHighlights(selectedProject.value)
        break
      case 'questions':
        await generateQuestions(selectedProject.value)
        break
      case 'difficulties':
        results.value[type] = generateDifficultiesAnswer(selectedProject.value)
        break
      case 'polish':
        await generatePolish(selectedProject.value)
        break
    }
  } catch {
    ElMessage.error('生成失败，请重试')
  } finally {
    generating.value = ''
  }
}

function generate1MinIntro(project: ResumeProject): string {
  return `## ${project.name} — 1 分钟项目介绍

> 适合面试开场自我介绍中使用，约 150 字

**项目背景：**
${project.description}

**我的角色：** ${project.role}

**技术方案：**
采用 ${project.techStack.join('、')} 等技术栈，完成了从需求分析到上线交付的全流程开发。

**核心成果：**
${project.result || '项目已成功上线并稳定运行'}

> 建议：用 STAR 法则开场时，先一句话概括项目价值，再展开技术细节。`
}

function generate3MinIntro(project: ResumeProject): string {
  return `## ${project.name} — 3 分钟深度介绍

> 适合技术面详细展开，约 400 字

### 一、项目背景与目标
${project.description}

### 二、技术架构
- **前端：** ${project.techStack.join(' + ')}
- **我的角色：** ${project.role}

### 三、核心功能实现
${project.highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

### 四、技术难点攻克
${project.difficulties || '项目开发过程中遇到的主要技术挑战包括性能优化、复杂交互实现等。'}

### 五、项目成果与反思
${project.result || '项目上线后运行稳定，获得了良好的用户反馈。'}

> 建议：根据面试官的关注点灵活调整各部分的时间分配。`
}

function generateHighlights(project: ResumeProject): string {
  const techStack = project.techStack.join('、')
  return `## ${project.name} — 技术亮点提炼

### 🌟 核心技术亮点

1. **技术选型思路**
   选择 ${techStack} 的原因为：
   - 团队技术栈匹配度高，学习成本低
   - 社区生态成熟，遇到问题容易找到解决方案
   - 能满足项目性能要求（大数据量渲染/复杂交互）

2. **架构设计亮点**
   - 采用组件化/模块化架构，提升了代码复用率
   - 统一的状态管理方案，保证数据流向清晰
   - 合理的路由设计，支持权限控制和懒加载

3. **性能优化亮点**
   - 虚拟列表处理大数据量渲染
   - 图片懒加载和资源预加载策略
   - 构建产物的代码分割和 Tree Shaking

4. **工程化实践**
   - ESLint + Prettier 统一代码风格
   - Git Hooks 实现提交前检查
   - CI/CD 自动构建部署

> 面试时选择 2-3 个最有代表性的亮点重点展开，其余可以一句话带过。`
}

async function generateQuestions(project: ResumeProject) {
  const questions = await generateProjectQuestionsApi(project)
  projectQuestions.value = questions
}

function generateDifficultiesAnswer(project: ResumeProject): string {
  return `## ${project.name} — 难点深度回答

### 💡 核心难点：${project.difficulties || '复杂业务场景的技术实现'}

### 回答框架（按 STAR-P 法则）：

**1. 问题背景 (Situation)**
在 ${project.name} 项目中，我们面临 ${project.difficulties || '复杂的技术挑战'}。

**2. 分析过程 (Task)**
经过排查分析，问题的根本原因在于：
- 业务复杂度高，涉及多系统协同
- 数据量大，对渲染性能要求高
- 用户交互复杂，体验要求高

**3. 解决方案 (Action)**
我采取了以下措施：
${project.highlights.map((h) => `- ${h}`).join('\n')}

**4. 最终成果 (Result)**
${project.result || '问题得到有效解决，系统稳定运行'}

**5. 经验总结 (Principles)**
- 遇到复杂问题先做充分的技术调研
- 做好性能基准测试，数据驱动优化
- 技术方案要留有余地，便于后续扩展

> 面试回答时注意控制在 2-3 分钟内，重点突出你个人的思考和贡献。`
}

async function generatePolish(project: ResumeProject) {
  const result = await polishResumeProjectApi(project)
  optimizationResult.value = {
    original: project.description,
    optimized: result.optimized.description,
    suggestions: result.suggestions,
  }
}

function copyText(text: string, key: string) {
  navigator.clipboard.writeText(text).then(() => {
    copiedBtn.value = key
    ElMessage.success('已复制到剪贴板')
    setTimeout(() => { copiedBtn.value = '' }, 2000)
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

function applyOptimized() {
  if (!optimizationResult.value || !selectedProject.value) return
  resumeStore.updateProject(selectedProject.value.id, {
    description: optimizationResult.value.optimized,
  })
  ElMessage.success('已将优化后的项目描述写入简历')
}

function addToMistakeBook(question: InterviewQuestion) {
  mistakeStore.loadFromStorage()
  mistakeStore.addMistake({
    question,
    userAnswer: '',
    evaluation: null,
    addedAt: new Date().toISOString(),
    tags: question.tags,
  })
  ElMessage.success('已添加到错题本')
}

function clearResult(type: string) {
  delete results.value[type]
  if (type === 'questions') projectQuestions.value = []
  if (type === 'polish') optimizationResult.value = null
}

const coachActions = [
  { key: 'intro-1min', label: '生成 1 分钟介绍', desc: '简洁有力的项目概述', icon: '⏱' },
  { key: 'intro-3min', label: '生成 3 分钟介绍', desc: '技术面试详细展开', icon: '📋' },
  { key: 'highlights', label: '提炼技术亮点', desc: '挖掘项目核心竞争力', icon: '⭐' },
  { key: 'questions', label: '生成可能追问', desc: '提前准备高频问题', icon: '❓' },
  { key: 'difficulties', label: '生成难点回答', desc: 'STAR-P 框架深度剖析', icon: '🔧' },
  { key: 'polish', label: '优化项目描述', desc: '润色表达+量化建议', icon: '✨' },
]
</script>

<template>
  <div class="project-coach-page">
    <div class="page-header">
      <h2>项目深挖助手</h2>
      <p class="page-desc">围绕你的项目经历，全方位准备面试可能问到的问题</p>
    </div>

    <!-- No projects -->
    <el-empty
      v-if="projects.length === 0"
      description="暂无项目经历，请先在「简历管理」中添加你的项目"
      :image-size="100"
    >
      <template #default>
        <el-button type="primary" @click="$router.push('/resume')">去完善简历</el-button>
      </template>
    </el-empty>

    <template v-else>
      <!-- Project Selector -->
      <el-card shadow="never" class="selector-card">
        <div class="selector-row">
          <span class="selector-label">选择项目：</span>
          <el-select v-model="selectedProjectId" style="width: 360px" placeholder="请选择项目">
            <el-option
              v-for="p in projects"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </div>

        <!-- Project Info -->
        <div v-if="selectedProject" class="project-info">
          <el-tag type="info">{{ selectedProject.role }}</el-tag>
          <div class="project-tech">
            <el-tag
              v-for="tech in selectedProject.techStack"
              :key="tech"
              size="small"
              class="tech-tag"
            >
              {{ tech }}
            </el-tag>
          </div>
        </div>
      </el-card>

      <!-- Coach Actions -->
      <el-card shadow="never" class="actions-card">
        <template #header><span>面试准备功能</span></template>
        <div class="action-grid">
          <div
            v-for="action in coachActions"
            :key="action.key"
            class="action-item"
            :class="{ 'is-loading': generating === action.key }"
            @click="handleGenerate(action.key)"
          >
            <span class="action-icon">{{ action.icon }}</span>
            <div class="action-info">
              <span class="action-label">{{ action.label }}</span>
              <span class="action-desc">{{ action.desc }}</span>
            </div>
            <el-icon v-if="generating === action.key" class="action-loading">
              <component is="Loading" />
            </el-icon>
          </div>
        </div>
      </el-card>

      <!-- Results -->
      <div
        v-for="action in coachActions"
        :key="action.key"
      >
        <!-- Text Results -->
        <el-card
          v-if="results[action.key] && action.key !== 'questions'"
          shadow="never"
          class="result-card"
        >
          <template #header>
            <div class="result-header">
              <span>{{ action.label }} 结果</span>
              <div class="result-actions">
                <el-button size="small" text @click="copyText(results[action.key], action.key)">
                  {{ copiedBtn === action.key ? '已复制!' : '复制内容' }}
                </el-button>
                <el-button size="small" text type="danger" @click="clearResult(action.key)">
                  清除
                </el-button>
              </div>
            </div>
          </template>
          <MarkdownRenderer :content="results[action.key]" variant="report" />
        </el-card>

        <!-- Questions Result -->
        <el-card
          v-if="action.key === 'questions' && projectQuestions.length > 0"
          shadow="never"
          class="result-card"
        >
          <template #header>
            <div class="result-header">
              <span>{{ action.label }} ({{ projectQuestions.length }} 题)</span>
              <div class="result-actions">
                <el-button size="small" text type="danger" @click="clearResult(action.key)">
                  清除
                </el-button>
              </div>
            </div>
          </template>
          <div class="questions-list">
            <div
              v-for="(q, i) in projectQuestions"
              :key="q.id"
              class="question-card"
            >
              <div class="question-num">Q{{ i + 1 }}</div>
              <div class="question-body">
                <p class="question-text">{{ q.question }}</p>
                <div class="question-tags">
                  <el-tag
                    v-for="t in q.tags"
                    :key="t"
                    size="small"
                  >
                    {{ t }}
                  </el-tag>
                </div>
              </div>
              <div class="question-actions">
                <el-button size="small" text @click="copyText(q.question, `q-${i}`)">
                  {{ copiedBtn === `q-${i}` ? '已复制' : '复制' }}
                </el-button>
                <el-button size="small" text type="warning" @click="addToMistakeBook(q)">
                  加入错题本
                </el-button>
              </div>
            </div>
          </div>
        </el-card>

        <!-- Polish Result -->
        <el-card
          v-if="action.key === 'polish' && optimizationResult"
          shadow="never"
          class="result-card"
        >
          <template #header>
            <div class="result-header">
              <span>项目描述优化</span>
              <div class="result-actions">
                <el-button size="small" text @click="copyText(
                  optimizationResult.optimized, 'polish'
                )">
                  {{ copiedBtn === 'polish' ? '已复制!' : '复制优化版' }}
                </el-button>
                <el-button size="small" type="primary" @click="applyOptimized">
                  一键替换到简历
                </el-button>
                <el-button size="small" text type="danger" @click="clearResult(action.key)">
                  清除
                </el-button>
              </div>
            </div>
          </template>

          <el-row :gutter="20">
            <el-col :span="12">
              <div class="compare-box">
                <div class="compare-label before">优化前</div>
                <div class="compare-text">{{ optimizationResult.original }}</div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="compare-box">
                <div class="compare-label after">优化后</div>
                <div class="compare-text optimized">
                  <MarkdownRenderer :content="optimizationResult.optimized" variant="report" />
                </div>
              </div>
            </el-col>
          </el-row>

          <div v-if="optimizationResult.suggestions.length" class="suggestions-box">
            <div class="suggestions-title">优化建议：</div>
            <ul>
              <li v-for="s in optimizationResult.suggestions" :key="s">{{ s }}</li>
            </ul>
          </div>
        </el-card>
      </div>
    </template>
  </div>
</template>

<style scoped>
.project-coach-page {
  max-width: 900px;
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

.selector-card {
  margin-bottom: 16px;
}

.selector-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.selector-label {
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.project-tech {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tech-tag {
  margin: 0;
}

.actions-card {
  margin-bottom: 16px;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.action-item.is-loading {
  border-color: #409eff;
  opacity: 0.7;
  pointer-events: none;
}

.action-icon {
  font-size: 24px;
}

.action-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-label {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.action-desc {
  font-size: 12px;
  color: #909399;
}

.action-loading {
  margin-left: auto;
  color: #409eff;
}

.result-card {
  margin-bottom: 16px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.result-actions {
  display: flex;
  gap: 4px;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-card {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  align-items: flex-start;
}

.question-num {
  font-weight: 700;
  font-size: 16px;
  color: #409eff;
  flex-shrink: 0;
  padding-top: 2px;
}

.question-body {
  flex: 1;
}

.question-text {
  margin: 0 0 8px;
  color: #303133;
  line-height: 1.6;
}

.question-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.question-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.compare-box {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #ebeef5;
}

.compare-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  padding: 2px 10px;
  border-radius: 4px;
  display: inline-block;
}

.compare-label.before {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
}

.compare-label.after {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}

.compare-text {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-wrap;
}

.suggestions-box {
  margin-top: 16px;
  padding: 12px 16px;
  background: #fdf6ec;
  border-radius: 8px;
  border: 1px solid #faecd8;
}

.suggestions-title {
  font-weight: 600;
  color: #e6a23c;
  margin-bottom: 6px;
}

.suggestions-box ul {
  margin: 0;
  padding-left: 18px;
}

.suggestions-box li {
  color: #606266;
  line-height: 1.8;
}
</style>
