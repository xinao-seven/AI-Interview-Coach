<script setup lang="ts">
import { ref } from 'vue'
import type { QuestionReview } from '@/types/report'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ScoreCard from './ScoreCard.vue'
import type { AnswerEvaluation } from '@/types/interview'

const props = defineProps<{
  reviews: QuestionReview[]
}>()

const activeIds = ref<string[]>([])

function toEvaluation(review: QuestionReview): AnswerEvaluation {
  return {
    questionId: review.questionId,
    totalScore: review.score,
    accuracy: 0,
    completeness: 0,
    expression: 0,
    projectRelevance: 0,
    depth: 0,
    strengths: [],
    weaknesses: [],
    improvedAnswer: review.suggestion,
    followUpQuestion: '',
  }
}
</script>

<template>
  <div class="review-list">
    <div v-if="reviews.length === 0" class="empty-hint">
      暂无题目回顾数据
    </div>

    <el-collapse v-else v-model="activeIds">
      <el-collapse-item
        v-for="(review, index) in reviews"
        :key="review.questionId"
        :name="review.questionId"
      >
        <template #title>
          <div class="review-title">
            <span class="review-index">第{{ index + 1 }}题</span>
            <el-tag
              size="small"
              :type="review.score >= 70 ? 'success' : review.score >= 50 ? 'warning' : 'danger'"
            >
              {{ review.score }} 分
            </el-tag>
            <span class="review-question">{{ review.question.replace(/^\d+\.\s*/, '') }}</span>
          </div>
        </template>

        <div class="review-content">
          <div class="review-section">
            <div class="review-label">问题</div>
            <div class="review-text">{{ review.question }}</div>
          </div>

          <div class="review-section">
            <div class="review-label">你的回答</div>
            <div class="review-text user-answer">{{ review.userAnswer }}</div>
          </div>

          <div class="review-section">
            <div class="review-label">参考答案</div>
            <div class="review-text">
              <MarkdownRenderer :content="review.referenceAnswer" variant="report" />
            </div>
          </div>

          <div v-if="review.suggestion" class="review-section">
            <div class="review-label">AI 建议</div>
            <div class="review-text suggestion">
              <MarkdownRenderer :content="review.suggestion" variant="report" />
            </div>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.review-list {
  width: 100%;
}

.empty-hint {
  text-align: center;
  color: #909399;
  padding: 24px 0;
}

.review-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.review-index {
  font-weight: 600;
  color: #303133;
}

.review-question {
  color: #606266;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-content {
  padding: 8px 0;
}

.review-section {
  margin-bottom: 14px;
}

.review-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.review-text {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  white-space: pre-wrap;
}

.review-text.user-answer {
  background: #ecf5ff;
  border-left: 3px solid #409eff;
}

.review-text.suggestion {
  background: #fdf6ec;
  border-left: 3px solid #e6a23c;
}
</style>
