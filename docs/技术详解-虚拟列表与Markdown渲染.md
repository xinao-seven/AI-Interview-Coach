# 虚拟列表 & Markdown 安全渲染 — 从零详解

> 本文基于 AI Interview Coach 项目实际代码，逐行讲解虚拟列表和 Markdown 渲染的完整实现原理。

---

## 第一部分：动态高度虚拟列表

### 1.1 什么是虚拟列表？为什么需要它？

#### 问题场景

假设聊天页面有 1000 条消息，每条消息渲染成一个 DOM 节点：

```
普通渲染：1000 个 <div> → 1000 个 DOM 节点
每个 DOM 需要：布局计算（Layout）→ 绘制（Paint）→ 合成（Composite）
```

浏览器需要同时管理 1000 个 DOM 节点，每次滚动都会触发大量计算，结果是：

- 页面首次加载卡顿（Layout 阻塞主线程）
- 滚动帧率从 60fps 跌到 10-20fps
- 内存占用高达几百 MB

#### 核心思想

**只渲染用户能看到的，其余用空白占位。**

```
┌─────────────────────┐  ← 浏览器视口（用户能看到的部分）
│  消息 37 (可见)      │     只渲染这 3 条消息的 DOM
│  消息 38 (可见)      │     其他的用高度占位
│  消息 39 (可见)      │
├─────────────────────┤
│  ↑ 上面 36 条消息    │     不创建 DOM，纯高度占位
│  ↓ 下面 961 条消息   │     不创建 DOM，纯高度占位
└─────────────────────┘
```

这样 1000 条消息只需要 5-10 个 DOM 节点，性能从 O(n) 降到 O(1)。

---

### 1.2 固定高度 vs 动态高度

#### 固定高度（简单版）

如果每条消息高度都是 80px，虚拟列表很简单：

```
第 i 条消息的 y 位置 = i × 80
可视区第一条 = scrollTop ÷ 80
可视区最后一条 = (scrollTop + containerHeight) ÷ 80
```

但聊天消息**高度完全不同**：短消息 50px，长消息含代码块 500px，无法预设。

#### 动态高度（本项目实现）

需要**实际测量**每条消息的高度，未测量的用预估值。

---

### 1.3 核心数据结构

```ts
// 爬过的山（测量过的消息高度）
const heightCache = ref<Record<string, number>>({
    'msg-001': 85, // 消息 ID → 实际高度（px）
    'msg-002': 220,
    'msg-003': 140,
    // 未测量的消息默认用 estimatedItemHeight = 120
});

// 根据缓存计算累积偏移量（每个消息的 y 起点）
const offsets = computed(() => {
    const arr = [0]; // 第 0 条消息从 y=0 开始
    for (let i = 0; i < items.length; i++) {
        const h = heightCache[items[i].id] ?? 120; // 有缓存用缓存，没缓存用预估
        arr.push(arr[i] + h);
    }
    return arr;
});
// offsets = [0, 85, 305, 445, ...]
//            ↑0   ↑1   ↑2   ↑3
//            第0条 第1条 第2条 第3条
```

用图表示：

```
y=0     ┌──────────┐  msg-001 (85px)   offsets[0]=0
y=85    ├──────────┤  msg-002 (220px)  offsets[1]=85
y=305   ├──────────┤  msg-003 (140px)  offsets[2]=305
y=445   ├──────────┤  msg-004 (???)    offsets[3]=445
        │   ...    │
y=10000 └──────────┘                    totalHeight = offsets[last]
```

---

### 1.4 可视区域裁剪（二分查找）

用户滚动到 `scrollTop = 320`，容器高度 `containerHeight = 600`：

```
                         scrollTop=320
                              │
    ┌─────────────────────────┼─────────────┐
    │  msg-001 (0~85)         │             │
    │  msg-002 (85~305)       │             │  ← 在视口上方的，不渲染
    ├─────────────────────────┤             │
    │  msg-003 (305~445)  ← 可见            │
    │  msg-004 (445~???)  ← 可见            │  视口范围 320~920
    │  msg-005 (???~???)  ← 可见            │
    ├─────────────────────────┤             │
    │  msg-006 ...            │             │  ← 在视口下方的，不渲染
    └─────────────────────────┴─────────────┘
```

```ts
// 二分查找第一个 offset > scrollTop 的索引
const startIndex = computed(() => {
    const target = scrollTop; // 320
    let lo = 0,
        hi = items.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (offsets[mid] <= target) lo = mid + 1;
        else hi = mid;
    }
    return Math.max(0, lo - 1 - overscan); // overscan=3，多渲染上面3条防白屏
});
// 结果：startIndex = 0（因为 offsets[0]=0, offsets[1]=85, offsets[2]=305 都 ≤320）

const endIndex = computed(() => {
    const target = scrollTop + containerHeight; // 320 + 600 = 920
    // 同理二分查找
    return Math.min(items.length, lo + overscan);
});
// 结果：endIndex = 约 8
```

> **为什么用二分查找而不是 Array.find？** 因为 `offsets` 是单调递增的，二分查找 O(log n)，远比线性 O(n) 快。

---

### 1.5 ResizeObserver 动态高度测量

这是虚拟列表最精妙的部分——消息渲染后才去量它的真实高度。

```ts
// 1. 创建观察器
const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const id = el.dataset.virtualId; // 从 DOM 上读取消息 ID
        const h = Math.round(entry.contentRect.height);

        if (h > 0 && heightCache[id] !== h) {
            // 2. 更新缓存（创建新对象触发 Vue 响应式）
            heightCache.value = { ...heightCache.value, [id]: h };
            // 3. offsets 自动重新计算 → visibleItems 自动更新 → DOM 自动重排
        }
    }
});

// 4. 消息渲染后注册观察
function observeItem(el: HTMLElement, id: string) {
    el.dataset.virtualId = id;
    resizeObserver.observe(el); // 开始监听这个 DOM 的高度变化
}
```

**工作流程**：

```
消息渲染到 DOM
     │
     ▼
ResizeObserver 检测到 contentRect.height
     │
     ▼
更新 heightCache[id] = 真实高度
     │
     ▼
offsets 重新计算（下面的消息位置下移）
     │
     ▼
visibleItems 重新计算（可能多/少渲染几条）
     │
     ▼
DOM 更新（消息移到正确位置）
```

这解释了为什么首次渲染时有轻微的位置调整——先用预估值 120px 排位置，ResizeObserver 测量后再精确修正。

---

### 1.6 踩过的坑：布局结构 bug

这是实际开发中踩的最经典的坑。

#### ❌ 错误结构

```html
<div class="scroll-container" style="overflow: auto">
    <div class="phantom" style="height: 10000px"></div>
    <!-- 撑开滚动条 -->
    <div class="viewport" style="position: relative">
        <!-- 排在 phantom 后面！ -->
        <div style="position: absolute; top: 0">消息1</div>
        <!-- top:0 相对于 viewport -->
    </div>
</div>
```

**问题**：phantom 和 viewport 是文档流中的兄弟元素。phantom 高度 10000px，viewport 排在它后面，起点在 y=10000px。viewport 内部 `top: 0` 实际在容器的 y=10000px 处。

```
容器顶部 y=0
    │
    ├── phantom (height: 10000px)
    │
容器 y=10000 ──├── viewport (position: relative)
    │              ├── 消息1 (position: absolute; top: 0)  ← 实际在 y=10000！
    │              └── 消息2 (position: absolute; top: 200)
```

用户看到顶部全白，因为所有消息都在 y=10000+ 的位置。

#### ✅ 正确结构

```html
<div class="scroll-container" style="overflow: auto">
    <div class="inner" style="position: relative; min-height: 10000px">
        <!-- minHeight 撑开滚动条，同时作为绝对定位的参考 -->
        <div style="position: absolute; top: 0">消息1</div>
        <!-- top:0 = 真正的 y=0 -->
        <div style="position: absolute; top: 200">消息2</div>
    </div>
</div>
```

**关键**：`minHeight` 撑开滚动条，`position: relative` 作为绝对定位的参考容器，消息的 `top` 直接对应在容器中的真实位置。

---

### 1.7 自动滚动策略

```ts
// 用户是否正在浏览历史（手动往上滚了）
const userScrollingUp = ref(false);

function handleScroll(e: Event) {
    const el = e.target as HTMLElement;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrollingUp.value = distanceFromBottom > 50; // 离底部超过50px = 在看历史
}

// 新消息到来时
watch(
    () => items.length,
    () => {
        if (stickToBottom && !userScrollingUp.value) {
            scrollToBottom(); // 只在"粘底"状态才自动滚到底部
        }
    }
);

// 流式消息增长时也是如此
watch(
    () => items,
    () => {
        if (stickToBottom && !userScrollingUp.value) {
            nextTick(() => scrollToBottom());
        }
    },
    { deep: true, flush: 'post' }
);
```

用户在看历史消息时，新消息不会打断阅读；看完后点"回到底部"按钮恢复自动跟随。

---

## 第二部分：Markdown 安全渲染

### 2.1 渲染管道全景

```
原始 Markdown 文本
        │
        ▼
  ┌─────────────────┐
  │ 预处理：思考折叠  │  正则匹配 <thinking> → 替换为 <details>
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ markdown-it      │  Markdown → HTML
  │ .render()        │  `**粗体**` → `<strong>粗体</strong>`
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ DOMPurify        │  安全清洗：剥离 <script>、onerror 等
  │ .sanitize()      │  只保留白名单中的标签和属性
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ v-html           │  安全的 HTML 注入 DOM
  └─────────────────┘
```

### 2.2 第一层防护：markdown-it

```ts
const md = new MarkdownIt({
    html: true, // 允许内联 HTML（如 <details>）
    linkify: true, // 自动识别 URL 并转为链接
    breaks: true, // 单个换行 → <br>
    typographer: true, // 智能引号等排版优化
});
```

`markdown-it` 只做 Markdown 语法到 HTML 的转换，**不做安全过滤**。如果设置 `html: false`，它会转义所有 HTML 标签（`<div>` → `&lt;div&gt;`），但我们用 `html: true` + DOMPurify 兜底。

### 2.3 第二层防护：DOMPurify（核心安全）

```ts
DOMPurify.sanitize(rawHtml, {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'p', 'br', 'hr',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'strong', 'em', 'del', 'a', 'img',
    'details', 'summary',  // 原生折叠元素
    'span', 'div', 'button', 'svg', 'path', ...
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'title', ...],
  // 不在此列表的标签和属性全部剥离
})
```

**工作原理（白名单模式）**：

```
输入 HTML：<script>alert('xss')</script><p>正常内容</p>
          │
          ▼ DOMPurify.sanitize()
          │
输出 HTML：<p>正常内容</p>
          ↑ script 标签不在 ALLOWED_TAGS 中 → 被移除
```

重要：**永远不做黑名单**（列举危险标签），因为攻击者总能找到绕过方式。白名单（只允许安全的）是唯一正确的做法。

### 2.4 自定义代码块渲染

`markdown-it` 的 `fence` 规则处理 Markdown 代码块：

```ts
md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = token.info.trim(); // 语言标识：js、ts、python...
    const code = token.content; // 代码内容

    // 1. highlight.js 语法高亮
    const highlighted = hljs.highlight(code, { language: lang }).value;

    // 2. 代码内容 base64 编码（防 XSS）
    const encoded = btoa(unescape(encodeURIComponent(code)));

    // 3. 输出 HTML
    return `
    <div class="code-block-wrapper">
      <span class="code-lang">${lang}</span>
      <button class="copy-btn" data-code="${encoded}">复制</button>
      <pre class="hljs"><code>${highlighted}</code></pre>
    </div>`;
};
```

**为什么用 base64 编码 data-code？**

```html
<!-- ❌ 危险：代码含 " 会破坏 HTML 结构 -->
<button data-code="const x = "hello"">

<!-- ✅ 安全：base64 不含特殊字符 -->
<button data-code="Y29uc3QgeCA9ICJoZWxsbyI=">
```

复制时解码：

```ts
btn.addEventListener('click', () => {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    navigator.clipboard.writeText(decoded);
});
```

### 2.5 思考链折叠（推理过程展示）

大模型（如 DeepSeek R1）会输出推理过程。我们用原生 `<details>` 元素将其折叠：

```
AI 原始输出：
<thinking>
这道题考察泛型的使用场景。候选人覆盖了集合类、函数关联类型...
准确性和完整性都很高，但项目结合度偏低...
</thinking>
{
  "totalScore": 85,
  "accuracy": 95,
  ...
}
```

**预处理流程**：

```ts
function preprocessThinking(content: string): string {
    // 正则匹配 <thinking>...</thinking>
    return content.replace(/<thinking>\s*([\s\S]*?)\s*<\/thinking>/gi, (_, thinking) =>
        buildThinkingFold(thinking.trim())
    );
}

function buildThinkingFold(thinkingContent: string): string {
    // 也对推理过程做 Markdown 渲染（支持代码块等）
    const rendered = md.render(thinkingContent);
    // 截取前 80 字符作为摘要
    const summary = thinkingContent.slice(0, 80);

    return `
<details class="thinking-fold">
  <summary class="thinking-fold-header">
    <span class="thinking-fold-icon"></span>
    <span class="thinking-fold-label">🧠 思考过程</span>
    <span class="thinking-fold-summary">${summary}...</span>
  </summary>
  <div class="thinking-fold-body">
    ${rendered}
  </div>
</details>`;
}
```

**为什么用 `<details>` 而不用 JS 控制？**

| 方案                  | 问题                                        |
| --------------------- | ------------------------------------------- |
| `<div onclick="...">` | `onclick` 被 DOMPurify 剥离（安全策略）     |
| Vue 组件动态控制      | 需要将 Markdown 拆成 vnode，复杂度高        |
| `<details>` + CSS     | 原生浏览器支持，零 JS，DOMPurify 白名单允许 |

**CSS 实现三角图标自动切换**：

```css
/* 折叠状态：▸ */
.thinking-fold-icon::before {
    content: '▸';
}

/* 展开状态：▾（用原生 [open] 属性判断） */
.thinking-fold[open] .thinking-fold-icon::before {
    content: '▾';
}

/* 隐藏浏览器默认三角标记 */
.thinking-fold > summary::-webkit-details-marker {
    display: none;
}
.thinking-fold > summary::marker {
    display: none;
    content: '';
}
```

---

### 2.6 代码高亮主题

```ts
import 'highlight.js/styles/atom-one-dark.css';
```

选择 Atom One Dark 主题，代码块呈现暗色背景（`#282c34`），适合技术对话场景：

```
┌──────────────────────────────────┐
│ javascript              📋 复制  │  ← 语言标签 + 复制按钮
├──────────────────────────────────┤
│  const fn = <T>(arg: T): T => {  │  ← 暗色代码
│    return arg                    │
│  }                              │
└──────────────────────────────────┘
```

---

### 2.7 降级策略

渲染链路任一环节失败都不能让页面崩溃：

```ts
const renderedHtml = computed(() => {
  if (!props.content) return ''
  try {
    // 1. 预处理：折叠思考
    const preprocessed = preprocessThinking(props.content)
    // 2. Markdown → HTML
    const rawHtml = md.render(preprocessed)
    // 3. DOMPurify 清洗
    return DOMPurify.sanitize(rawHtml, { ... })
  } catch {
    // 降级：纯文本转义（失去了格式，但不会白屏）
    return props.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }
})
```

---

## 第三部分：两个模块的关联

虚拟列表和 Markdown 渲染在聊天页面的协作流程：

```
1. 用户提交回答
      │
2. AI 返回评分结果（含 thinking + Markdown 评分表格）
      │
3. formatEvaluation() 拼接 thinking 块 + 表格
      │
4. simulateStream() 流式逐字输出
      │
5. VirtualChatList 的 ResizeObserver 实时检测消息高度变化
      │
6. heightCache 更新 → offsets 重算 → 消息自动移到正确位置
      │
7. MarkdownRenderer 的 watch 检测 content 变化 → 重新绑定复制按钮
```

---

## 第四部分：关键知识点速查

| 概念                    | 一句话解释                                                       |
| ----------------------- | ---------------------------------------------------------------- |
| **虚拟列表**            | 只渲染可视区 ± N 条消息，其余用高度占位                          |
| **动态高度**            | 用 ResizeObserver 实测每条消息的真实高度                         |
| **二分查找**            | 利用 offsets 单调递增特性，O(log n) 定位可视区                   |
| **minHeight vs height** | phantom+viewport 分离导致 y 偏移 bug，改用单层 inner + minHeight |
| **DOMPurify 白名单**    | 只允许已知安全的标签/属性，未知的全部剥离                        |
| **base64 编码**         | 防止代码内容中的特殊字符破坏 HTML 结构                           |
| **`<details>` 折叠**    | 原生 HTML 折叠元素，不依赖 JS，不被 DOMPurify 剥离               |
| **`[open]` CSS 选择器** | `<details open>` 状态用 CSS 伪类自动切换图标                     |
| **ResizeObserver**      | 监听 DOM 元素 contentRect 变化，替代 polling 方案                |
| **AbortController**     | 组件卸载时取消 fetch，防止 setState on unmounted                 |

---

_建议对着 `VirtualChatList.vue` 和 `MarkdownRenderer.vue` 源码阅读本文，边看代码边对照讲解。_
