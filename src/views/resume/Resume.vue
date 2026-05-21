<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit, UploadFilled, Check, MagicStick } from '@element-plus/icons-vue'
import { useResumeStore } from '@/stores/modules/resume'
import { polishResumeProjectApi } from '@/api/modules/ai'
import type { ResumeInfo, ResumeProject, ResumeExperience } from '@/types/resume'

const resumeStore = useResumeStore()

const optimizingProjectId = ref<string>('')
const optimizationResult = ref<{
  optimized: ResumeProject
  suggestions: string[]
} | null>(null)
const showOptimizeDialog = ref(false)
const copiedOptimized = ref(false)

const rawText = ref('')
const uploading = ref(false)

const form = reactive<ResumeInfo>({
  name: '',
  targetRole: '',
  education: '',
  skills: [],
  projects: [],
  experiences: [],
  rawText: '',
})

const skillInput = ref('')
const activeProject = ref<string[]>([])
const projectDialogVisible = ref(false)
const editingProject = ref<ResumeProject | null>(null)
const projectForm = reactive({
  id: '',
  name: '',
  role: '',
  techStackStr: '',
  description: '',
  highlightsStr: '',
  difficulties: '',
  result: '',
})

const experienceDialogVisible = ref(false)
const editingExperience = ref<ResumeExperience | null>(null)
const experienceForm = reactive<ResumeExperience>({
  id: '',
  company: '',
  role: '',
  duration: '',
  description: '',
})

onMounted(() => {
  resumeStore.loadFromStorage()
  if (resumeStore.resumeInfo) {
    Object.assign(form, resumeStore.resumeInfo)
    rawText.value = resumeStore.resumeInfo.rawText || ''
  }
})

function handleFileUpload(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'txt' && ext !== 'md') {
    ElMessage.warning('仅支持 .txt 和 .md 格式文件')
    return
  }
  uploading.value = true
  const reader = new FileReader()
  reader.onload = (e) => {
    rawText.value = (e.target?.result as string) || ''
    uploading.value = false
    ElMessage.success('文件读取成功')
  }
  reader.onerror = () => {
    uploading.value = false
    ElMessage.error('文件读取失败')
  }
  reader.readAsText(file)
}

function handleMockParse() {
  if (!rawText.value.trim()) {
    ElMessage.warning('请先输入或上传简历文本')
    return
  }

  const text = rawText.value

  // Extract skills by keyword matching
  const skillKeywords = [
    'Vue', 'Vue3', 'React', 'Angular', 'TypeScript', 'JavaScript', 'Node.js',
    'Express', 'Python', 'Django', 'Java', 'Spring', 'Go', 'Rust',
    'HTML', 'CSS', 'SCSS', 'Tailwind', 'Webpack', 'Vite', 'Rollup',
    'Git', 'Docker', 'CI/CD', 'Nginx', 'Linux',
    'ECharts', 'D3', 'Three.js', 'Cesium', 'OpenLayers', 'WebGIS',
    'Mapbox', 'Leaflet', 'Canvas', 'WebGL', 'GIS',
    'Pinia', 'Vuex', 'Redux', 'Zustand',
    'RESTful', 'GraphQL', 'WebSocket', 'SSE',
    'Axios', 'Fetch', 'MySQL', 'MongoDB', 'Redis', 'PostgreSQL',
    'Element Plus', 'Ant Design', 'Naive UI',
    'Jest', 'Vitest', 'Cypress', 'Playwright',
  ]
  const foundSkills: string[] = []
  skillKeywords.forEach((kw) => {
    if (text.includes(kw)) {
      foundSkills.push(kw)
    }
  })
  form.skills = foundSkills

  // Try to extract name (simple heuristic: first line or "姓名" marker)
  const nameMatch = text.match(/姓名[：:]\s*(.+)/)
  if (nameMatch) {
    form.name = nameMatch[1].trim()
  } else {
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length > 0 && lines[0].length < 20) {
      form.name = lines[0].trim()
    }
  }

  // Try to extract target role
  const roleMatch = text.match(/(?:求职意向|期望岗位|目标岗位)[：:]\s*(.+)/)
  if (roleMatch) {
    form.targetRole = roleMatch[1].trim()
  }

  // Try to extract education
  const eduMatch = text.match(/(?:教育经历|学历|学校)[：:]\s*(.+)/)
  if (eduMatch) {
    form.education = eduMatch[1].trim()
  }

  // Try to extract projects by looking for "项目" patterns
  const projectSections = text.split(/(?:项目经历|项目经验|Projects)/i)
  if (projectSections.length > 1) {
    const projectText = projectSections[1]
    const projectNames = projectText.match(/(?:【|「|《)(.+?)(?:」|】|》)/g)
      || projectText.match(/(?:项目名称|项目名)[：:]\s*(.+)/g)

    if (projectNames) {
      const projects: ResumeProject[] = projectNames.slice(0, 3).map((name, i) => ({
        id: `mock-${Date.now()}-${i}`,
        name: name.replace(/[【「《】」》]/g, '').replace(/(?:项目名称|项目名)[：:]\s*/, '').trim(),
        role: '前端开发',
        techStack: foundSkills.slice(0, 5),
        description: '从简历解析的项目描述（待完善）',
        highlights: ['请在此添加技术亮点'],
        difficulties: '请在此添加项目难点',
        result: '请在此添加项目成果',
      }))
      form.projects = projects
    }
  }

  ElMessage.success(`模拟解析完成，识别到 ${foundSkills.length} 个技能关键词`)
}

function handleSave() {
  form.rawText = rawText.value
  resumeStore.setResume({ ...form })
  ElMessage.success('简历信息已保存')
}

function addSkill() {
  const val = skillInput.value.trim()
  if (val && !form.skills.includes(val)) {
    form.skills.push(val)
    skillInput.value = ''
  }
}

function removeSkill(skill: string) {
  form.skills = form.skills.filter((s) => s !== skill)
}

// Project CRUD
function resetProjectForm() {
  projectForm.id = ''
  projectForm.name = ''
  projectForm.role = ''
  projectForm.techStackStr = ''
  projectForm.description = ''
  projectForm.highlightsStr = ''
  projectForm.difficulties = ''
  projectForm.result = ''
}

function openAddProject() {
  editingProject.value = null
  resetProjectForm()
  projectDialogVisible.value = true
}

function openEditProject(project: ResumeProject) {
  editingProject.value = project
  projectForm.id = project.id
  projectForm.name = project.name
  projectForm.role = project.role
  projectForm.techStackStr = project.techStack.join(', ')
  projectForm.description = project.description
  projectForm.highlightsStr = project.highlights.join('\n')
  projectForm.difficulties = project.difficulties
  projectForm.result = project.result
  projectDialogVisible.value = true
}

function saveProject() {
  if (!projectForm.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  const projectData: ResumeProject = {
    id: editingProject.value?.id || `rp-${Date.now()}`,
    name: projectForm.name.trim(),
    role: projectForm.role.trim(),
    techStack: projectForm.techStackStr.split(',').map((s) => s.trim()).filter(Boolean),
    description: projectForm.description.trim(),
    highlights: projectForm.highlightsStr.split('\n').map((s) => s.trim()).filter(Boolean),
    difficulties: projectForm.difficulties.trim(),
    result: projectForm.result.trim(),
  }
  if (editingProject.value) {
    const index = form.projects.findIndex((p) => p.id === editingProject.value!.id)
    if (index !== -1) {
      form.projects[index] = projectData
    }
    ElMessage.success('项目已更新')
  } else {
    form.projects.push(projectData)
    ElMessage.success('项目已添加')
  }
  projectDialogVisible.value = false
}

function deleteProject(id: string) {
  ElMessageBox.confirm('确定删除该项目经历吗？', '确认删除', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    form.projects = form.projects.filter((p) => p.id !== id)
    ElMessage.success('项目已删除')
  }).catch(() => {})
}

async function handleOptimizeProject(project: ResumeProject) {
  optimizingProjectId.value = project.id
  try {
    const result = await polishResumeProjectApi(project)
    optimizationResult.value = result
    showOptimizeDialog.value = true
  } catch {
    ElMessage.error('优化失败，请重试')
  } finally {
    optimizingProjectId.value = ''
  }
}

function applyOptimizedProject() {
  if (!optimizationResult.value) return
  const opt = optimizationResult.value.optimized
  const index = form.projects.findIndex((p) => p.id === opt.id)
  if (index !== -1) {
    form.projects[index] = {
      ...form.projects[index],
      description: opt.description,
      highlights: opt.highlights,
      difficulties: opt.difficulties,
    }
    ElMessage.success('已将优化结果应用到简历')
  }
  showOptimizeDialog.value = false
}

function copyOptimized() {
  if (!optimizationResult.value) return
  const opt = optimizationResult.value.optimized
  const text = [
    `项目名称：${opt.name}`,
    `担任角色：${opt.role}`,
    `项目描述：${opt.description}`,
    `技术亮点：${opt.highlights.join('；')}`,
    `技术难点：${opt.difficulties}`,
    `项目成果：${opt.result}`,
  ].join('\n\n')
  navigator.clipboard.writeText(text).then(() => {
    copiedOptimized.value = true
    ElMessage.success('已复制优化结果')
    setTimeout(() => { copiedOptimized.value = false }, 2000)
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

// Experience CRUD
function resetExperienceForm() {
  experienceForm.id = ''
  experienceForm.company = ''
  experienceForm.role = ''
  experienceForm.duration = ''
  experienceForm.description = ''
}

function openAddExperience() {
  editingExperience.value = null
  resetExperienceForm()
  experienceDialogVisible.value = true
}

function openEditExperience(exp: ResumeExperience) {
  editingExperience.value = exp
  experienceForm.id = exp.id
  experienceForm.company = exp.company
  experienceForm.role = exp.role
  experienceForm.duration = exp.duration
  experienceForm.description = exp.description
  experienceDialogVisible.value = true
}

function saveExperience() {
  if (!experienceForm.company.trim()) {
    ElMessage.warning('请输入公司名称')
    return
  }
  if (editingExperience.value) {
    const index = form.experiences.findIndex((e) => e.id === editingExperience.value!.id)
    if (index !== -1) {
      form.experiences[index] = { ...experienceForm }
    }
    ElMessage.success('经历已更新')
  } else {
    form.experiences.push({ ...experienceForm, id: `exp-${Date.now()}` })
    ElMessage.success('经历已添加')
  }
  experienceDialogVisible.value = false
}

function deleteExperience(id: string) {
  ElMessageBox.confirm('确定删除该经历吗？', '确认删除', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    form.experiences = form.experiences.filter((e) => e.id !== id)
    ElMessage.success('经历已删除')
  }).catch(() => {})
}
</script>

<template>
  <div class="resume-page">
    <div class="page-toolbar">
      <h2>简历管理</h2>
      <div class="toolbar-actions">
        <el-button type="success" @click="handleSave" :icon="Check">保存简历信息</el-button>
      </div>
    </div>

    <el-row :gutter="20" class="resume-content">
      <!-- Left: Raw Text -->
      <el-col :span="10">
        <el-card shadow="never" class="raw-text-card">
          <template #header>
            <div class="card-header">
              <span>原始简历文本</span>
              <div class="header-actions">
                <el-upload
                  :auto-upload="false"
                  :show-file-list="false"
                  accept=".txt,.md"
                  :on-change="(file: any) => handleFileUpload(file.raw)"
                >
                  <el-button size="small" :loading="uploading" :icon="UploadFilled">
                    上传文件
                  </el-button>
                </el-upload>
                <el-button size="small" type="primary" @click="handleMockParse">
                  模拟解析
                </el-button>
              </div>
            </div>
          </template>
          <el-input
            v-model="rawText"
            type="textarea"
            :rows="24"
            placeholder="在此粘贴你的简历文本，或点击「上传文件」按钮上传 .txt / .md 文件。&#10;&#10;示例内容：&#10;姓名：张三&#10;求职意向：前端开发工程师&#10;技能：Vue3, TypeScript, ECharts, OpenLayers&#10;项目经历：&#10;- GIS 可视化平台&#10;- 数据大屏展示系统"
          />
        </el-card>
      </el-col>

      <!-- Right: Structured Form -->
      <el-col :span="14">
        <el-card shadow="never" class="form-card">
          <template #header>
            <span>结构化简历信息</span>
          </template>

          <el-form label-width="100px" label-position="left">
            <!-- Basic Info -->
            <el-divider content-position="left">基本信息</el-divider>
            <el-form-item label="姓名">
              <el-input v-model="form.name" placeholder="请输入姓名" />
            </el-form-item>
            <el-form-item label="求职方向">
              <el-input v-model="form.targetRole" placeholder="例如：前端开发工程师" />
            </el-form-item>
            <el-form-item label="教育经历">
              <el-input
                v-model="form.education"
                type="textarea"
                :rows="2"
                placeholder="例如：2020-2024 XX大学 计算机科学与技术 本科"
              />
            </el-form-item>

            <!-- Skills -->
            <el-divider content-position="left">技术栈</el-divider>
            <el-form-item>
              <div class="skills-area">
                <div class="skills-tags">
                  <el-tag
                    v-for="skill in form.skills"
                    :key="skill"
                    closable
                    class="skill-tag"
                    @close="removeSkill(skill)"
                  >
                    {{ skill }}
                  </el-tag>
                </div>
                <div class="skill-input-row">
                  <el-input
                    v-model="skillInput"
                    placeholder="输入技能名称后回车添加"
                    size="small"
                    style="width: 200px"
                    @keyup.enter="addSkill"
                  />
                  <el-button size="small" @click="addSkill">添加</el-button>
                </div>
              </div>
            </el-form-item>

            <!-- Projects -->
            <el-divider content-position="left">
              项目经历
              <el-button size="small" :icon="Plus" type="primary" text @click="openAddProject">
                新增项目
              </el-button>
            </el-divider>

            <div v-if="form.projects.length === 0" class="empty-hint">
              暂无项目经历，点击上方按钮添加
            </div>

            <el-collapse v-else v-model="activeProject">
              <el-collapse-item
                v-for="project in form.projects"
                :key="project.id"
                :name="project.id"
              >
                <template #title>
                  <div class="project-title">
                    <span>{{ project.name }}</span>
                    <span class="project-role-tag">{{ project.role }}</span>
                  </div>
                </template>
                <div class="project-detail">
                  <p><strong>担任角色：</strong>{{ project.role }}</p>
                  <p><strong>技术栈：</strong>
                    <el-tag
                      v-for="tech in project.techStack"
                      :key="tech"
                      size="small"
                      class="tech-tag"
                    >
                      {{ tech }}
                    </el-tag>
                  </p>
                  <p><strong>项目描述：</strong>{{ project.description }}</p>
                  <p><strong>技术难点：</strong>{{ project.difficulties }}</p>
                  <p><strong>项目成果：</strong>{{ project.result }}</p>
                  <div class="project-actions">
                    <el-button size="small" :icon="Edit" @click.stop="openEditProject(project)">
                      编辑
                    </el-button>
                    <el-button
                      size="small"
                      :icon="MagicStick"
                      type="warning"
                      :loading="optimizingProjectId === project.id"
                      @click.stop="handleOptimizeProject(project)"
                    >
                      优化描述
                    </el-button>
                    <el-button size="small" :icon="Delete" type="danger" @click.stop="deleteProject(project.id)">
                      删除
                    </el-button>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>

            <!-- Experiences -->
            <el-divider content-position="left" style="margin-top: 24px">
              实习/工作经历
              <el-button size="small" :icon="Plus" type="primary" text @click="openAddExperience">
                新增经历
              </el-button>
            </el-divider>

            <div v-if="form.experiences.length === 0" class="empty-hint">
              暂无工作经历，点击上方按钮添加
            </div>

            <template v-else>
              <div
                v-for="exp in form.experiences"
                :key="exp.id"
                class="experience-item"
              >
                <div class="experience-header">
                  <span class="exp-company">{{ exp.company }}</span>
                  <span class="exp-role">{{ exp.role }}</span>
                  <span class="exp-duration">{{ exp.duration }}</span>
                  <div class="exp-actions">
                    <el-button size="small" :icon="Edit" text @click="openEditExperience(exp)" />
                    <el-button size="small" :icon="Delete" text type="danger" @click="deleteExperience(exp.id)" />
                  </div>
                </div>
                <p class="exp-desc">{{ exp.description }}</p>
              </div>
            </template>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <!-- Project Dialog -->
    <el-dialog
      v-model="projectDialogVisible"
      :title="editingProject ? '编辑项目' : '新增项目'"
      width="600px"
      destroy-on-close
    >
      <el-form label-width="80px">
        <el-form-item label="项目名称" required>
          <el-input v-model="projectForm.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="担任角色">
          <el-input v-model="projectForm.role" placeholder="例如：前端负责人" />
        </el-form-item>
        <el-form-item label="技术栈">
          <el-input
            v-model="projectForm.techStackStr"
            placeholder="用逗号分隔，例如：Vue3, TypeScript, ECharts"
          />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input v-model="projectForm.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="技术亮点">
          <el-input
            v-model="projectForm.highlightsStr"
            type="textarea"
            :rows="2"
            placeholder="每行一个亮点"
          />
        </el-form-item>
        <el-form-item label="技术难点">
          <el-input v-model="projectForm.difficulties" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="项目成果">
          <el-input v-model="projectForm.result" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="projectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProject">保存</el-button>
      </template>
    </el-dialog>

    <!-- Experience Dialog -->
    <el-dialog
      v-model="experienceDialogVisible"
      :title="editingExperience ? '编辑经历' : '新增经历'"
      width="500px"
      destroy-on-close
    >
      <el-form label-width="80px">
        <el-form-item label="公司名称" required>
          <el-input v-model="experienceForm.company" placeholder="请输入公司名称" />
        </el-form-item>
        <el-form-item label="岗位">
          <el-input v-model="experienceForm.role" placeholder="例如：前端开发实习生" />
        </el-form-item>
        <el-form-item label="时间">
          <el-input v-model="experienceForm.duration" placeholder="例如：2023.06 - 2023.12" />
        </el-form-item>
        <el-form-item label="工作描述">
          <el-input v-model="experienceForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="experienceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveExperience">保存</el-button>
      </template>
    </el-dialog>

    <!-- Project Optimize Dialog -->
    <el-dialog
      v-model="showOptimizeDialog"
      title="项目描述优化"
      width="750px"
      destroy-on-close
    >
      <template v-if="optimizationResult">
        <el-row :gutter="16">
          <el-col :span="12">
            <div class="compare-panel">
              <div class="compare-panel-title before">优化前</div>
              <div class="compare-field">
                <div class="field-label">项目描述</div>
                <p>{{ optimizationResult.optimized.name }} - {{ optimizationResult.optimized.description }}</p>
              </div>
              <div class="compare-field">
                <div class="field-label">技术亮点</div>
                <ul>
                  <li v-for="h in (optimizationResult.optimized.highlights || [])" :key="h">{{ h }}</li>
                </ul>
              </div>
              <div class="compare-field">
                <div class="field-label">技术难点</div>
                <p>{{ optimizationResult.optimized.difficulties || '（无）' }}</p>
              </div>
            </div>
          </el-col>
          <el-col :span="12">
            <div class="compare-panel">
              <div class="compare-panel-title after">优化后</div>
              <div class="compare-field">
                <div class="field-label">项目描述</div>
                <p>{{ optimizationResult.optimized.description }}</p>
              </div>
              <div class="compare-field">
                <div class="field-label">技术亮点</div>
                <ul>
                  <li v-for="h in optimizationResult.optimized.highlights" :key="h">{{ h }}</li>
                </ul>
              </div>
              <div class="compare-field">
                <div class="field-label">技术难点</div>
                <p>{{ optimizationResult.optimized.difficulties }}</p>
              </div>
            </div>
          </el-col>
        </el-row>

        <div v-if="optimizationResult.suggestions.length" class="optimize-suggestions">
          <div class="suggestions-title">优化建议：</div>
          <ul>
            <li v-for="s in optimizationResult.suggestions" :key="s">{{ s }}</li>
          </ul>
        </div>
      </template>

      <template #footer>
        <el-button @click="showOptimizeDialog = false">取消</el-button>
        <el-button @click="copyOptimized" :type="copiedOptimized ? 'success' : 'default'">
          {{ copiedOptimized ? '已复制' : '复制优化结果' }}
        </el-button>
        <el-button type="primary" @click="applyOptimizedProject">
          一键替换到简历
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.resume-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-toolbar h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.resume-content {
  flex: 1;
  min-height: 0;
}

.raw-text-card,
.form-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.skills-area {
  width: 100%;
}

.skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.skill-tag {
  margin: 0;
}

.skill-input-row {
  display: flex;
  gap: 8px;
}

.empty-hint {
  text-align: center;
  color: #909399;
  padding: 24px 0;
  font-size: 14px;
}

.project-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.project-role-tag {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

.project-detail p {
  margin: 8px 0;
  line-height: 1.8;
}

.tech-tag {
  margin-right: 4px;
}

.project-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.experience-item {
  padding: 12px;
  margin-bottom: 8px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}

.experience-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.exp-company {
  font-weight: 600;
  color: #303133;
}

.exp-role {
  color: #606266;
}

.exp-duration {
  color: #909399;
  font-size: 13px;
}

.exp-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.exp-desc {
  color: #606266;
  font-size: 14px;
  margin: 0;
}

/* Optimize Dialog */
.compare-panel {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  background: #fafafa;
  min-height: 200px;
}

.compare-panel-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  padding: 2px 10px;
  border-radius: 4px;
  display: inline-block;
}

.compare-panel-title.before {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
}

.compare-panel-title.after {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}

.compare-field {
  margin-bottom: 12px;
}

.compare-field .field-label {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.compare-field p {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
}

.compare-field ul {
  margin: 0;
  padding-left: 16px;
}

.compare-field li {
  font-size: 13px;
  color: #606266;
  line-height: 1.7;
}

.optimize-suggestions {
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
  font-size: 13px;
}

.optimize-suggestions ul {
  margin: 0;
  padding-left: 18px;
}

.optimize-suggestions li {
  color: #606266;
  line-height: 1.8;
  font-size: 13px;
}
</style>
