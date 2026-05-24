# 从提交回答到页面渲染 — 完整调用链拆解

> 以 Mock 模式下用户按 Ctrl+Enter 提交回答为例，追踪每一行代码的执行轨迹，直至页面更新完成。

---

## 全景时间线

```
t=0ms      用户按 Ctrl+Enter
t=0ms      handleSubmit() 开始
t=0ms      用户消息插入 Store → DOM 渲染
t=0ms      await evaluateAnswerApi() 开始（Mock 下 ~800ms 后返回）
t=0~800ms  用户看到自己的消息气泡 + "正在评分..."动画
t=800ms    评分结果返回
t=800ms    formatEvaluation() 拼接 Markdown
t=800ms    评分消息插入 Store（content=""，status="streaming"）
t=800ms    simulateStream() 启动
t=900ms    pump() 第1次：吐出 3 个字符
t=925ms    pump() 第2次：吐出下 3 个字符
...        （每 ~25ms 吐一次，直到全文输出完毕）
t=3000ms   onDone() 触发
t=5500ms   自动推进到下一题
```

---

## 第一步：用户按 Ctrl+Enter

```html
<!-- MockInterview.vue 模板 -->
<el-input v-model="answerText" @keydown.ctrl.enter="handleSubmit" />
```

```ts
// 计算属性判断按钮是否可点击
const canSubmit = computed(() => {
    return (
        answerText.value.trim().length > 0 && // 有内容
        !submitting.value && // 不在提交中
        !hasCurrentAnswer.value && // 当前题还没答过
        !streaming.value
    ); // 不在流式输出中
});
```

`canSubmit` 为 `true` → `handleSubmit()` 被调用。

---

## 第二步：`handleSubmit()` 执行

### 2.1 锁定状态 + 判断场景

```ts
submitting.value = true; // 锁定按钮，防止重复提交

const isFollowUpAnswer = interviewStore.hasActiveFollowUp; // 是否在回答追问
const followUpQ = interviewStore.activeFollowUpQuestion; // 追问文本（如果有）
```

### 2.2 创建用户消息并插入 Store

```ts
const userMsg: ChatMessage = {
    id: `msg-${Date.now()}`, // "msg-1716900000000"
    role: 'user', // 用户消息
    content: answerText.value.trim(), // "Vue3使用Proxy实现响应式..."
    createdAt: new Date().toISOString(),
    questionId: currentQuestion.value.id,
    status: 'done', // 用户消息不需要流式，直接 done
};
interviewStore.addMessage(userMsg); // → Store 更新
```

`addMessage` 做的事（`stores/modules/interview.ts`）：

```ts
function addMessage(msg: ChatMessage) {
    messages.value.push(msg); // ← 向 messages 数组末尾追加一条
    saveToStorage(); // ← 持久化到 localStorage
}
```

**此时发生了什么**：

```
messages.value 变化
    │
    ▼
VirtualChatList 的 watch(() => items.length) 检测到变化
    │  n > prevItemCount → 新消息！
    │  stickToBottom=true && !userScrollingUp → 应该滚底
    ▼
virtualListRef.value?.scrollToBottom()
    │
    ▼
ResizeObserver 检测到新消息 DOM 的 contentRect.height
    │
    ▼
heightCache 更新 → offsets 重算 → 其他消息位置无变化（新消息在末尾）
```

### 2.3 清空输入框 + 滚底

```ts
answerText.value = ''; // 清空输入框
scrollToBottom(); // 滚到最新消息
```

### 2.4 显示"正在评分"动画

```ts
evaluating.value = true; // ← 触发模板中 evaluating-overlay 显示
```

模板中：

```html
<div v-if="evaluating && !streaming" class="evaluating-overlay">
    <div class="evaluating-dots"><span></span><span></span><span></span></div>
    正在评分...
</div>
```

CSS 动画（三个点依次弹跳）：

```css
.evaluating-dots span {
    animation: dot-bounce 1.4s infinite ease-in-out both;
}
```

### 2.5 调用 API 获取评分

```ts
const evaluation = await evaluateAnswerApi(
    currentQuestion.value, // 当前题目对象
    userAnswer, // 用户回答文本
    resumeStore.resumeInfo, // 简历信息（用于项目结合度评分）
    followUpContext // 追问上下文（可选）
);
```

**Mock 模式下的 `evaluateAnswerApi`**（`api/modules/ai.ts`）：

```ts
const isMock = import.meta.env.VITE_AI_MODE !== 'real';

export async function evaluateAnswerApi(...args) {
    if (isMock) return mockEvaluateAnswer(...args); // ← 走这里
    // real 模式会发 HTTP POST 到 /api/interview/evaluate
}
```

**`mockEvaluateAnswer`**（`api/mock/index.ts`）：

```ts
export async function mockEvaluateAnswer(question, userAnswer, resumeInfo) {
  await delay(800)  // ← 模拟 AI 思考延迟 ~800ms

  const len = userAnswer.length
  const baseScore = len > 300 ? 85+random  : len > 150 ? 70+random : ...

  return {
    questionId: question.id,
    totalScore: Math.min(98, baseScore),
    accuracy: ...,
    completeness: ...,
    expression: ...,
    projectRelevance: ...,
    depth: ...,
    strengths: ['回答结构清晰', '对核心概念有较好的理解'],
    weaknesses: ['可以补充更多实际项目经验'],
    improvedAnswer: '建议结合项目经验来补充具体案例...',
    followUpQuestion: totalScore > 60 ? '能否再展开说说...' : '',
    thinking: '分析本题回答质量：回答长度250字，核心概念表述清晰...',
  }
}
```

> 在 real 模式下，这里会发送 HTTP 请求 → Flask → OpenAI API → 返回真正的 AI 评分 JSON。

**await 期间用户看到什么**：

```
┌──────────────────────────────┐
│  🤖 请解释 Vue3 的响应式原理  │  ← 面试官问题
├──────────────────────────────┤
│  👤 Vue3 使用 Proxy 实现...   │  ← 用户的回答（蓝色气泡）
├──────────────────────────────┤
│  ●●● 正在评分...             │  ← evaluating-overlay（跳动的点）
└──────────────────────────────┘
```

### 2.6 保存评分结果

```ts
interviewStore.addEvaluation(evaluation); // 存入 evaluations 数组
```

---

## 第三步：创建系统消息并启动流式输出

### 3.1 创建空壳消息

```ts
const evalMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'system',
    content: '', // ← 初始为空！
    status: 'streaming', // ← 标记为流式输出中
};
interviewStore.addMessage(evalMsg);
```

Store 中 messages 数组变成：

```
[
  ...前面的消息...,
  { id:'msg-xxx', role:'user', content:'Vue3使用Proxy...', status:'done' },
  { id:'msg-yyy', role:'system', content:'', status:'streaming' },  ← 新增空壳
]
```

### 3.2 拼接评分 Markdown

```ts
const evalText = formatEvaluation(evaluation, isFollowUpAnswer);
```

`formatEvaluation` 做的事：

```ts
function formatEvaluation(evaluation, isFollowUp) {
    // ① 思考过程块
    const thinkingBlock = evaluation.thinking ? `<thinking>\n${evaluation.thinking}\n</thinking>\n\n` : '';

    // ② 评分表格
    return `${thinkingBlock}## 📊 当前回答评分

| 维度 | 得分 |
|------|------|
| 总分 | **85** ⭐⭐⭐⭐⭐ |
| 准确性 | 95 |
| 完整性 | 95 |
| 表达能力 | 90 |
| 项目结合度 | 10 |
| 回答深度 | 85 |

**✅ 优点：**
- 覆盖了泛型的所有主要使用场景...

**⚠️ 不足：**
- 未结合项目经验...

**📝 优化建议：**
建议结合项目经验来补充...

**💬 追问：**
能否再展开说说在实际项目中你是如何应用这一知识点的？`;
}
```

此时 `evalText` 是一段约 500-1500 字符的完整 Markdown 字符串。

### 3.3 启动 simulateStream

```ts
streaming.value = true;
streamingText.value = '';

stopStreamFn = simulateStream(evalText, {
    onMessage: (chunk) => {
        streamingText.value += chunk; // 拼积木
        interviewStore.updateMessage(evalMsgId, streamingText.value, 'streaming');
        scrollToBottom();
    },
    onDone: () => {
        interviewStore.updateMessage(evalMsgId, streamingText.value, 'done');
        streaming.value = false;
        // ...后续处理（追问或下一题）
    },
});
```

---

## 第四步：`simulateStream` 内部——逐字输出的实现

```ts
function simulateStream(fullText, callbacks) {
    let index = 0; // 已输出到第几个字符
    let cancelled = false;

    function pump() {
        if (cancelled) return;
        if (index >= fullText.length) {
            callbacks.onDone?.(); // 全部输出完毕
            return;
        }

        // 切下一块（默认每次3个字符）
        const chunk = fullText.slice(index, index + 3);
        index += chunk.length;

        // 回调给调用方
        callbacks.onMessage(chunk);

        // 调度下一次（~25ms 后，带随机抖动）
        setTimeout(pump, 20 + Math.random() * 10);
    }

    setTimeout(pump, 100); // 首次延迟 100ms 模拟网络往返

    return () => {
        cancelled = true;
    }; // 返回取消函数
}
```

**时间线可视化**：

```
t=800ms   setTimeout(pump, 100) 注册
t=900ms   pump() 第1次 → onMessage("<th")  → content="<th"
t=925ms   pump() 第2次 → onMessage("ink")  → content="<think"
t=950ms   pump() 第3次 → onMessage("ing")  → content="<thinking"
t=975ms   pump() 第4次 → onMessage(">\n分") → content="<thinking>\n分"
...       ...（每 ~25ms 吐 3 个字符）
t=3000ms  全文输出完毕 → onDone()
```

---

## 第五步：每次 `onMessage` 回调触发的连锁反应

```ts
onMessage: (chunk) => {
    streamingText.value += chunk;
    interviewStore.updateMessage(evalMsgId, streamingText.value, 'streaming');
    scrollToBottom();
};
```

### 5.1 `updateMessage` 更新 Store

```ts
function updateMessage(id, content, msgStatus) {
    const msg = messages.value.find((m) => m.id === id);
    if (msg) {
        msg.content = content; // ← 原地修改 content
        if (msgStatus) msg.status = msgStatus;
        saveToStorage();
    }
}
```

**关键**：`msg.content = content` 是**直接修改已存在的对象属性**，不是替换整个对象。这很重要——VirtualChatList 的 `v-for` 用 `msg.id` 做 key，同一个 key 的元素不会重新创建，只是内容更新。

### 5.2 Pinia 响应式触发 VirtualChatList

```
messages.value 数组中的某个对象的 .content 属性变化
    │
    ▼
VirtualChatList 的深度 watch 检测到变化
  watch(() => items, () => { ... }, { deep: true, flush: 'post' })
    │
    ▼
stickToBottom=true && !userScrollingUp → scrollToBottom()
    │
    ▼
ResizeObserver 检测到该消息的 contentRect.height 变大
    │
    ▼
heightCache 更新 → offsets 重算 → 下方消息自动下移
```

### 5.3 Markdown 重新渲染

```
msg.content 变化
    │
    ▼
MarkdownRenderer 的 :content prop 变化
    │
    ▼
computed renderedHtml 重新执行：
  ① preprocessThinking(newContent)     ← 正则匹配 <thinking>
  ② md.render(preprocessed)            ← Markdown → HTML
  ③ DOMPurify.sanitize(rawHtml)        ← 安全清洗
    │
    ▼
v-html 更新 DOM
    │
    ▼
浏览器渲染新的 HTML
```

**流式过程中的部分渲染**：

```
t=900ms  content="<th"           ← Markdown 不完整，renderedHtml="&lt;th"
         用户看到："<th"（纯文本，<thinking> 还没闭合）

t=1800ms content="<thinking>\n分析..."  ← <thinking> 已闭合但内容不全
         用户看到：橙色折叠面板出现，内容还在增长中

t=2500ms content="<thinking>\n分析...\n</thinking>\n\n## 📊 评分\n| 维度 |"  ← 思考块已完整+评分表格开始
         用户看到：折叠面板可点击 + 评分表格部分渲染

t=3000ms content=完整 Markdown
         用户看到：完整折叠面板 + 完整评分表格 + 优缺点 + 优化建议
```

---

## 第六步：`onDone` 收尾

```ts
onDone: () => {
    interviewStore.updateMessage(evalMsgId, streamingText.value, 'done');
    streaming.value = false;
    streamingText.value = '';
    stopStreamFn = null;

    // 判断后续操作
    if (!isFollowUpAnswer && evaluation.followUpQuestion) {
        showFollowUpQuestion(evaluation.followUpQuestion); // → 追问流程
    } else if (isFollowUpAnswer) {
        interviewStore.clearFollowUp(currentQuestion.value!.id);
        scheduleAutoAdvance(); // → 2.5s 后自动下一题
    } else {
        scheduleAutoAdvance(); // → 2.5s 后自动下一题
    }
};
```

### 6.1 `showFollowUpQuestion`（如果有追问）

```ts
function showFollowUpQuestion(followUpText: string) {
    // ① 记录追问状态
    interviewStore.setFollowUp(currentQuestion.id, followUpText, mainAnswer);

    // ② 插入追问消息（作为面试官的新消息）
    const followUpMsg: ChatMessage = {
        role: 'interviewer',
        content: `**💬 追问：**\n${followUpText}`,
        status: 'done', // 追问不需要流式
    };
    interviewStore.addMessage(followUpMsg);
    scrollToBottom();
}
```

### 6.2 `scheduleAutoAdvance`（无追问或追问已完成）

```ts
function scheduleAutoAdvance() {
    autoAdvanceTimer = setTimeout(() => {
        if (isLastQuestion.value) {
            handleFinish(); // → 结束面试 → 生成报告
        } else {
            interviewStore.nextQuestion();
            answerText.value = '';
            showCurrentQuestion(); // → 流式输出下一道题目
        }
    }, 2500); // 2.5 秒延迟，让用户有时间看评分
}
```

---

## 完整调用链总结

```
用户按 Ctrl+Enter
│
├─ ① handleSubmit()
│   ├─ submitting = true（锁定按钮）
│   ├─ 创建 userMsg → addMessage() → Store 更新
│   │   └─ VirtualChatList watch → scrollToBottom()
│   │   └─ v-for 渲染用户气泡 → ResizeObserver 测高度
│   ├─ answerText = ''（清空输入）
│   ├─ evaluating = true（显示"正在评分..."动画）
│   │
│   ├─ ② await evaluateAnswerApi()
│   │   ├─ [Mock] mockEvaluateAnswer() → delay(800ms) → 返回评分对象
│   │   └─ [Real] HTTP POST → Flask → OpenAI → 返回评分 JSON
│   │
│   ├─ ③ addEvaluation(evaluation)（存入 Store）
│   │
│   ├─ ④ evalText = formatEvaluation(evaluation)
│   │   ├─ 拼接 <thinking> 块
│   │   └─ 拼接评分表格 Markdown
│   │
│   ├─ ⑤ 创建 evalMsg（content=""，status="streaming"）
│   │   └─ addMessage() → Store 更新
│   │       └─ VirtualChatList: v-for 渲染空消息
│   │       └─ ResizeObserver 测高度（此时为 0 或很小）
│   │
│   ├─ ⑥ simulateStream(evalText, { onMessage, onDone })
│   │   │
│   │   ├─ pump() × N 次（每次 ~25ms，吐 3 字符）
│   │   │   ├─ onMessage(chunk)
│   │   │   │   ├─ streamingText += chunk
│   │   │   │   ├─ updateMessage(id, streamingText, 'streaming')
│   │   │   │   │   └─ Store.content 变化
│   │   │   │   │       ├─ VirtualChatList deep watch → scrollToBottom()
│   │   │   │   │       ├─ ResizeObserver → heightCache 更新
│   │   │   │   │       └─ MarkdownRenderer computed → 重新渲染
│   │   │   │   └─ scrollToBottom()
│   │   │   └─ setTimeout(pump, ~25ms)
│   │   │
│   │   └─ onDone()
│   │       ├─ updateMessage(id, finalContent, 'done')
│   │       ├─ streaming = false
│   │       │
│   │       ├─ 有追问？
│   │       │   └─ showFollowUpQuestion() → 插入追问消息 → 等待用户回答
│   │       │
│   │       └─ 无追问？
│   │           └─ scheduleAutoAdvance() → 2.5s 后自动下一题
│   │
│   └─ finally: submitting = false（解锁按钮）
```

---

## 关键设计要点

| 设计点                                | 为什么这样                                                         |
| ------------------------------------- | ------------------------------------------------------------------ |
| 先插空壳消息再流式填充                | 保持消息顺序正确，不会因为 await 导致消息乱序                      |
| `updateMessage` 原地修改对象          | 避免数组元素引用变化导致 VirtualChatList 重建对应 DOM              |
| `simulateStream` 用 `setTimeout` 递归 | 每次吐一小块就 `yield` 给事件循环，页面不会卡死                    |
| 深度 watch 而非浅 watch               | items 是同一个数组引用不会变，但内部对象的 content 会变            |
| `flush: 'post'`                       | 在 DOM 更新后才触发回调，确保 ResizeObserver 拿到的是最新 DOM 尺寸 |
| `stopStreamFn = simulateStream(...)`  | 返回取消函数，组件卸载时 `onUnmounted` 调用，防止内存泄漏          |
