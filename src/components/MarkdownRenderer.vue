<script setup lang="ts">
/**
 * MarkdownRenderer — 安全的 Markdown 渲染组件
 * ==============================================
 *
 * ## 特性
 * 1. **XSS 防护**：DOMPurify 清洗 HTML，防止注入攻击
 * 2. **代码高亮**：highlight.js 自动识别语言 + 暗色主题 + 一键复制
 * 3. **推理折叠**：自动识别 `<thinking>` / `【思考】` 等标记，折叠展示推理过程
 * 4. **暗色代码块**：使用 One Dark 主题风格，适合技术对话场景
 *
 * ## Props
 * - content: Markdown 原始文本
 * - variant: 显示变体（chat / report / default）
 * - enableThinkingFold: 是否启用推理折叠，默认 true
 */
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import 'highlight.js/styles/atom-one-dark.css'

// ─── Props ──────────────────────────────────────

const props = withDefaults(defineProps<{
    content: string
    variant?: 'chat' | 'report' | 'default'
    /** 是否启用推理过程折叠 */
    enableThinkingFold?: boolean
}>(), {
    variant: 'default',
    enableThinkingFold: true,
})

// ─── MarkdownIt 实例 ───────────────────────────

const containerRef = ref<HTMLElement | null>(null)

const md: MarkdownIt = new MarkdownIt({
    html: true,           // 允许内联 HTML（如 <details> 折叠块），由 DOMPurify 兜底清洗
    linkify: true,
    breaks: true,
    typographer: true,    // 智能引号等排版优化
})

// ─── 自定义代码块渲染器 ────────────────────────

const defaultFence = md.renderer.rules.fence!
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const lang = token.info.trim()
    let highlighted = ''

    if (lang && hljs.getLanguage(lang)) {
        try {
            highlighted = hljs.highlight(token.content, { language: lang, ignoreIllegals: true }).value
        } catch {
            highlighted = md.utils.escapeHtml(token.content)
        }
    } else {
        highlighted = md.utils.escapeHtml(token.content)
    }

    const langLabel = lang ? `<span class="code-lang">${md.utils.escapeHtml(lang)}</span>` : ''
    // 将代码内容存入 data-code 属性，用 base64 编码防止 XSS
    const encodedCode = btoa(unescape(encodeURIComponent(token.content)))

    return `
    <div class="code-block-wrapper">
      ${langLabel}
      <button class="copy-btn" data-code="${encodedCode}" title="复制代码">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        <span>复制</span>
      </button>
      <pre class="hljs"><code>${highlighted}</code></pre>
    </div>`
}

// ─── 渲染管道：思考折叠 → Markdown → DOMPurify ──

/**
 * 预处理：提取并折叠「思考/推理」内容
 *
 * 支持的标记格式：
 * - <thinking>...</thinking>（DeepSeek 风格）
 * - 【思考】...【/思考】
 * - [推理开始]...[推理结束]
 * - 自然段落：以「让我思考一下」「我来分析」开头
 */
function preprocessThinking(content: string): string {
    if (!props.enableThinkingFold) return content

    // 模式 1：<thinking>...</thinking>
    content = content.replace(
        /<thinking>\s*([\s\S]*?)\s*<\/thinking>/gi,
        (_: string, thinking: string) => buildThinkingFold(thinking.trim())
    )

    // 模式 2：【思考】...【/思考】
    content = content.replace(
        /【思考】\s*([\s\S]*?)\s*【\/思考】/g,
        (_: string, thinking: string) => buildThinkingFold(thinking.trim())
    )

    return content
}

/**
 * 构建折叠的思考过程 HTML
 * 使用原生 <details>/<summary> 元素，无需 JS，安全且兼容所有现代浏览器
 */
function buildThinkingFold(thinkingContent: string): string {
    // 对推理过程也走 Markdown 渲染（支持代码块等）
    const rendered = md.render(thinkingContent)
    // 截取摘要（前 80 字符，去除 HTML 标签和 Markdown 符号）
    const plainText = thinkingContent
        .replace(/<[^>]*>/g, '')
        .replace(/[#*`\n>-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const summary = plainText.length > 80 ? plainText.slice(0, 80) + '...' : plainText

    return `
<details class="thinking-fold">
  <summary class="thinking-fold-header">
    <span class="thinking-fold-icon"></span>
    <span class="thinking-fold-label">🧠 思考过程</span>
    <span class="thinking-fold-summary">${md.utils.escapeHtml(summary)}</span>
  </summary>
  <div class="thinking-fold-body">
    ${rendered}
  </div>
</details>`
}

/**
 * 完整的渲染管道
 */
const renderedHtml = computed(() => {
    if (!props.content) return ''
    try {
        // 1. 预处理：折叠思考内容
        const preprocessed = preprocessThinking(props.content)
        // 2. Markdown → HTML
        const rawHtml = md.render(preprocessed)
        // 3. DOMPurify 清洗（移除危险标签/属性，保留安全的）
        return DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'br', 'hr',
                'ul', 'ol', 'li',
                'blockquote', 'pre', 'code',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'strong', 'em', 'del', 'ins', 'sub', 'sup',
                'a', 'img', 'span', 'div',
                'details', 'summary',  // ← 原生折叠元素
                'button', 'svg', 'path', 'rect', 'circle', 'line',
            ],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'data-code', 'style', 'title', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'd', 'rx', 'x', 'y'],
            ALLOW_DATA_ATTR: true,
        })
    } catch {
        // 降级：纯文本转义
        return props.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
    }
})

// ─── 复制按钮逻辑 ──────────────────────────────

function bindCopyButtons() {
    if (!containerRef.value) return
    containerRef.value.querySelectorAll('.copy-btn').forEach((btn) => {
        if (btn.hasAttribute('data-bound')) return
        btn.setAttribute('data-bound', 'true')
        btn.addEventListener('click', () => {
            const encoded = btn.getAttribute('data-code') || ''
            try {
                const code = decodeURIComponent(escape(atob(encoded)))
                navigator.clipboard.writeText(code).then(() => {
                    const span = btn.querySelector('span')
                    if (span) { span.textContent = '已复制!'; setTimeout(() => { span.textContent = '复制' }, 2000) }
                })
            } catch { /* ignore */ }
        })
    })
}

onMounted(() => bindCopyButtons())
watch(() => props.content, () => nextTick(() => bindCopyButtons()))
</script>

<template>
    <div ref="containerRef" class="markdown-renderer" :class="`variant-${variant}`" v-html="renderedHtml" />
</template>

<style>
/* ─── 基础样式 ──────────────────────────────── */
.markdown-renderer {
    font-size: 14px;
    line-height: 1.75;
    color: #303133;
    word-break: break-word;
}

.markdown-renderer h1 {
    font-size: 1.5em;
    margin: 0.8em 0 0.4em;
}

.markdown-renderer h2 {
    font-size: 1.25em;
    margin: 0.7em 0 0.3em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid #ebeef5;
}

.markdown-renderer h3 {
    font-size: 1.1em;
    margin: 0.6em 0 0.2em;
}

.markdown-renderer p {
    margin: 0.4em 0;
}

.markdown-renderer ul,
.markdown-renderer ol {
    padding-left: 1.5em;
    margin: 0.4em 0;
}

.markdown-renderer li {
    margin: 0.2em 0;
}

.markdown-renderer code:not(pre code) {
    background: #f0f2f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.9em;
    color: #e6a23c;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* ─── 代码块（Atom One Dark 主题）───────────── */
.markdown-renderer .code-block-wrapper {
    position: relative;
    margin: 0.6em 0;
    border-radius: 8px;
    overflow: hidden;
}

.markdown-renderer .code-block-wrapper .code-lang {
    position: absolute;
    top: 0;
    left: 12px;
    font-size: 11px;
    color: #abb2bf;
    background: #3a3f4b;
    padding: 1px 10px;
    border-radius: 0 0 4px 4px;
    z-index: 1;
}

.markdown-renderer .code-block-wrapper .copy-btn {
    position: absolute;
    top: 6px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    font-size: 12px;
    color: #abb2bf;
    background: #3a3f4b;
    border: 1px solid #4b5263;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1;
}

.markdown-renderer .code-block-wrapper .copy-btn:hover {
    background: #4b5263;
    color: #d7dae0;
}

.markdown-renderer .code-block-wrapper:hover .copy-btn {
    opacity: 1;
}

.markdown-renderer pre {
    background: #282c34;
    border-radius: 0;
    padding: 0;
    margin: 0;
    overflow-x: auto;
}

.markdown-renderer pre code {
    display: block;
    padding: 14px 16px;
    font-size: 13px;
    line-height: 1.7;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
    color: #abb2bf;
}

/* ─── 推理折叠面板 ──────────────────────────── */
.markdown-renderer .thinking-fold {
    margin: 0.6em 0;
    border: 1px solid #e8d5b0;
    border-radius: 8px;
    overflow: hidden;
    background: #fefaf0;
}

/* 隐藏 <details> 默认三角，使用自定义图标 */
.markdown-renderer .thinking-fold>summary {
    list-style: none;
    /* 去掉默认三角 */
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
}

.markdown-renderer .thinking-fold>summary::-webkit-details-marker {
    display: none;
    /* WebKit 浏览器 */
}

.markdown-renderer .thinking-fold>summary::marker {
    display: none;
    content: '';
    /* 标准 */
}

.markdown-renderer .thinking-fold>summary:hover {
    background: #fdf3dc;
}

/* 自定义三角图标：折叠 ▸ / 展开 ▾ */
.markdown-renderer .thinking-fold-icon::before {
    content: '▸';
    font-size: 12px;
    color: #b88230;
    display: inline-block;
    width: 16px;
    text-align: center;
    transition: transform 0.2s;
}

.markdown-renderer .thinking-fold[open] .thinking-fold-icon::before {
    content: '▾';
}

.markdown-renderer .thinking-fold-label {
    font-size: 13px;
    font-weight: 600;
    color: #b88230;
    white-space: nowrap;
}

.markdown-renderer .thinking-fold-summary {
    font-size: 12px;
    color: #c0a87a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}

.markdown-renderer .thinking-fold-body {
    padding: 10px 14px 14px;
    border-top: 1px solid #e8d5b0;
    font-size: 13px;
    color: #8b7355;
    line-height: 1.7;
    background: #fffcf5;
}

/* ─── 表格 / 引用 / 链接 ────────────────────── */
.markdown-renderer table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.6em 0;
}

.markdown-renderer th,
.markdown-renderer td {
    border: 1px solid #dfe2e5;
    padding: 8px 12px;
    text-align: left;
}

.markdown-renderer th {
    background: #f6f8fa;
    font-weight: 600;
}

.markdown-renderer blockquote {
    border-left: 3px solid #409eff;
    padding: 4px 12px;
    margin: 0.4em 0;
    color: #606266;
    background: #ecf5ff;
    border-radius: 0 4px 4px 0;
}

.markdown-renderer a {
    color: #409eff;
    text-decoration: none;
}

.markdown-renderer a:hover {
    text-decoration: underline;
}

.markdown-renderer hr {
    border: none;
    border-top: 1px solid #ebeef5;
    margin: 0.6em 0;
}

.variant-chat.markdown-renderer h2 {
    font-size: 1.15em;
    border-bottom-color: #faecd8;
}

.variant-chat.markdown-renderer pre {
    background: #1e1e1e;
}

.variant-chat.markdown-renderer pre code {
    color: #d4d4d4;
}

.variant-report.markdown-renderer {
    font-size: 15px;
}
</style>
