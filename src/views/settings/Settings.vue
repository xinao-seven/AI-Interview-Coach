<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useResumeStore } from '@/stores/modules/resume'
import { useInterviewStore } from '@/stores/modules/interview'
import { useReportStore } from '@/stores/modules/report'
import { useMistakeStore } from '@/stores/modules/mistake'

const aiMode = import.meta.env.VITE_AI_MODE === 'real' ? '真实 API 模式' : 'Mock 模拟模式'

const resumeStore = useResumeStore()
const interviewStore = useInterviewStore()
const reportStore = useReportStore()
const mistakeStore = useMistakeStore()

function clearAllData() {
  ElMessageBox.confirm(
    '确定要清空所有本地数据吗？包括简历、面试记录、错题本等。此操作不可恢复。',
    '确认清空',
    { confirmButtonText: '确定清空', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    resumeStore.clearResume()
    interviewStore.resetSession()
    reportStore.clearReport()
    mistakeStore.clearAll()
    localStorage.removeItem('interview-history')
    ElMessage.success('所有数据已清空')
  }).catch(() => {})
}
</script>

<template>
  <div class="settings-page">
    <h2>设置</h2>

    <el-card shadow="never" class="section-card">
      <template #header><span>数据管理</span></template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="技术栈">
          Vue3 + TypeScript + Vite + Pinia + Vue Router + Element Plus + ECharts + Axios
        </el-descriptions-item>
        <el-descriptions-item label="AI 模式">
          {{ aiMode }}
        </el-descriptions-item>
        <el-descriptions-item label="数据存储">
          所有数据存储在浏览器 localStorage 中
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <div class="danger-zone">
        <div class="danger-text">
          <strong>危险操作</strong>
          <p>清空所有本地存储的简历、面试记录和错题本数据</p>
        </div>
        <el-button type="danger" @click="clearAllData">清空所有数据</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
  margin: 0 auto;
}

.settings-page h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}

.section-card {
  margin-bottom: 16px;
}

.danger-zone {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 8px;
}

.danger-text strong {
  color: #f56c6c;
}

.danger-text p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}
</style>
