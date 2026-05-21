<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  HomeFilled,
  Document,
  Setting,
  Edit,
  ChatDotRound,
  Notebook,
  DataAnalysis,
  Collection,
  Tools,
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const isCollapsed = ref(false)

const menuItems = [
  { path: '/dashboard', title: '首页', icon: HomeFilled },
  { path: '/resume', title: '简历管理', icon: Document },
  { path: '/interview-config', title: '面试配置', icon: Setting },
  { path: '/mock-interview', title: '模拟面试', icon: ChatDotRound },
  { path: '/project-coach', title: '项目深挖', icon: Notebook },
  { path: '/knowledge-training', title: '知识点训练', icon: Edit },
  { path: '/interview-report', title: '面试报告', icon: DataAnalysis },
  { path: '/mistake-book', title: '错题本', icon: Collection },
  { path: '/settings', title: '设置', icon: Tools },
]

const activeMenu = computed(() => {
  return route.path
})

function handleMenuSelect(path: string) {
  router.push(path)
}
</script>

<template>
  <el-container class="main-container">
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="app-aside">
      <div class="logo-area">
        <span v-if="!isCollapsed" class="logo-text">AI 面试教练</span>
        <span v-else class="logo-text--short">AI</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        :collapse-transition="false"
        background-color="#001529"
        text-color="#ffffffa6"
        active-text-color="#fff"
        @select="handleMenuSelect"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="app-main">
      <el-header class="app-header">
        <div class="header-left">
          <el-icon
            class="collapse-btn"
            :size="20"
            @click="isCollapsed = !isCollapsed"
          >
            <component :is="isCollapsed ? 'Expand' : 'Fold'" />
          </el-icon>
          <span class="header-title">{{ route.meta.title || 'AI 面试教练' }}</span>
        </div>
        <div class="header-right">
          <span class="header-subtitle">AI 驱动的面试训练平台</span>
        </div>
      </el-header>
      <el-main class="app-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.main-container {
  height: 100vh;
}

.app-aside {
  background-color: #001529;
  overflow: hidden;
  transition: width 0.3s ease;
}

.logo-area {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.logo-text--short {
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.app-header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e4e7ed;
  height: 64px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  cursor: pointer;
  color: #606266;
}

.collapse-btn:hover {
  color: #409eff;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.header-subtitle {
  font-size: 13px;
  color: #909399;
}

.app-content {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}
</style>
