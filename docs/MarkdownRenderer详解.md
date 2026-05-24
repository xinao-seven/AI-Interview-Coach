# MarkdownRenderer.vue 逐行拆解

> 本文按代码执行顺序，详细解释每个函数、每个第三方 API 的作用和用法。

---

## 文件概览

```
MarkdownRenderer.vue
│
├── <script setup>  ← 核心渲染逻辑
│   ├── 第三方库导入与初始化
│   ├── markdown-it 自定义 fence 渲染器（代码块）
│   ├── preprocessThinking()  ← 思考折叠预处理
│   ├── buildThinkingFold()   ← 生成 <details> HTML
│   ├── renderedHtml 计算属性 ← 渲染管道
│   ├── bindCopyButtons()     ← 复制按钮事件绑定
│   └── 生命周期钩子
│
├── <template>  ← 单行：v-html 注入安全 HTML
│
└── <style>  ← 三种变体（default / chat / report）
```

---

## 第一部分：第三方库

### 1.1 markdown-it — Markdown → HTML

```ts
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
    html: true, // ①
    linkify: true, // ②
    breaks: true, // ③
    typographer: true, // ④
});
```

| 选项                | 作用                                       | 示例                                     |
| ------------------- | ------------------------------------------ | ---------------------------------------- |
| `html: true`        | 允许 Markdown 中嵌入原始 HTML 标签，不转义 | `<details>` 不会被转成 `&lt;details&gt;` |
| `linkify: true`     | 自动把纯文本 URL 转为可点击链接            | `https://example.com` → `<a href="...">` |
| `breaks: true`      | 单个换行符 `\n` 转换为 `<br>`              | 不写两个空格也能换行                     |
| `typographer: true` | 智能排版替换                               | `(c)` → `©`，`"..."` → `"..."`           |

**核心 API：`md.render(markdownText)`**

```ts
const html = md.render('**粗体** `代码`');
// → '<p><strong>粗体</strong> <code>代码</code></p>\n'
```

**核心 API：`md.renderer.rules.fence`**（自定义代码块渲染规则）

````ts
// markdown-it 的渲染规则是可以覆盖的
// fence 规则处理 ``` 围栏代码块
const defaultFence = md.renderer.rules.fence!; // 保存原始规则（备用）
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    // tokens: 解析后的 token 数组
    // idx:    当前 token 的索引
    // 返回值:  HTML 字符串
};
````

**核心 API：`md.utils.escapeHtml(str)`**

```ts
md.utils.escapeHtml('<script>');
// → '&lt;script&gt;'
// 把用户输入中的 HTML 特殊字符转义，防止注入
```

---

### 1.2 highlight.js — 代码语法高亮

```ts
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
```

**核心 API：`hljs.getLanguage(lang)`**

```ts
hljs.getLanguage('typescript'); // → 返回语言定义对象（有）
hljs.getLanguage('aaa'); // → undefined（不支持）
// 用来判断是否支持该语言的语法高亮
```

**核心 API：`hljs.highlight(code, { language, ignoreIllegals })`**

```ts
const result = hljs.highlight('const x = 1', {
    language: 'typescript',
    ignoreIllegals: true, // 遇到不识别的语法不报错，尽量高亮
});
// result.value → HTML 字符串，每个 token 用 <span class="hljs-xxx"> 包裹
```

`ignoreIllegals: true` 的含义：

```ts
// 没有这个参数：代码中有语法错误时，highlight.js 可能抛异常或直接不处理
// 有这个参数：   遇到不认识的语法就跳过，尽最大努力高亮剩余部分
```

**CSS 主题**：`atom-one-dark.css` 是 VS Code Atom One Dark 主题的 highlight.js 移植版，背景 `#282c34`。

---

### 1.3 DOMPurify — HTML 安全清洗

```ts
import DOMPurify from 'dompurify';
```

**核心 API：`DOMPurify.sanitize(html, config)`**

```ts
const clean = DOMPurify.sanitize(dirtyHtml, {
  ALLOWED_TAGS: ['p', 'strong', 'em', 'a', ...],   // 白名单：只允许这些标签
  ALLOWED_ATTR: ['href', 'class', 'title', ...],    // 白名单：只允许这些属性
  ALLOW_DATA_ATTR: true,                             // 允许 data-* 属性
})
```

| 配置项            | 含义                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `ALLOWED_TAGS`    | 标签白名单。不在列表中的全部移除（如 `<script>`、`<iframe>`）      |
| `ALLOWED_ATTR`    | 属性白名单。不在列表中的全部剥离（如 `onclick`、`onerror`）        |
| `ALLOW_DATA_ATTR` | 是否保留 `data-*` 属性。`true` 保留（用于 `data-code` 存代码内容） |

**工作原理**：

```html
输入:
<p onclick="alert(1)">
    Hello
    <script>
        evil();
    </script>
</p>
│ ▼ DOMPurify.sanitize() │ 输出:
<p>Hello</p>
↑ onclick 不在白名单 → 剥离 ↑ script 不在白名单 → 整个标签移除
```

---

## 第二部分：自定义代码块渲染器

### 完整流程

````ts
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]; // 当前代码块 token
    const lang = token.info.trim(); // 语言标识（```后面的文字）
    // token.content = 代码块内的原始文本

    // ① 语法高亮
    let highlighted = '';
    if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(token.content, {
            language: lang,
            ignoreIllegals: true,
        }).value;
    } else {
        // 不支持的语言 → 纯转义
        highlighted = md.utils.escapeHtml(token.content);
    }

    // ② 语言标签
    const langLabel = lang ? `<span class="code-lang">${md.utils.escapeHtml(lang)}</span>` : '';

    // ③ 代码内容 base64 编码（防 XSS，因为要放进 HTML 属性）
    const encodedCode = btoa(unescape(encodeURIComponent(token.content)));

    // ④ 输出完整 HTML
    return `
    <div class="code-block-wrapper">
      ${langLabel}
      <button class="copy-btn" data-code="${encodedCode}">
        <svg ...>...</svg>
        <span>复制</span>
      </button>
      <pre class="hljs"><code>${highlighted}</code></pre>
    </div>`;
};
````

### base64 编码详解

```ts
const encodedCode = btoa(unescape(encodeURIComponent(token.content)));
```

这是一个三步编码管线，解决"含中文和多字节字符的文本放进 HTML 属性"的问题：

```ts
// 原始代码（含中文、特殊字符）
const code = `const 你好 = "world"`;

// ① encodeURIComponent：把多字节字符转为 %XX 形式
encodeURIComponent(code);
// → 'const%20%E4%BD%A0%E5%A5%BD%20%3D%20%22world%22'

// ② unescape：把 %XX 转为原始字节（已废弃但此处仍有奇效）
unescape('const%20%E4%BD%A0%E5%A5%BD%20%3D%20%22world%22');
// → 'const ä½\xa0å¥½ = "world"'（字节序列）

// ③ btoa：把字节序列转为 base64
btoa('const ä½\xa0å¥½ = "world"');
// → 'Y29uc3Qg5L2g5aW9ID0gIndvcmxkIg=='
//    ↑ 纯 ASCII，安全放入 HTML 属性
```

解码时逆向操作：

```ts
atob(encoded)                    // base64 → 字节
decodeURIComponent(escape(...))  // 字节 → 原始字符串
```

---

## 第三部分：渲染管道

### 整个 data flow

```
props.content（原始 Markdown 字符串）
        │
        ▼
┌──────────────────────┐
│ preprocessThinking() │  正则匹配 <thinking> 标签 → 替换为 <details> HTML
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ md.render()          │  markdown-it 把 Markdown → HTML
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ DOMPurify.sanitize() │  白名单清洗
└────────┬─────────────┘
         │
         ▼
       v-html（安全注入 DOM）
```

### 3.1 `preprocessThinking()` — 思考标记替换

```ts
function preprocessThinking(content: string): string {
    // 正则 1：匹配 <thinking>...</thinking>（不区分大小写）
    content = content.replace(/<thinking>\s*([\s\S]*?)\s*<\/thinking>/gi, (_, thinking) =>
        buildThinkingFold(thinking.trim())
    );

    // 正则 2：匹配 【思考】...【/思考】
    content = content.replace(/【思考】\s*([\s\S]*?)\s*【\/思考】/g, (_, thinking) =>
        buildThinkingFold(thinking.trim())
    );

    return content;
}
```

**正则解释**：

```
/<thinking>\s*([\s\S]*?)\s*<\/thinking>/gi
 │          │   │  │      │  │           │
 │          │   │  │      │  │           └─ g: 全局匹配  i: 忽略大小写
 │          │   │  │      │  └─ 结束标签
 │          │   │  │      └─ 允许标签前后有空白
 │          │   │  └─ ? 非贪婪：尽可能少匹配
 │          │   └─ [\s\S] 匹配任意字符（包括换行，因为 . 不匹配 \n）
 │          └─ ( ) 捕获组：匹配的内容传给回调
 └─ 开始标签
```

> `[\s\S]` 是"匹配所有字符包括换行"的标准写法。`.` 在 JS 正则中默认不匹配 `\n`，所以用 `[\s\S]` 替代。

### 3.2 `buildThinkingFold()` — 生成折叠 HTML

```ts
function buildThinkingFold(thinkingContent: string): string {
    // 对推理内容也做 Markdown 渲染
    const rendered = md.render(thinkingContent);

    // 生成摘要（纯文本前 80 字符）
    const plainText = thinkingContent
        .replace(/<[^>]*>/g, '') // 去 HTML 标签
        .replace(/[#*`\n>-]/g, ' ') // 去 Markdown 符号
        .replace(/\s+/g, ' ') // 合并多余空白
        .trim();
    const summary = plainText.length > 80 ? plainText.slice(0, 80) + '...' : plainText;

    // 输出原生 <details> 元素
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
</details>`;
}
```

**`<details>` / `<summary>` API**：

```html
<!-- 浏览器内置的折叠元素，零 JS -->
<details open>
    <!-- open 属性 = 默认展开 -->
    <summary>点击展开/折叠</summary>
    <!-- 始终可见的标题行 -->
    <div>折叠的内容</div>
    <!-- 默认隐藏，点击 summary 显示 -->
</details>
```

CSS 状态选择器：

```css
.thinking-fold[open]  /* details 展开状态 */
.thinking-fold:not([open])  /* 折叠状态 */
```

### 3.3 `renderedHtml` 计算属性 — 完整渲染管道

```ts
const renderedHtml = computed(() => {
    if (!props.content) return '';

    try {
        // 第1步：预处理
        const preprocessed = preprocessThinking(props.content);

        // 第2步：Markdown → HTML
        const rawHtml = md.render(preprocessed);

        // 第3步：安全清洗
        return DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'p',
                'br',
                'hr',
                'ul',
                'ol',
                'li',
                'blockquote',
                'pre',
                'code',
                'table',
                'thead',
                'tbody',
                'tr',
                'th',
                'td',
                'strong',
                'em',
                'del',
                'ins',
                'sub',
                'sup',
                'a',
                'img',
                'span',
                'div',
                'details',
                'summary',
                'button',
                'svg',
                'path',
                'rect',
                'circle',
                'line',
            ],
            ALLOWED_ATTR: [
                'href',
                'target',
                'rel',
                'src',
                'alt',
                'class',
                'data-code',
                'style',
                'title',
                'width',
                'height',
                'viewBox',
                'fill',
                'stroke',
                'stroke-width',
                'd',
                'rx',
                'x',
                'y',
            ],
            ALLOW_DATA_ATTR: true,
        });
    } catch {
        // 管线任何一步崩了 → 安全降级
        return props.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    }
});
```

**`computed` 在这里的作用**：

```ts
// computed 有缓存机制
// props.content 不变 → 不重新执行 → 直接用缓存值
// props.content 变化 → 自动重新执行 → 更新 DOM

// 如果不用 computed，每次模板访问都重新执行
// → 每次重新解析 Markdown → 性能浪费
```

**DOMPurify 白名单为什么包含这些标签？**

| 标签                                    | 为什么需要                        |
| --------------------------------------- | --------------------------------- |
| `h1~h6`                                 | Markdown `# ## ###` 标题          |
| `p, br, hr`                             | 段落、换行、分割线                |
| `ul, ol, li`                            | 列表                              |
| `blockquote`                            | `>` 引用块                        |
| `pre, code`                             | 代码块和行内代码                  |
| `table, thead, tbody, tr, th, td`       | 表格                              |
| `strong, em, del, ins, sub, sup`        | 粗体、斜体、删除线、上下标        |
| `a`                                     | 链接                              |
| `span, div`                             | 通用容器（代码高亮的 token span） |
| `details, summary`                      | 思考折叠面板                      |
| `button, svg, path, rect, circle, line` | 复制按钮和图标                    |

**为什么没有 `img`？**
`img` 在白名单里，但 `src` 属性会被 DOMPurify 进一步过滤（只允许安全协议如 `https:`）。

---

## 第四部分：复制按钮

### 4.1 `bindCopyButtons()` — 事件绑定

```ts
function bindCopyButtons() {
    if (!containerRef.value) return;

    containerRef.value.querySelectorAll('.copy-btn').forEach((btn) => {
        // 防重复绑定
        if (btn.hasAttribute('data-bound')) return;
        btn.setAttribute('data-bound', 'true');

        btn.addEventListener('click', () => {
            const encoded = btn.getAttribute('data-code') || '';
            try {
                // 解码 base64
                const code = decodeURIComponent(escape(atob(encoded)));
                // 写入剪贴板
                navigator.clipboard.writeText(code).then(() => {
                    const span = btn.querySelector('span');
                    if (span) {
                        span.textContent = '已复制!';
                        setTimeout(() => {
                            span.textContent = '复制';
                        }, 2000);
                    }
                });
            } catch {
                /* ignore */
            }
        });
    });
}
```

**`navigator.clipboard.writeText()` API**：

```ts
// 异步写入剪贴板（需要 HTTPS 或 localhost）
await navigator.clipboard.writeText('要复制的内容');
// 返回 Promise，成功 resolve，失败 reject
```

**为什么用 `data-bound` 防重复绑定？**

```html
<!-- 第1次 bindCopyButtons() -->
<button class="copy-btn">
    ← 没有 data-bound，绑定事件，添加 data-bound

    <!-- 第2次 bindCopyButtons()（因为 content 变了，重新渲染了） -->
    <button class="copy-btn" data-bound>← 有 data-bound，跳过</button>
</button>
```

### 4.2 何时触发绑定

```ts
onMounted(() => bindCopyButtons()); // 组件挂载后
watch(
    () => props.content,
    () => nextTick(() => bindCopyButtons())
); // content 变化后
```

`nextTick` 确保 DOM 已更新后再查询 `.copy-btn`。

---

## 第五部分：CSS 样式设计

### 5.1 为什么用不 scoped 的 `<style>`？

```html
<style>  /* 注意：没有 scoped */
```

因为 `v-html` 注入的 HTML **不会继承 scoped 样式**。Vue 的 scoped 通过给组件模板中的元素加 `data-v-xxx` 属性来隔离样式，但 `v-html` 的内容是运行时动态插入的，Vue 不会处理它。

所以这里用不带 scoped 的全局样式，通过 `.markdown-renderer` 父类名做命名空间隔离。

### 5.2 Variant 变体

```css
.variant-chat.markdown-renderer h2 { ... }     /* 聊天场景：标题更小 */
.variant-chat.markdown-renderer pre { ... }    /* 聊天场景：代码块更深色 */
.variant-report.markdown-renderer { ... }      /* 报告场景：字号更大 */
```

通过 `props.variant` 动态切换类名：`:class="\`variant-${variant}\`"`

### 5.3 `<details>` 三角图标的 CSS 技巧

```css
/* 隐藏浏览器默认 ▶ */
.thinking-fold > summary::-webkit-details-marker {
    display: none;
}
.thinking-fold > summary::marker {
    display: none;
    content: '';
}

/* 折叠状态：自定义 ▸ */
.thinking-fold-icon::before {
    content: '▸';
}

/* 展开状态：自定义 ▾ */
.thinking-fold[open] .thinking-fold-icon::before {
    content: '▾';
}
```

`[open]` 选择器是浏览器在 `<details>` 展开时自动添加的 pseudo-class，无需 JS。

---

## 第六部分：完整执行时序

当父组件传入新的 `content` prop 时：

```
1. props.content 变化
      │
2. computed renderedHtml 检测到依赖变化 → 重新执行
      │
3. preprocessThinking(content)          ← 正则替换 <thinking>
      │
4. md.render(preprocessed)              ← markdown-it 解析
      │
5. DOMPurify.sanitize(rawHtml)          ← 安全过滤
      │
6. v-html 更新 DOM
      │
7. watch(content) 触发 → nextTick
      │
8. bindCopyButtons()                    ← 给新代码块绑复制事件
      │
9. ResizeObserver（VirtualChatList）    ← 检测到消息高度变化
```

---

## 速查表

| API                                  | 所属库       | 作用                     |
| ------------------------------------ | ------------ | ------------------------ |
| `new MarkdownIt({...})`              | markdown-it  | 创建 Markdown 解析器实例 |
| `md.render(text)`                    | markdown-it  | Markdown → HTML          |
| `md.renderer.rules.fence`            | markdown-it  | 覆盖代码块渲染规则       |
| `md.utils.escapeHtml(str)`           | markdown-it  | 转义 HTML 特殊字符       |
| `hljs.getLanguage(lang)`             | highlight.js | 检查是否支持某语言高亮   |
| `hljs.highlight(code, opts)`         | highlight.js | 代码语法高亮，返回 HTML  |
| `DOMPurify.sanitize(html, cfg)`      | DOMPurify    | 白名单清洗 HTML          |
| `navigator.clipboard.writeText(str)` | Web API      | 写入剪贴板               |
| `btoa(str)` / `atob(str)`            | Web API      | Base64 编码/解码         |
| `encodeURIComponent(str)`            | Web API      | URL 编码（处理多字节）   |
| `new ResizeObserver(cb)`             | Web API      | 监听 DOM 元素尺寸变化    |
