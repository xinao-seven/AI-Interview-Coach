<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  HomeFilled, Document, Setting, Edit, ChatDotRound,
  Notebook, DataAnalysis, Collection, Tools,
  Fold, Expand, Clock,
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
  { path: '/interview-history', title: '面试历史', icon: Clock },
]

const activeMenu = computed(() => route.path)

function handleMenuSelect(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="app-shell">
    <aside class="app-sidebar" :class="{ collapsed: isCollapsed }">
      <div class="sidebar-brand">
        <span class="brand-icon">🤖</span>
        <transition name="fade">
          <span v-if="!isCollapsed" class="brand-text">AI 面试教练</span>
        </transition>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        :collapse-transition="false"
        background-color="transparent"
        text-color="rgba(255,255,255,0.65)"
        active-text-color="#fff"
        class="sidebar-menu"
        @select="handleMenuSelect"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <el-tooltip :content="isCollapsed ? '展开菜单' : '收起菜单'" placement="right">
          <div class="collapse-toggle" @click="isCollapsed = !isCollapsed">
            <el-icon :size="18">
              <Fold v-if="!isCollapsed" />
              <Expand v-else />
            </el-icon>
          </div>
        </el-tooltip>
      </div>
    </aside>

    <div class="app-body">
      <header class="app-topbar">
        <div class="topbar-left">
          <el-breadcrumb separator=">">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title && route.path !== '/dashboard'">
              {{ route.meta.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="topbar-right">
          <span class="topbar-tagline">AI 驱动的面试训练平台</span>
        </div>
      </header>

      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */
.app-sidebar {
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #001529 0%, #002140 100%);
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  overflow: hidden;
}

.app-sidebar.collapsed {
  width: var(--sidebar-collapsed);
}

.sidebar-brand {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.brand-text {
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
}

.sidebar-menu .el-menu-item {
  margin: 2px 8px;
  border-radius: 8px;
  height: 44px;
  line-height: 44px;
  transition: all 0.2s;
}

.sidebar-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.45);
  transition: all 0.2s;
}

.collapse-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}

/* Body */
.app-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-topbar {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  z-index: 10;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
}

.topbar-right {
  display: flex;
  align-items: center;
}

.topbar-tagline {
  font-size: 13px;
  color: #909399;
}

.app-main {
  flex: 1;
  padding: var(--page-padding);
  overflow-y: auto;
  background: var(--app-bg);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
