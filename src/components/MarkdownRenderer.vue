<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const props = withDefaults(defineProps<{
  content: string
  variant?: 'chat' | 'report' | 'default'
}>(), {
  variant: 'default',
})

const containerRef = ref<HTMLElement | null>(null)

const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

// Custom fence renderer for code blocks with copy button
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

  return (
    '<div class="code-block-wrapper">' +
    langLabel +
    '<button class="copy-btn" data-code="' + md.utils.escapeHtml(token.content).replace(/"/g, '&quot;') + '">复制代码</button>' +
    '<pre class="hljs"><code>' + highlighted + '</code></pre>' +
    '</div>'
  )
}

function safeRender(text: string): string {
  if (!text) return ''
  try {
    return md.render(text)
  } catch {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }
}

const renderedHtml = computed(() => safeRender(props.content))

function bindCopyButtons() {
  if (!containerRef.value) return
  const buttons = containerRef.value.querySelectorAll('.copy-btn')
  buttons.forEach((btn) => {
    if (btn.hasAttribute('data-bound')) return
    btn.setAttribute('data-bound', 'true')
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code') || ''
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = '已复制!'
        setTimeout(() => { btn.textContent = '复制代码' }, 2000)
      }).catch(() => {})
    })
  })
}

onMounted(() => {
  bindCopyButtons()
})

watch(() => props.content, () => {
  nextTick(() => bindCopyButtons())
})
</script>

<template>
  <div
    ref="containerRef"
    class="markdown-renderer"
    :class="`variant-${variant}`"
    v-html="renderedHtml"
  />
</template>

<style>
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

.markdown-renderer .code-block-wrapper {
  position: relative;
  margin: 0.6em 0;
}

.markdown-renderer .code-block-wrapper .code-lang {
  position: absolute;
  top: 0;
  left: 12px;
  font-size: 11px;
  color: #909399;
  background: #e4e7ed;
  padding: 1px 8px;
  border-radius: 0 0 4px 4px;
}

.markdown-renderer .code-block-wrapper .copy-btn {
  position: absolute;
  top: 6px;
  right: 10px;
  padding: 2px 10px;
  font-size: 12px;
  color: #606266;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 1;
}

.markdown-renderer .code-block-wrapper:hover .copy-btn {
  opacity: 1;
}

.markdown-renderer pre {
  background: #f6f8fa;
  border-radius: 6px;
  padding: 0;
  margin: 0;
  overflow-x: auto;
}

.markdown-renderer pre code {
  display: block;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

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

/* Variant: chat */
.variant-chat.markdown-renderer h2 {
  font-size: 1.15em;
  border-bottom-color: #faecd8;
}

.variant-chat.markdown-renderer pre {
  background: #282c34;
}

.variant-chat.markdown-renderer pre code {
  color: #abb2bf;
}

/* Variant: report */
.variant-report.markdown-renderer {
  font-size: 15px;
}
</style>
