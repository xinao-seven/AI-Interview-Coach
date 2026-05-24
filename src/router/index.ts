import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: () => import('@/layout/MainLayout.vue'),
        redirect: '/dashboard',
        children: [
            {
                path: 'dashboard',
                name: 'Dashboard',
                component: () => import('@/views/dashboard/Dashboard.vue'),
                meta: { title: '首页' },
            },
            {
                path: 'resume',
                name: 'Resume',
                component: () => import('@/views/resume/Resume.vue'),
                meta: { title: '简历管理' },
            },
            {
                path: 'interview-config',
                name: 'InterviewConfig',
                component: () => import('@/views/interview-config/InterviewConfig.vue'),
                meta: { title: '面试配置' },
            },
            {
                path: 'mock-interview',
                name: 'MockInterview',
                component: () => import('@/views/mock-interview/MockInterview.vue'),
                meta: { title: '模拟面试' },
            },
            {
                path: 'project-coach',
                name: 'ProjectCoach',
                component: () => import('@/views/project-coach/ProjectCoach.vue'),
                meta: { title: '项目深挖' },
            },
            {
                path: 'knowledge-training',
                name: 'KnowledgeTraining',
                component: () => import('@/views/knowledge-training/KnowledgeTraining.vue'),
                meta: { title: '知识点训练' },
            },
            {
                path: 'interview-report',
                name: 'InterviewReport',
                component: () => import('@/views/interview-report/InterviewReport.vue'),
                meta: { title: '面试报告' },
            },
            {
                path: 'mistake-book',
                name: 'MistakeBook',
                component: () => import('@/views/mistake-book/MistakeBook.vue'),
                meta: { title: '错题本' },
            },
            {
                path: 'settings',
                name: 'Settings',
                component: () => import('@/views/settings/Settings.vue'),
                meta: { title: '设置' },
            },
            {
                path: 'interview-history',
                name: 'InterviewHistory',
                component: () => import('@/views/interview-history/InterviewHistory.vue'),
                meta: { title: '面试历史' },
            },
        ],
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
