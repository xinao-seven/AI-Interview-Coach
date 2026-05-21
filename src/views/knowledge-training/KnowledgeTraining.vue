<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useMistakeStore } from '@/stores/modules/mistake'
import { evaluateAnswerApi } from '@/api/modules/ai'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { categories, questionBank, type BankQuestion } from '@/data/questionBank'

const mistakeStore = useMistakeStore()

const activeCategory = ref<string>('all')
const searchKeyword = ref('')
const selectedQuestion = ref<BankQuestion | null>(null)
const answerText = ref('')
const evaluating = ref(false)
const evaluationResult = ref<string>('')
const showReference = ref(false)
const showEvalResult = ref(false)

const filteredQuestions = computed(() => {
  let questions = questionBank
  if (activeCategory.value !== 'all') {
    questions = questions.filter((q) => q.category === activeCategory.value)
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    questions = questions.filter(
      (q) =>
        q.question.toLowerCase().includes(kw) ||
        q.tags.some((t) => t.toLowerCase().includes(kw))
    )
  }
  return questions
})

const categoryCounts = computed(() => {
  const counts: Record<string, number> = { all: questionBank.length }
  categories.forEach((c) => {
    counts[c.id] = questionBank.filter((q) => q.category === c.id).length
  })
  return counts
})

const difficultyColor = (d: string) => {
  if (d === 'easy') return 'success'
  if (d === 'hard') return 'danger'
  return 'warning'
}

const difficultyLabel = (d: string) => {
  if (d === 'easy') return '简单'
  if (d === 'hard') return '困难'
  return '中等'
}

function selectQuestion(q: BankQuestion) {
  selectedQuestion.value = q
  answerText.value = ''
  evaluationResult.value = ''
  showReference.value = false
  showEvalResult.value = false
}

function handleCategoryChange(catId: string) {
  activeCategory.value = catId
  selectedQuestion.value = null
  answerText.value = ''
}

async function handleSubmit() {
  if (!answerText.value.trim() || !selectedQuestion.value) {
    ElMessage.warning('请输入你的回答')
    return
  }

  evaluating.value = true
  showEvalResult.value = true

  try {
    const evaluation = await evaluateAnswerApi(
      {
        id: selectedQuestion.value.id,
        question: selectedQuestion.value.question,
        type: 'baguwen',
        tags: selectedQuestion.value.tags,
        difficulty: selectedQuestion.value.difficulty,
        source: selectedQuestion.value.category,
        referenceAnswer: selectedQuestion.value.referenceAnswer,
      },
      answerText.value,
      null
    )

    evaluationResult.value = `## 📊 AI 评分结果

| 维度 | 得分 |
|------|------|
| 总分 | **${evaluation.totalScore}** |
| 准确性 | ${evaluation.accuracy} |
| 完整性 | ${evaluation.completeness} |
| 表达能力 | ${evaluation.expression} |
| 深度 | ${evaluation.depth} |

**✅ 优点：**
${evaluation.strengths.map((s) => `- ${s}`).join('\n')}

**⚠️ 不足：**
${evaluation.weaknesses.map((w) => `- ${w}`).join('\n')}

**📝 建议：**
${evaluation.improvedAnswer}
`
  } catch {
    ElMessage.error('评分失败，请重试')
    showEvalResult.value = false
  } finally {
    evaluating.value = false
  }
}

function addToMistakeBook() {
  if (!selectedQuestion.value) return

  mistakeStore.loadFromStorage()
  mistakeStore.addMistake({
    question: {
      id: selectedQuestion.value.id,
      question: selectedQuestion.value.question,
      type: 'baguwen',
      tags: selectedQuestion.value.tags,
      difficulty: selectedQuestion.value.difficulty,
      source: selectedQuestion.value.category,
      referenceAnswer: selectedQuestion.value.referenceAnswer,
    },
    userAnswer: answerText.value || '（未作答）',
    evaluation: null,
    addedAt: new Date().toISOString(),
    tags: selectedQuestion.value.tags,
  })
  ElMessage.success('已添加到错题本')
}
</script>

<template>
  <div class="knowledge-page">
    <div class="page-header">
      <h2>知识点训练</h2>
      <el-input
        v-model="searchKeyword"
        placeholder="搜索题目或标签..."
        clearable
        style="width: 280px"
        :prefix-icon="'Search' as any"
      />
    </div>

    <div class="knowledge-layout">
      <!-- Left: Categories + Question List -->
      <div class="knowledge-left">
        <!-- Categories -->
        <div class="category-tabs">
          <div
            class="category-tab"
            :class="{ active: activeCategory === 'all' }"
            @click="handleCategoryChange('all')"
          >
            <span class="cat-icon">📚</span>
            <span>全部</span>
            <span class="cat-count">{{ categoryCounts.all }}</span>
          </div>
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="category-tab"
            :class="{ active: activeCategory === cat.id }"
            @click="handleCategoryChange(cat.id)"
          >
            <span class="cat-icon">{{ cat.icon }}</span>
            <span>{{ cat.name }}</span>
            <span class="cat-count">{{ categoryCounts[cat.id] || 0 }}</span>
          </div>
        </div>

        <!-- Question List -->
        <div class="question-list">
          <div v-if="filteredQuestions.length === 0" class="empty-hint">
            该分类下暂无题目
          </div>
          <div
            v-for="q in filteredQuestions"
            :key="q.id"
            class="q-item"
            :class="{ active: selectedQuestion?.id === q.id }"
            @click="selectQuestion(q)"
          >
            <div class="q-item-header">
              <el-tag
                size="small"
                :type="difficultyColor(q.difficulty)"
              >
                {{ difficultyLabel(q.difficulty) }}
              </el-tag>
              <div class="q-item-tags">
                <el-tag
                  v-for="t in q.tags.slice(0, 2)"
                  :key="t"
                  size="small"
                  class="mini-tag"
                >
                  {{ t }}
                </el-tag>
              </div>
            </div>
            <p class="q-item-text">{{ q.question }}</p>
          </div>
        </div>
      </div>

      <!-- Right: Question Detail -->
      <div class="knowledge-right">
        <template v-if="selectedQuestion">
          <el-card shadow="never" class="detail-card">
            <template #header>
              <div class="detail-header">
                <span>题目详情</span>
                <el-button size="small" text type="warning" @click="addToMistakeBook">
                  加入错题本
                </el-button>
              </div>
            </template>

            <!-- Question -->
            <div class="detail-question">
              <div class="detail-meta">
                <el-tag
                  size="small"
                  :type="difficultyColor(selectedQuestion.difficulty)"
                >
                  {{ difficultyLabel(selectedQuestion.difficulty) }}
                </el-tag>
                <el-tag
                  v-for="t in selectedQuestion.tags"
                  :key="t"
                  size="small"
                >
                  {{ t }}
                </el-tag>
              </div>
              <p class="question-text">{{ selectedQuestion.question }}</p>
            </div>

            <!-- Answer Input -->
            <div class="answer-section">
              <div class="section-label">你的回答</div>
              <el-input
                v-model="answerText"
                type="textarea"
                :rows="6"
                placeholder="在此输入你的回答..."
                :disabled="evaluating"
              />
              <div class="answer-actions">
                <el-button
                  type="primary"
                  :loading="evaluating"
                  :disabled="!answerText.trim()"
                  @click="handleSubmit"
                >
                  {{ evaluating ? 'AI 评分中...' : '提交回答并评分' }}
                </el-button>
                <el-button
                  text
                  type="info"
                  @click="showReference = !showReference"
                >
                  {{ showReference ? '隐藏参考答案' : '查看参考答案' }}
                </el-button>
              </div>
            </div>

            <!-- Reference Answer -->
            <div v-if="showReference" class="reference-section">
              <div class="section-label">参考答案</div>
              <div class="reference-content">
                <MarkdownRenderer :content="selectedQuestion.referenceAnswer" variant="report" />
              </div>
            </div>

            <!-- Evaluation Result -->
            <div v-if="showEvalResult && evaluationResult" class="eval-section">
              <el-divider />
              <div class="section-label">AI 评分结果</div>
              <div class="eval-content">
                <MarkdownRenderer :content="evaluationResult" variant="report" />
              </div>
            </div>
          </el-card>
        </template>

        <template v-else>
          <el-empty description="请从左侧选择一个题目开始练习" :image-size="80" />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.knowledge-layout {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

/* Left Panel */
.knowledge-left {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  background: #f5f7fa;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.category-tab:hover {
  border-color: #c6e2ff;
  background: #ecf5ff;
}

.category-tab.active {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}

.cat-icon {
  font-size: 14px;
}

.cat-count {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.1);
  padding: 0 5px;
  border-radius: 8px;
}

.category-tab.active .cat-count {
  background: rgba(255, 255, 255, 0.25);
}

/* Question List */
.question-list {
  flex: 1;
  overflow-y: auto;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.empty-hint {
  text-align: center;
  color: #909399;
  padding: 24px 0;
  font-size: 14px;
}

.q-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
}

.q-item:hover {
  background: #f5f7fa;
}

.q-item.active {
  background: #ecf5ff;
  border-left: 3px solid #409eff;
}

.q-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.q-item-tags {
  display: flex;
  gap: 4px;
}

.mini-tag {
  font-size: 11px !important;
}

.q-item-text {
  margin: 0;
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Right Panel */
.knowledge-right {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.detail-card {
  min-height: 100%;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.detail-question {
  margin-bottom: 20px;
}

.detail-meta {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.question-text {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  line-height: 1.6;
  margin: 0;
}

.answer-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.answer-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 10px;
}

.reference-section,
.eval-section {
  margin-top: 16px;
}

.reference-content,
.eval-content {
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}
</style>
