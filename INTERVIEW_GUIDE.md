# AI Interview Coach — 前端面试项目介绍指南

---

## 一、简历项目描述（可直接用于简历）

> **AI 面试教练（AI Interview Coach）** — 面向前端 / WebGIS 求职者的智能面试训练平台
>
> **技术栈**：Vue3 + TypeScript + Vite8 + Pinia3 + VueRouter4 + Element Plus + ECharts6 + Axios + Flask + OpenAI API
>
> **项目介绍**：独立设计并开发了一款 AI 驱动的面试训练 SPA 应用。用户上传简历后，平台调用 AI 解析为结构化数据，根据求职方向与面试模式自动生成个性化题目；采用聊天式交互进行模拟面试，AI 实时评估回答并从准确性、完整性、表达力、项目结合度、思维深度五个维度量化评分，支持智能追问以模拟真实面试压力；最终生成五维能力雷达图与逐题回顾报告。后端基于 Flask 封装 OpenAI 兼容协议，实现流式 SSE 推送与三级降级 JSON 解析。
>
> **项目亮点**：自研 SSE 流式客户端（处理 TCP 分片半包/沾包与多字节字符截断）；追问机制的状态机设计（followUpStates + 计算属性驱动复杂面试流程）；AI JSON 输出的三级降级鲁棒解析（应对 DeepSeek 思考模式污染）；Pinia Store 全链路 localStorage 持久化（面试中途刷新零丢失）；Mock/Real 双模式架构解耦前后端开发。

---

## 二、技术难点深入拆解

### 难点 1：SSE 流式数据 —— TCP 分片导致的半包/沾包与多字节字符截断

#### 问题本质

基于 `fetch` + `ReadableStream` 实现 SSE 客户端时，`reader.read()` 每次返回的 `Uint8Array` chunk 边界由底层 TCP 协议决定，与 SSE 消息的 `\n\n` 逻辑边界完全无关。这导致三种经典问题：

| 问题 | 场景 | 示例 |
|------|------|------|
| **半包** | 一条 SSE 消息被切分到两个 TCP chunk | chunk1 结尾是 `"con`，chunk2 开头是 `tent":"你好"}\n\n` |
| **沾包** | 多个 SSE 消息在一个 chunk 中 | 一个 chunk 包含 `data: {...}\n\ndata: {...}\n\n` |
| **多字节字符截断** | 中文字符（UTF-8 3字节）的某个字节被切到下一个 chunk | `你` 的 UTF-8 编码 `\xe4\xbd\xa0` 被 `\xe4\xbd` + `\xa0...` 切分 |

简单按 `\n` split 不做缓冲处理的方案会直接丢数据或产生乱码。

#### 解决方案

**1. 维护缓冲区（Buffer）+ 尾部保留策略**

核心思路：每次收到 chunk 先拼接到 buffer，按 `\n` split 成行数组，**最后一行（可能不完整）保留在 buffer 中等待下次补全**，只处理已确认完整的行。

```ts
let buffer = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // stream: true 保证 UTF-8 多字节字符不被截断
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''  // 最后一行可能不完整，保留
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') { onDone(); return }
      // ... 处理 data
    }
  }
}
```

**2. TextDecoder 流模式防止多字节字符截断**

`TextDecoder.decode(value, { stream: true })` 中的 `stream: true` 参数告诉解码器"还有后续数据"，解码器会在内部维护状态，暂存不完整的字节序列，等待后续 chunk 补全后再输出完整字符。这是 W3C Encoding 标准规定的行为。

```
// ❌ 错误做法：stream: false（默认），每个 chunk 独立解码
decoder.decode(chunk)  // \xe4\xbd 无法解码为任何字符 → 输出乱码 U+FFFD

// ✅ 正确做法：stream: true，解码器暂存不完整字节
decoder.decode(chunk, { stream: true })  // \xe4\xbd 暂存，等待下一个 chunk 的 \xa0
```

**3. 数据格式兼容层**

不同后端 SSE 实现可能使用不同字段名（`content` / `text` / `delta`），或直接发送纯文本而非 JSON。通过优先级尝试解析：

```ts
try {
  const parsed = JSON.parse(data)
  const content = parsed.content || parsed.text || parsed.delta || ''
  if (content) callbacks.onMessage(content)
} catch {
  // JSON 解析失败 → 降级为纯文本传递
  callbacks.onMessage(data)
}
```

**4. 资源生命周期管理**

- `AbortController`：返回 controller 给调用方，组件卸载时 `controller.abort()` 取消请求，`reader.read()` 抛出 `AbortError`，在 catch 中静默处理
- `reader.releaseLock()`：在 `finally` 块中释放读取器锁，防止 ReadableStream 被锁定导致内存泄漏
- `stopStreamFn`：用于中断本地模拟流（`simulateStream`），组件 `onUnmounted` 时调用

#### 延伸价值

这套 SSE 封装不依赖任何第三方库（如 `event-source-polyfill`、`@microsoft/fetch-event-source`），完全自研，代码约 150 行。可以在面试中体现出对 **网络协议底层行为**（TCP 流式传输、UTF-8 编码特性）和 **浏览器 Streams API** 的深度理解。

---

### 难点 2：追问机制的状态管理 —— 非线性面试流程的建模

#### 问题本质

常规 Q&A 是线性流程：`问 → 答 → 评 → 下一题`。但模拟真实面试时，AI 需要在评分后决定是否追问，追问后还可能再追问，导致面试流程变为一个有向图：

```
主问题 → 回答 → 评分 → [优秀] → 下一题
                       → [一般] → 追问 → 回答 → 追问评分 → [仍不足] → 再追问
                                                              → [通过] → 下一题
                       → [太差] → 给出参考答案 → 下一题
```

这引入了三个核心挑战：
- "当前题是否完成"的判断逻辑变复杂（需同时检查主评分 + 无活跃追问）
- UI 状态（输入框提示文案、按钮行为、进度条）需根据追问状态动态切换
- 追问评分需要携带上下文（原始主答案），否则 AI 无法正确评估追问回答

#### 解决方案

**1. 追问状态数据结构设计**

```ts
// 以 questionId 为 key，存储追问问题文本 + 主答案文本
followUpStates: Record<string, { question: string; mainAnswer: string }> = {}

// 追问的生命周期：
setFollowUp(questionId, '请解释为什么选择 Pinia 而不是直接用 reactive？', userMainAnswer)
// → UI 展示追问 → 用户回答 → 评分
clearFollowUp(questionId)
// → 追问完成，允许推进到下一题
```

选择 `Record<questionId, {...}>` 而非 Array 的原因：
- O(1) 查找：通过 questionId 直接判断是否有活跃追问
- 天然去重：同一题目不可能同时存在两个活跃追问
- 序列化友好：`JSON.stringify` 直接持久化到 localStorage

**2. 计算属性驱动 UI 状态切换**

```ts
// 当前题是否有活跃的（未回答的）追问
const hasActiveFollowUp = computed(() => {
  const q = currentQuestion.value
  if (!q) return false
  return q.id in followUpStates.value
})

// 当前题是否完全完成（有评分 AND 无活跃追问）
const hasCurrentAnswer = computed(() => {
  const q = currentQuestion.value
  if (!q) return true
  const hasEval = evaluations.some(e => e.questionId === q.id)
  return hasEval && !hasActiveFollowUp.value
})
```

这两个计算属性分别驱动：
- `hasActiveFollowUp` → 输入框 placeholder 切换为"请回答追问" + 追问提示条显示
- `hasCurrentAnswer` → 决定显示输入区还是"下一题"按钮
- 进度条中题目状态图标（已回答/已跳过/当前/未答）

**3. 追问评分的上下文传递**

追问评分不能只传追问问题和追问答案，还需要传原始主答案——否则 AI 不知道用户在"什么基础上"被追问：

```ts
const followUpContext = {
  isFollowUp: true,
  followUpQuestion: '为什么选择 Pinia 而不是直接用 reactive 全局对象？',
  mainAnswer: '我在项目中使用了 Pinia 进行状态管理...'  // 原始主答案
}

const evaluation = await evaluateAnswerApi(
  currentQuestion,
  userAnswer,       // 追问的回答
  resumeInfo,
  followUpContext   // 上下文
)
```

后端提示词中区分主问题评分和追问评分：

```
如果用户消息中有「追问环节」标记 → 围绕追问内容评分
追问评分的 improvedAnswer 应给出更有深度的参考答案
追问回答满意 → followUpQuestion 置空；不满意 → 可再次追问
```

**4. 跳过与自动推进的边界处理**

- 跳过追问：视为"追问不会"，评 0 分，`clearFollowUp` 后进入下一题
- 跳过主问题：直接 0 分 + 展示参考答案，不产生追问
- 自动推进：主问题评分后 2.5s 延迟 → 展示追问或下一题；追问评分后立即 → 下一题

---

### 难点 3：AI JSON 输出的鲁棒解析 —— 应对大模型非结构化输出

#### 问题本质

调用 OpenAI 兼容 API 要求 AI 输出纯 JSON，但实际生产环境中存在以下问题：

1. **DeepSeek V4 默认启用思考模式（Thinking Mode）**：模型会在 `content` 中先输出一段中文推理过程（`reasoning_content`），然后才输出 JSON
2. **Markdown 代码块包裹**：部分模型习惯用 ` ```json ... ``` ` 包裹输出
3. **JSON 前后附加文本**："好的，以下是生成的题目：{...}" 或 "{...}以上就是全部内容"
4. **嵌套 JSON 中的特殊字符**：字符串值中包含 `{`、`}`、`"` 需要正确处理

直接 `json.loads()` 在场景 1/3/4 都会抛出 `JSONDecodeError`。

#### 解决方案

设计三级降级提取策略，按成功率从高到低依次尝试：

**第一级：直接解析（最常见、最可靠）**
```py
try:
    return json.loads(text)
except json.JSONDecodeError:
    pass
```
适用于 GPT-4o 等原生支持 JSON Mode 的模型。

**第二级：正则提取 Markdown 代码块**
```py
match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
if match:
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        pass
```
`re.DOTALL` 保证 `.` 匹配换行符；`(?:json)?` 兼容有无 `json` 语言标记。

**第三级：括号平衡匹配（最鲁棒但最复杂）**

手动实现一个简易状态机，遍历字符处理三种状态：是否在字符串内（`in_string`）、是否转义字符（`escape`）、嵌套深度（`depth`）。

```py
start = text.find("{")
depth = 0
in_string = False
escape = False
for i in range(start, len(text)):
    ch = text[i]
    if escape:
        escape = False
        continue
    if ch == "\\":
        escape = True
        continue
    if ch == '"':
        in_string = not in_string
        continue
    if in_string:
        continue
    if ch == "{":
        depth += 1
    elif ch == "}":
        depth -= 1
        if depth == 0:
            candidate = text[start:i + 1]
            return json.loads(candidate)
```

关键设计点：
- `in_string` 标记确保不把字符串值内部的 `{}` 误认为 JSON 结构边界
- `escape` 标记处理 `\"` 转义引号，避免 `in_string` 状态错误翻转
- `depth` 追踪大括号嵌套层级，`depth == 0` 表示找到了最外层完整 JSON

**额外防护：DeepSeek 思考模式禁用**

在 API 调用层主动检测：
```py
base = (Config.AI_API_BASE or "").lower()
if "deepseek" in base:
    params["extra_body"] = {"thinking": {"type": "disabled"}}
```
在源头减少非结构化输出的概率。

#### 延伸思考

这套解析策略本质是一个**容错解析器**（Fault-Tolerant Parser）。在做 AI 应用时，"要求 AI 输出严格格式"是理想情况，但"在 AI 输出不完美时也能正确提取"才是工程落地的关键。这体现了**防御性编程**的思路。

---

### 难点 4：Pinia Store 的全链路 localStorage 持久化 —— 面试进度的完整恢复

#### 问题本质

面试是一个长流程（配置 → 出题 → 答题 × N → 追问 → 报告），中途可能发生：
- 用户误刷新页面（F5 / Ctrl+R）
- 浏览器崩溃恢复
- 移动端切后台被系统回收

如果状态丢失，用户需要从头配置、重新出题，体验极差。

#### 解决方案

**1. 序列化时机策略**

不是用 `watch` 自动监听（可能触发过于频繁），而是**在每个 mutation 方法中手动调用 `saveToStorage()`**：

```ts
function setQuestions(qs: InterviewQuestion[]) {
  questions.value = qs
  currentQuestionIndex.value = 0
  evaluations.value = []
  // ... 其他状态重置
  saveToStorage()  // 每个状态变更点都保存
}

function addEvaluation(eval_: AnswerEvaluation) {
  evaluations.value.push(eval_)
  saveToStorage()
}
```

这样序列化时机完全可控，避免深度 watch 带来的性能开销和不必要的序列化。

**2. 反序列化时机与容错**

```ts
function loadFromStorage() {
  const stored = localStorage.getItem('interview-session')
  if (stored) {
    try {
      const session: InterviewSession = JSON.parse(stored)
      config.value = session.config
      // ...逐字段恢复
      followUpStates.value = session.followUpStates || {}
    } catch {
      resetSession()  // 数据损坏 → 安全回退
    }
  }
}
```

- 只在 `onMounted` 时调用一次，不在 `watch` 中自动加载（避免覆盖当前状态）
- `try-catch` 包裹，解析失败时静默回退到初始状态，不影响正常使用
- `followUpStates || {}` 向后兼容旧版本数据（新增字段给默认值）

**3. 数据清理策略**

提供 `resetSession()` 清除 localStorage + 重置所有状态，面试结束后或用户主动重置时调用。

**4. 多 Store 独立管理**

四个核心 Store（resume、interview、report、mistake）各自独立管理自己的 localStorage key，互不干扰，按需加载。

---

### 难点 5：前端架构中的 Mock/Real 双模式设计 —— 前后端解耦并发开发

#### 问题本质

前端开发依赖 AI 接口，但 AI 接口：
- 需要稳定的网络和 API Key
- 每次调用有费用成本
- 响应时间不可控（3-15 秒）
- 返回格式不稳定

如果前端紧耦合后端，开发阶段效率极低。

#### 解决方案

**1. 模式切换机制**

```ts
// src/api/modules/ai.ts
const isMock = import.meta.env.VITE_AI_MODE !== 'real'

export async function parseResumeApi(rawText: string): Promise<ResumeInfo> {
  if (isMock) return mockParseResume(rawText)
  const res = await request.post('/resume/parse', { rawText })
  return res.resumeInfo as ResumeInfo
}
```

通过 Vite 环境变量 `VITE_AI_MODE` 控制，**构建时决定**而非运行时判断，Mock 代码在 `VITE_AI_MODE=real` 时会被 Tree Shaking 掉。

**2. API 层统一接口签名**

所有 API 函数保持相同的参数和返回值类型，Mock 实现和 Real 实现**签名完全一致**，调用方（页面组件）完全无感知：

```ts
// 调用方代码在两种模式下完全一样
const questions = await generateQuestionsApi(resumeInfo, config)
```

**3. Mock 数据的真实感设计**

- 延迟模拟：`await delay(500 + Math.random() * 400)` 随机 500-900ms
- 关键词匹配：30+ 技术关键词预定义，从粘贴文本中提取匹配的技能
- 按模式分题库：不同 `interviewMode` 对应不同题型组合

---

## 三、项目亮点深入拆解

### 亮点 1：完整的 AI 面试闭环系统

从 **简历解析 → 结构化存储 → 配置选择 → AI 出题 → 聊天式答题 → 五维评分 → 追问机制 → 能力雷达图 → 错题本复习** 形成完整闭环。这不是一个简单的 "调 API 聊天" 应用，而是有完整数据流、状态管理和领域建模的产品。

**分层架构设计**：

```
┌─────────────────────────────────────────────┐
│  View 层    │ 9 个页面 + 4 个业务组件        │
├─────────────────────────────────────────────┤
│  Store 层   │ Pinia × 4（resume / interview │
│             │ / report / mistake）           │
├─────────────────────────────────────────────┤
│  API 层     │ 统一接口 + Mock/Real 双模式    │
├─────────────────────────────────────────────┤
│  Service 层 │ Flask + OpenAI 协议封装        │
├─────────────────────────────────────────────┤
│  AI 层      │ GPT-4o / DeepSeek 兼容接口    │
└─────────────────────────────────────────────┘
```

### 亮点 2：TypeScript 类型系统全覆盖

所有数据结构从简历（`ResumeInfo`、`ResumeProject`）到面试（`InterviewConfig`、`InterviewQuestion`、`ChatMessage`、`AnswerEvaluation`、`InterviewSession`）再到报告（`InterviewReport`、`AbilityScores`、`QuestionReview`）均有完整类型定义，且类型之间有明确的引用关系（如 `AnswerEvaluation.questionId` 关联 `InterviewQuestion.id`）。

`InterviewSession` 是整个系统的核心聚合类型，包含了配置、简历快照、题目列表、消息列表、评估列表、追问状态、进度索引和生命周期状态。

### 亮点 3：ECharts 五维能力雷达图

不是简单引入图表库画个图，而是做了以下工程化处理：
- `watch` 监听 `abilityScores` 变化自动更新图表，避免手动 `setOption`
- `window.resize` 事件监听，图表随窗口自适应
- `onUnmounted` 中 `chartInstance.dispose()` 销毁实例，防止内存泄漏
- 雷达图配置（颜色、透明度、线宽、最大值）提取为常量化参数

### 亮点 4：Prompt Engineering 的系统化管理

所有 AI 提示词集中在 `backend/prompts.py` 单一文件中，每个提示词包含：
- 角色定义（"你是一位资深技术面试官"）
- 详细的评分/出题规则
- 嵌入 JSON Schema 示例（AI 直接参照格式输出）
- 错误处理指引（如"不会"→ 0 分、"答非所问"→ ≤30 分）
- 边界条件说明（如追问与主问题的评分差异）

这种集中管理方式的好处是：提示词调优时只需修改一个文件，不需要在多个路由文件中搜索替换。

### 亮点 5：追问中的提示词上下文传递

追问评分时，后端收到 `followUpContext: { isFollowUp: true, followUpQuestion, mainAnswer }`，在 prompt 中拼接：

```
【追问环节】
原始问题：...
候选人主回答：...
面试官追问：...
候选人追问回答：...
请围绕追问内容进行评分...
```

这种方式让 AI 评分时有完整的上下文链条，而不是孤立地评判追问回答。

### 亮点 6：Element Plus 国际化 + 全图标注册

```ts
// main.ts
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

app.use(ElementPlus, { locale: zhCn })
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
```

全局注册后，模板中可直接使用任意 Element Plus 图标组件，无需逐个 import。

---

## 四、可补充的进阶话题（面试官追问时展开）

| 方向 | 可展开内容 |
|------|-----------|
| **性能优化** | 1. `shallowRef` 用于题库大数组避免深度响应式开销；2. ECharts `echarts.init` 只在 `onMounted` 执行一次，数据变化用 `setOption` 增量更新而非重建实例；3. 路由懒加载（`() => import(...)`）天然支持 code splitting |
| **安全性** | 1. API Key 通过 `.env` 环境变量管理，不提交 Git；2. 简历文本长度限制 15000 字符（后端校验 `MAX_REQUEST_TOKENS`）；3. 前端不做敏感数据的二次处理 |
| **可测试性** | Mock 模式本身就是一种集成测试：不依赖后端即可验证完整的用户交互流程 |
| **扩展性** | 1. 题库 `questionBank.ts` 纯数据文件，追加数组项即可扩展；2. 面试模式 `interviewMode` 和难度 `difficulty` 是字符串枚举，新增模式无需改数据结构；3. Prompt 集中管理，新增面试类型只需增加一个 prompt 模板 |
| **工程化** | `unplugin-auto-import` 自动导入 Vue API（`ref`、`computed` 等），`unplugin-vue-components` 自动导入 Element Plus 组件，减少 60%+ 的 import 语句 |
| **用户体验** | 流式输出模拟打字机效果、评分等待 Loading 动画、跳过/提示按钮降低使用门槛、Ctrl+Enter 快捷提交 |

---

## 五、面试可能被追问的问题及回答思路

### Q1：为什么选择 Pinia 而不是 Vuex？

> Pinia 是 Vue3 官方推荐的状态管理库，相比 Vuex4：
> - 完全的 TypeScript 类型推导，无需额外的类型声明
> - 去掉 Mutation，直接用函数修改状态，概念更简单
> - 支持多个 Store，天然按模块拆分（本项目 4 个独立 Store）
> - Composition API 风格的 `defineStore`，和 Vue3 开发模式统一
> - 更好的 DevTools 支持和 Tree Shaking

### Q2：SSE 和 WebSocket 的选择？

> 本项目的 AI 流式输出场景是**单向推送**（服务端→客户端），SSE 更合适：
> - SSE 基于 HTTP，无需额外协议升级，部署简单（Nginx 无需特殊配置）
> - 浏览器原生支持 `EventSource` / `fetch + ReadableStream`
> - 自动重连机制（`EventSource` 内置）
> - 面试场景不需要客户端频繁向服务端发送数据（不像聊天室），不需要 WebSocket 的双工通道
>
> 本项目中我选择 `fetch + ReadableStream` 而非 `EventSource`，因为 `EventSource` 只支持 GET 请求且无法自定义请求头、无法传 JSON Body。

### Q3：localStorage 有 5MB 限制，面试数据会超吗？

> 单个面试会话的核心数据（题目 + 消息 + 评分）约 50-200KB，5MB 足够存储 25-100 次完整会话。如果后续需要更大存储，可以：
> - 消息列表改用 IndexedDB（无上限、支持索引查询）
> - 将历史会话持久化到后端数据库
> - localStorage 仅保留最近一次未完成的会话，历史数据走 API

### Q4：如何处理 AI 接口超时或失败？

> 当前设计了三层兜底：
> 1. Axios 30s 超时（`timeout: 30000`）
> 2. 评分失败 → `ElMessage.error` 提示用户重试
> 3. 报告生成失败 → 前端 `generateLocalReport()` 基于已有评分数据本地生成报告
>
> 还有一个 `VITE_AI_MODE=mock` 的开发模式作为终极 fallback。

### Q5：追问会无限递归吗？

> 不会。追问目前限制为一轮：追问回答评分后 `clearFollowUp()` 清除状态，不会再次生成追问。如果后续需要多轮追问，可以在 Store 中维护 `followUpDepth` 计数器，超过阈值（如 3 轮）强制结束。

---

## 六、项目架构全景图

```
                              ┌──────────────┐
                              │   用户浏览器   │
                              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
              ┌─────▼─────┐  ┌──────▼──────┐  ┌─────▼─────┐
              │   Vue 3    │  │   Pinia     │  │  Vue      │
              │   SPA      │  │   Stores    │  │  Router   │
              └─────┬─────┘  └──────┬──────┘  └───────────┘
                    │                │
              ┌─────▼─────┐  ┌──────▼──────┐
              │  Axios +   │  │ localStorage│
              │  SSE Utils │  │  持久化      │
              └─────┬─────┘  └─────────────┘
                    │
         VITE_AI_MODE = mock?
              ┌─────┴─────┐
              │           │
           Mock 数据    HTTP /api/*
                        │
              ┌─────────▼─────────┐
              │  Vite Proxy       │
              │  :5173 → :5000    │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │  Flask App        │
              │  ├─ /api/resume   │
              │  ├─ /api/interview│
              │  ├─ /api/project  │
              │  └─ /api/chat     │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │  ai_service.py    │
              │  - chat_completion│
              │  - json 三级解析  │
              │  - stream 生成器  │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │  OpenAI 兼容 API  │
              │  (GPT-4o/DeepSeek)│
              └───────────────────┘
```

---

## 七、关键代码量统计（估算）

| 模块 | 文件 | 估算行数 | 说明 |
|------|------|---------|------|
| SSE 流式工具 | `sse.ts` | ~200 | 自研，含完整注释 |
| 面试核心页面 | `MockInterview.vue` | ~700 | 最复杂的页面 |
| 面试 Store | `interview.ts` | ~200 | 追问状态机核心 |
| AI 服务封装 | `ai_service.py` | ~160 | 三级 JSON 解析 + 流式 |
| 提示词管理 | `prompts.py` | ~250 | 6 个 prompt 模板 |
| 题库数据 | `questionBank.ts` | ~500 | 13 分类 |
| TypeScript 类型 | `types/*.ts` | ~120 | 完整类型体系 |
| **总计** | | **~2500+** | 核心业务代码 |

---

*本文档用于面试准备，涵盖项目介绍、技术难点、架构设计和常见追问。建议结合代码实际阅读，形成自己的理解和表达。*
