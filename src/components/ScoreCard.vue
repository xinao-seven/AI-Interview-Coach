<script setup lang="ts">
import type { AnswerEvaluation } from '@/types/interview'

const props = defineProps<{
  evaluation: AnswerEvaluation
  showTitle?: boolean
}>()

function scoreColor(score: number): string {
  if (score >= 85) return '#67c23a'
  if (score >= 70) return '#409eff'
  if (score >= 50) return '#e6a23c'
  return '#f56c6c'
}

function scoreLabel(score: number): string {
  if (score >= 85) return '优秀'
  if (score >= 70) return '良好'
  if (score >= 50) return '一般'
  return '需加强'
}
</script>

<template>
  <div class="score-card">
    <div v-if="showTitle" class="score-title">回答评分</div>

    <div class="score-main">
      <div class="score-circle" :style="{ borderColor: scoreColor(evaluation.totalScore) }">
        <span class="score-num" :style="{ color: scoreColor(evaluation.totalScore) }">
          {{ evaluation.totalScore }}
        </span>
        <span class="score-text">分</span>
      </div>
      <el-tag
        size="small"
        :color="scoreColor(evaluation.totalScore)"
        effect="dark"
        style="border: none; color: #fff"
      >
        {{ scoreLabel(evaluation.totalScore) }}
      </el-tag>
    </div>

    <div class="score-details">
      <div class="detail-item">
        <span class="detail-label">准确性</span>
        <el-progress
          :percentage="evaluation.accuracy"
          :stroke-width="6"
          :color="scoreColor(evaluation.accuracy)"
        />
      </div>
      <div class="detail-item">
        <span class="detail-label">完整性</span>
        <el-progress
          :percentage="evaluation.completeness"
          :stroke-width="6"
          :color="scoreColor(evaluation.completeness)"
        />
      </div>
      <div class="detail-item">
        <span class="detail-label">表达能力</span>
        <el-progress
          :percentage="evaluation.expression"
          :stroke-width="6"
          :color="scoreColor(evaluation.expression)"
        />
      </div>
      <div class="detail-item">
        <span class="detail-label">项目结合</span>
        <el-progress
          :percentage="evaluation.projectRelevance"
          :stroke-width="6"
          :color="scoreColor(evaluation.projectRelevance)"
        />
      </div>
      <div class="detail-item">
        <span class="detail-label">回答深度</span>
        <el-progress
          :percentage="evaluation.depth"
          :stroke-width="6"
          :color="scoreColor(evaluation.depth)"
        />
      </div>
    </div>

    <div v-if="evaluation.strengths.length" class="score-section">
      <div class="section-label">优点</div>
      <ul>
        <li v-for="s in evaluation.strengths" :key="s">{{ s }}</li>
      </ul>
    </div>

    <div v-if="evaluation.weaknesses.length" class="score-section">
      <div class="section-label">不足</div>
      <ul>
        <li v-for="w in evaluation.weaknesses" :key="w">{{ w }}</li>
      </ul>
    </div>

    <div v-if="evaluation.improvedAnswer" class="score-section">
      <div class="section-label">优化建议</div>
      <p class="improved-text">{{ evaluation.improvedAnswer }}</p>
    </div>
  </div>
</template>

<style scoped>
.score-card {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.score-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #303133;
}

.score-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  justify-content: center;
}

.score-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 4px solid #409eff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.score-num {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.score-text {
  font-size: 12px;
  color: #909399;
}

.score-details {
  margin-bottom: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.detail-label {
  width: 60px;
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
  text-align: right;
}

.detail-item .el-progress {
  flex: 1;
}

.score-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.score-section ul {
  margin: 0;
  padding-left: 18px;
}

.score-section li {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.improved-text {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
