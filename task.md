
**AI Interview Coach**

技术栈暂定：

Vue3 + TypeScript + Vite + Pinia + Vue Router + Element Plus + Axios + ECharts + Markdown 渲染 + SSE 流式输出。

按照下面流程逐步生成代码
---

# 阶段一：项目基础搭建

## 任务 1：初始化 Vue3 + TS 项目结构

目标是先搭好项目骨架，不做具体业务。

交给 agent 的任务：

```text
请基于 Vue3 + TypeScript + Vite 初始化一个 AI 面试训练平台项目。

技术栈要求：
1. Vue3 + TypeScript + Vite
2. Vue Router
3. Pinia
4. Element Plus
5. Axios
6. ECharts
7. markdown-it 或其他 Markdown 渲染库
8. highlight.js 或 shiki 用于代码高亮

请完成以下内容：
1. 整理 src 目录结构
2. 配置路由
3. 配置 Pinia
4. 配置 Element Plus
5. 配置 axios 基础封装
6. 创建基础 Layout，包括左侧菜单、顶部栏、主内容区
7. 创建以下空页面：
   - Dashboard 首页
   - Resume 简历管理页
   - InterviewConfig 面试配置页
   - MockInterview 模拟面试页
   - ProjectCoach 项目深挖页
   - KnowledgeTraining 知识点训练页
   - InterviewReport 面试报告页
   - MistakeBook 错题本页
   - Settings 设置页

要求：
- 使用 Composition API
- 使用 script setup
- 所有页面先用占位内容
- 保证 npm run dev 可以正常启动
```

这一阶段完成后，你应该得到一个可以正常打开、有侧边栏、有路由跳转的空项目。

---

# 阶段二：定义核心数据类型和状态管理

## 任务 2：设计 TypeScript 类型和 Pinia Store

这一步非常重要，后面所有页面都依赖这些数据结构。

交给 agent 的任务：

```text
请为 AI 面试训练平台设计核心 TypeScript 类型和 Pinia 状态管理。

需要新增 types 文件，例如：
src/types/resume.ts
src/types/interview.ts
src/types/report.ts
src/types/knowledge.ts

至少包含以下类型：

1. ResumeInfo
- name
- targetRole
- education
- skills
- projects
- experiences
- rawText

2. ResumeProject
- id
- name
- role
- techStack
- description
- highlights
- difficulties
- result

3. InterviewConfig
- targetRole
- interviewMode
- difficulty
- questionCount
- focusAreas

4. InterviewQuestion
- id
- question
- type
- tags
- difficulty
- source
- relatedProjectId
- referenceAnswer

5. ChatMessage
- id
- role: interviewer/user/system
- content
- createdAt
- questionId
- status

6. AnswerEvaluation
- questionId
- totalScore
- accuracy
- completeness
- expression
- projectRelevance
- depth
- strengths
- weaknesses
- improvedAnswer
- followUpQuestion

7. InterviewSession
- id
- config
- resumeSnapshot
- questions
- messages
- evaluations
- currentQuestionIndex
- status
- createdAt
- finishedAt

8. InterviewReport
- sessionId
- totalScore
- abilityScores
- strengths
- weaknesses
- suggestedTopics
- questionReviews

同时创建 Pinia stores：
1. useResumeStore
2. useInterviewStore
3. useReportStore
4. useMistakeStore

要求：
- 支持 localStorage 持久化
- 暂时不接后端
- 提供基础的 set / update / clear 方法
- 代码结构清晰，方便后续页面调用
```

这一阶段完成后，项目虽然还没有业务页面，但数据结构已经稳定了。

---

# 阶段三：简历管理模块

## 任务 3：实现简历上传、粘贴和结构化编辑页面

第一版不要直接追求 PDF 智能解析，可以先支持“粘贴文本 + 上传 txt/md”。PDF 解析可以后面做。

交给 agent 的任务：

```text
请实现 Resume 简历管理页面。

页面功能：
1. 支持用户粘贴简历文本
2. 支持上传 .txt 和 .md 文件并读取文本内容
3. 左侧展示原始简历文本
4. 右侧展示结构化简历信息表单
5. 用户可以手动编辑以下字段：
   - 姓名
   - 求职方向
   - 教育经历
   - 技术栈
   - 项目经历
   - 实习经历
6. 项目经历支持动态新增、删除、编辑
7. 点击“保存简历信息”后写入 useResumeStore
8. 页面刷新后可以从 localStorage 恢复

暂时不接 AI 解析，先提供一个“模拟解析”按钮：
- 点击后根据简单规则从原始文本中生成一些 mock 结构化数据
- 例如识别 Vue、TypeScript、OpenLayers、Cesium、ECharts 等关键词作为 skills

要求：
- 使用 Element Plus 表单组件
- 表单结构清晰
- 项目经历使用可折叠面板或卡片展示
- 保证类型安全
```

这一步完成后，用户可以把自己的简历内容放进系统，并形成后续面试用的数据。

---

# 阶段四：面试配置模块

## 任务 4：实现岗位、模式、难度、题目数量配置页面

交给 agent 的任务：

```text
请实现 InterviewConfig 面试配置页面。

页面功能：
1. 选择目标岗位：
   - 前端开发工程师
   - Vue 开发工程师
   - WebGIS 开发工程师
   - AI 前端应用开发工程师
   - 实习 / 校招前端岗位

2. 选择面试模式：
   - 技术基础面试
   - 项目深挖面试
   - 八股文训练
   - 场景题训练
   - 综合模拟面试

3. 选择难度：
   - 简单
   - 中等
   - 困难

4. 选择题目数量：
   - 5
   - 10
   - 15

5. 选择重点考察方向：
   - HTML/CSS
   - JavaScript
   - TypeScript
   - Vue3
   - 工程化
   - HTTP/浏览器
   - 性能优化
   - WebGIS
   - Three.js
   - Cesium
   - OpenLayers
   - 项目表达

6. 点击“生成面试题”后：
   - 暂时生成 mock 题目
   - 写入 useInterviewStore
   - 跳转到 MockInterview 页面

要求：
- 如果没有简历信息，需要提示用户先去 Resume 页面完善简历
- mock 题目需要根据岗位和考察方向生成不同类型的问题
- 每道题需要包含 tags、difficulty、type、source 字段
```

这一阶段完成后，面试训练流程已经可以从“简历 → 配置 → 题目”走通。

---

# 阶段五：模拟面试主页面

## 任务 5：实现模拟面试对话页面

这是 MVP 的核心页面。

交给 agent 的任务：

```text
请实现 MockInterview 模拟面试页面。

页面布局：
1. 左侧：面试进度面板
   - 当前第几题 / 总题数
   - 当前题目标签
   - 当前难度
   - 已完成题目列表

2. 中间：对话区域
   - AI 面试官问题
   - 用户回答
   - AI 反馈
   - 支持自动滚动到底部

3. 底部：回答输入区
   - 多行文本输入
   - 提交回答按钮
   - “我不会”按钮
   - “查看提示”按钮
   - “下一题”按钮

4. 右侧：当前题目辅助信息
   - 考察点
   - 参考思路
   - 当前评分结果

流程要求：
1. 进入页面后显示第一道题
2. 用户输入回答后点击提交
3. 系统生成 mock 评分反馈
4. 显示评分卡
5. 用户点击下一题进入下一道题
6. 所有题目完成后，生成 mock 面试报告并跳转 InterviewReport 页面

暂时不接真实 AI。
要求：
- 所有对话消息保存到 useInterviewStore
- 支持刷新后恢复当前面试进度
- 页面交互要像真实聊天界面
- 回答为空时不能提交
```

这一阶段完成后，哪怕没有真实 AI，项目也已经是一个完整的面试训练产品雏形。

---

# 阶段六：评分卡和报告页面

## 任务 6：实现回答评分卡和面试报告页面

交给 agent 的任务：

```text
请实现回答评分卡组件和 InterviewReport 面试报告页面。

需要新增组件：
1. ScoreCard.vue
2. AbilityRadarChart.vue
3. QuestionReviewList.vue

ScoreCard 展示内容：
- 总分
- 准确性
- 完整性
- 表达能力
- 项目结合度
- 回答深度
- 优点
- 不足
- 优化后的参考回答

InterviewReport 页面展示内容：
1. 本次面试基础信息
   - 岗位
   - 模式
   - 难度
   - 题目数量
   - 完成时间

2. 总体评分
   - totalScore
   - ECharts 雷达图展示各能力维度

3. 优势总结

4. 薄弱点总结

5. 推荐复习方向

6. 每道题复盘
   - 问题
   - 用户回答
   - 分数
   - AI 建议
   - 参考答案

7. 支持导出 Markdown
   - 点击按钮后生成 .md 文件下载

要求：
- ECharts 封装成独立组件
- 页面数据来自 useReportStore 或 useInterviewStore
- 没有报告数据时提示用户先完成一次模拟面试
```

这一阶段完成后，MVP 的闭环就完整了：

**简历 → 面试配置 → 模拟面试 → 回答评分 → 面试报告**

---

# 阶段七：API 封装和 Mock / Real 模式切换

## 任务 7：封装 AI API 调用层

在真正接 AI 之前，先把 API 层抽象出来，这样后面不会把业务页面写乱。

交给 agent 的任务：

```text
请为项目封装 AI API 调用层，支持 mock 模式和 real 模式切换。

新增目录：
src/api/modules/ai.ts
src/api/modules/resume.ts
src/api/modules/interview.ts
src/api/modules/report.ts
src/api/mock/

需要实现以下方法：

1. parseResumeApi(rawText: string)
返回结构化 ResumeInfo

2. generateQuestionsApi(resumeInfo, interviewConfig)
返回 InterviewQuestion[]

3. evaluateAnswerApi(question, userAnswer, resumeInfo)
返回 AnswerEvaluation

4. generateReportApi(session)
返回 InterviewReport

5. polishResumeProjectApi(project)
返回优化后的项目描述

6. generateProjectQuestionsApi(project)
返回项目深挖问题列表

要求：
- 默认使用 mock 数据
- 通过环境变量 VITE_AI_MODE=mock 或 real 切换
- real 模式下调用 axios 请求后端接口
- mock 模式下返回 Promise，模拟网络延迟
- 页面中不能直接写死 mock 数据，必须统一通过 api 方法调用
```

这一阶段完成后，项目就具备了接真实 AI 后端的基础。

---

# 阶段八：接入真实 AI 和 SSE 流式输出

## 任务 8：实现 SSE 流式输出工具和聊天流式渲染

这一步是项目的技术亮点，但建议放在 MVP 跑通之后。

交给 agent 的任务：

```text
请为项目实现 SSE / fetch stream 流式输出能力，并接入 MockInterview 页面。

需要新增：
src/utils/sse.ts 或 src/utils/stream.ts

功能要求：
1. 封装 streamRequest 方法
2. 支持 POST 请求
3. 支持逐段接收文本
4. 支持 onMessage / onError / onDone 回调
5. 支持 AbortController 中断请求
6. 支持请求失败后的错误提示
7. 支持前端手动停止生成

在 MockInterview 页面中：
1. AI 面试官的问题可以流式输出
2. AI 评分反馈可以流式输出
3. 输出过程中显示 loading 状态
4. 输出过程中禁止重复提交
5. 用户可以点击“停止生成”
6. 流式文本支持 Markdown 渲染

要求：
- 保留 mock 模式
- 如果后端暂时没有 SSE 接口，可以先模拟流式输出
- 不要破坏原来的非流式流程
```

这一阶段完成后，你就可以在面试里讲：

“我实现了 AI 流式输出，使用 fetch stream / SSE 逐段渲染模型返回内容，并处理了中断、错误重试和 Markdown 渲染。”

---

# 阶段九：Markdown 渲染和代码高亮

## 任务 9：实现 AI 回答的 Markdown 渲染组件

交给 agent 的任务：

```text
请实现一个通用 MarkdownRenderer 组件，用于渲染 AI 输出内容。

功能要求：
1. 支持 Markdown 基础语法
2. 支持代码块高亮
3. 支持表格
4. 支持列表
5. 支持 inline code
6. 支持复制代码按钮
7. 适配聊天消息样式
8. 在 MockInterview、InterviewReport、ProjectCoach 中复用

注意：
- 需要考虑流式输出时 Markdown 不完整的情况
- 即使 Markdown 格式暂时不闭合，也不能导致页面报错
- 样式要和 Element Plus 页面风格统一
```

这个任务能展示你对 AI 前端细节的理解，尤其是“流式 Markdown 不完整时如何渲染”。

---

# 阶段十：项目深挖助手

## 任务 10：实现 ProjectCoach 项目深挖页面

这个模块很适合你自己准备面试，也很适合作为项目特色。

交给 agent 的任务：

```text
请实现 ProjectCoach 项目深挖页面。

页面功能：
1. 从 useResumeStore 中读取项目经历
2. 用户选择一个项目
3. 展示项目基础信息
4. 提供以下功能按钮：
   - 生成 1 分钟项目介绍
   - 生成 3 分钟项目介绍
   - 提炼技术亮点
   - 生成可能追问
   - 生成项目难点回答
   - 优化项目描述

5. 每个功能先调用 mock API，后续可切换真实 AI API

页面展示内容：
1. 项目介绍版本
2. 技术亮点列表
3. 高频追问题目
4. 推荐回答
5. 项目描述优化前后对比

要求：
- 使用卡片布局
- 支持复制生成结果
- 支持将某个追问加入错题本
- 支持将优化后的项目描述写回简历 Store
```

这个页面可以重点围绕你的 WebGIS / Three.js / Cesium 项目来做，很容易做出个人特色。

---

# 阶段十一：知识点训练模块

## 任务 11：实现 KnowledgeTraining 知识点训练页面

交给 agent 的任务：

```text
请实现 KnowledgeTraining 知识点训练页面。

功能要求：
1. 按知识分类展示题库：
   - HTML/CSS
   - JavaScript
   - TypeScript
   - Vue3
   - Pinia
   - HTTP/浏览器
   - 性能优化
   - 前端工程化
   - WebGIS
   - Three.js
   - Cesium
   - OpenLayers
   - AI 前端应用

2. 用户点击分类后显示题目列表

3. 每道题支持：
   - 查看问题
   - 输入自己的回答
   - 查看参考答案
   - AI 点评
   - 收藏到错题本

4. 题目数据第一版使用本地 JSON 文件

5. 页面支持搜索和标签筛选

要求：
- 题库数据放在 src/data/questionBank.ts 或 json 文件中
- 组件拆分清晰
- 后续可以复用 evaluateAnswerApi 进行评分
```

这一步让项目从“一次模拟面试”变成“长期训练平台”。

---

# 阶段十二：错题本和历史记录

## 任务 12：实现 MistakeBook 错题本页面

交给 agent 的任务：

```text
请实现 MistakeBook 错题本页面。

功能要求：
1. 展示用户收藏或低分的问题
2. 支持按标签筛选
3. 支持按题目类型筛选
4. 支持查看：
   - 原问题
   - 用户回答
   - AI 评分
   - AI 建议
   - 参考答案
5. 支持移出错题本
6. 支持重新练习该题
7. 支持统计薄弱知识点

数据来源：
- useMistakeStore
- useInterviewStore 中低于指定分数的问题也可以自动加入错题本

要求：
- 使用 Element Plus Table / Card 实现
- 支持 localStorage 持久化
- 页面刷新后数据不丢失
```

---

## 任务 13：实现历史面试记录页面或 Dashboard 展示

这个可以放在首页 Dashboard 里，不一定单独做页面。

交给 agent 的任务：

```text
请完善 Dashboard 首页，展示用户训练概况。

展示内容：
1. 最近一次面试记录
2. 历史面试次数
3. 平均分
4. 薄弱知识点 Top 5
5. 最近错题
6. 推荐训练方向
7. 快捷入口：
   - 开始新面试
   - 查看错题本
   - 项目深挖
   - 简历优化

要求：
- 数据来自 Pinia Store
- 使用 ECharts 或简单统计卡片
- 没有数据时展示空状态和引导按钮
```

---

# 阶段十三：简历优化模块

## 任务 14：实现简历项目描述优化功能

这个功能可以集成在 Resume 页面，也可以单独做一个 ResumeOptimize 组件。

交给 agent 的任务：

```text
请在 Resume 页面中增加简历优化功能。

功能要求：
1. 用户可以选择某个项目经历
2. 点击“优化项目描述”
3. 调用 polishResumeProjectApi
4. 展示优化前后对比
5. 支持一键替换原项目描述
6. 支持复制优化结果

优化内容包括：
- 项目描述润色
- 技术亮点提炼
- 难点描述优化
- 量化表达建议
- 面试表达建议

要求：
- 第一版使用 mock API
- 结构上要方便后续接真实 AI
- 不要直接覆盖原数据，必须让用户确认后再替换
```

---

# 阶段十四：后端接口任务

如果你后端继续用 flask，可以单独交给后端 agent。前端先用 mock，等页面完成后再接。

## 任务 15：设计 AI 后端接口

交给后端 agent 的任务：

```text
请为 AI Interview Coach 项目设计后端接口。

后端需要提供以下接口：

1. POST /api/resume/parse
输入：
{
  "rawText": string
}
输出：
{
  "resumeInfo": ResumeInfo
}

2. POST /api/interview/questions
输入：
{
  "resumeInfo": ResumeInfo,
  "config": InterviewConfig
}
输出：
{
  "questions": InterviewQuestion[]
}

3. POST /api/interview/evaluate
输入：
{
  "resumeInfo": ResumeInfo,
  "question": InterviewQuestion,
  "userAnswer": string,
  "history": ChatMessage[]
}
输出：
{
  "evaluation": AnswerEvaluation
}

4. POST /api/interview/report
输入：
{
  "session": InterviewSession
}
输出：
{
  "report": InterviewReport
}

5. POST /api/project/polish
输入：
{
  "project": ResumeProject
}
输出：
{
  "optimizedProject": ResumeProject,
  "suggestions": string[]
}

6. POST /api/project/questions
输入：
{
  "project": ResumeProject,
  "targetRole": string
}
输出：
{
  "questions": InterviewQuestion[]
}

7. POST /api/chat/stream
用于 SSE 或流式输出

要求：
- API Key 只能放在后端，不能暴露到前端
- 所有 AI 输出尽量使用 JSON 格式
- 对 JSON 解析失败要有兜底处理
- 支持 CORS
- 支持错误返回
- 支持基础日志记录
```

---

# 阶段十五：真实 AI Prompt 设计

这一步可以单独做，不要让前端 agent 乱写 prompt。

## 任务 16：设计 AI Prompt 模板

交给 agent 的任务：

```text
请为 AI Interview Coach 设计 Prompt 模板。

需要设计以下 Prompt：

1. 简历解析 Prompt
目标：
把用户原始简历文本解析成 ResumeInfo JSON。

2. 面试题生成 Prompt
目标：
根据 ResumeInfo、目标岗位、面试模式、难度、考察方向生成 InterviewQuestion[]。

3. 回答评分 Prompt
目标：
根据问题、用户回答、简历信息，输出 AnswerEvaluation JSON。

4. 追问生成 Prompt
目标：
根据用户回答中的不足，生成一个更深入的 follow-up question。

5. 面试报告生成 Prompt
目标：
根据整个 InterviewSession 生成 InterviewReport JSON。

6. 项目深挖 Prompt
目标：
围绕用户简历中的某个项目，生成项目介绍、技术亮点、高频追问和推荐回答。

要求：
- 每个 Prompt 都要求模型返回严格 JSON
- 给出 JSON schema 示例
- 加入错误兜底说明
- 中文输出
- 面试风格要真实，不要太空泛
- 问题要结合用户简历，而不是只生成通用八股题
```

---

# 阶段十六：UI 优化和工程整理

## 任务 17：整体 UI 美化和交互优化

交给 agent 的任务：

```text
请对 AI Interview Coach 项目进行 UI 和交互优化。

优化目标：
1. 页面整体风格统一
2. 左侧菜单、顶部栏、内容区布局更美观
3. 卡片间距、字体层级、按钮样式统一
4. 模拟面试页面更像真实 AI 面试界面
5. 增加空状态、加载状态、错误状态
6. 增加操作反馈，例如 ElMessage
7. 移动端或窄屏下不崩坏
8. 长文本区域支持滚动
9. 聊天区域自动滚动到底部
10. AI 输出 loading 状态更明显

要求：
- 不改变核心业务逻辑
- 主要修改样式和组件结构
- 避免大范围重构
```

---

## 任务 18：代码质量整理

交给 agent 的任务：

```text
请对项目进行代码质量整理。

要求：
1. 检查 TypeScript 类型错误
2. 删除无用代码
3. 删除无用 console
4. 统一组件命名
5. 统一 API 命名
6. 统一 Store 方法命名
7. 抽取重复组件
8. 检查 localStorage 持久化逻辑
9. 检查路由跳转逻辑
10. 保证 npm run build 可以通过

不要新增大功能，只做工程质量整理。
```

---

# 推荐实际执行顺序

你可以按这个顺序交给 agent：

第一批先做基础框架：

1. 任务 1：项目初始化和页面骨架
2. 任务 2：类型和 Pinia Store
3. 任务 3：简历管理页面
4. 任务 4：面试配置页面

第二批做核心闭环：

5. 任务 5：模拟面试页面
6. 任务 6：评分卡和报告页面
7. 任务 7：API mock / real 封装

做到这里，项目的 MVP 就已经能展示了。

第三批做 AI 体验：

8. 任务 8：SSE 流式输出
9. 任务 9：Markdown 渲染和代码高亮
10. 任务 16：Prompt 模板设计
11. 任务 15：后端 AI 接口

第四批做产品增强：

12. 任务 10：项目深挖助手
13. 任务 11：知识点训练
14. 任务 12：错题本
15. 任务 13：Dashboard 历史统计
16. 任务 14：简历优化

最后再做：

17. 任务 17：UI 优化
18. 任务 18：代码质量整理

---

# 我建议你的 MVP 截止范围

第一版不要贪多，先做到这个程度就可以：

1. 用户能填写或上传简历文本
2. 系统能保存结构化简历信息
3. 用户能选择岗位、模式、难度
4. 系统能生成面试题
5. 用户能逐题回答
6. 系统能给出评分和建议
7. 最后能生成面试报告
8. 所有数据能本地保存

这一版完成后，你再接真实 AI 和 SSE。这样风险最低，agent 也不容易写乱。
