import type { ResumeInfo, ResumeProject } from '@/types/resume'
import type { InterviewConfig, InterviewQuestion, AnswerEvaluation, InterviewSession } from '@/types/interview'
import type { InterviewReport } from '@/types/report'

function delay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 400))
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// 1. Parse resume
export async function mockParseResume(rawText: string): Promise<ResumeInfo> {
  await delay(600)

  const skillKeywords = [
    'Vue', 'Vue3', 'React', 'Angular', 'TypeScript', 'JavaScript', 'Node.js',
    'Express', 'Python', 'Django', 'Java', 'Spring', 'Go', 'Rust',
    'HTML', 'CSS', 'SCSS', 'Tailwind', 'Webpack', 'Vite', 'Rollup',
    'Git', 'Docker', 'CI/CD', 'Nginx', 'Linux',
    'ECharts', 'D3', 'Three.js', 'Cesium', 'OpenLayers', 'WebGIS', 'Mapbox',
    'Pinia', 'Vuex', 'Redux', 'RESTful', 'GraphQL', 'WebSocket', 'SSE',
    'Axios', 'MySQL', 'MongoDB', 'Redis', 'Element Plus',
  ]

  const foundSkills = skillKeywords.filter((kw) => rawText.includes(kw))

  const nameMatch = rawText.match(/姓名[：:]\s*(.+)/)
  const name = nameMatch ? nameMatch[1].trim() : ''
  const roleMatch = rawText.match(/(?:求职意向|期望岗位|目标岗位)[：:]\s*(.+)/)
  const targetRole = roleMatch ? roleMatch[1].trim() : '前端开发工程师'
  const eduMatch = rawText.match(/(?:教育经历|学历)[：:\n]+\s*(.+)/)
  const education = eduMatch ? eduMatch[1].trim() : ''

  return {
    name,
    targetRole,
    education,
    skills: foundSkills,
    projects: [],
    experiences: [],
    rawText,
  }
}

// 2. Generate interview questions
export async function mockGenerateQuestions(
  _resumeInfo: ResumeInfo | null,
  config: InterviewConfig
): Promise<InterviewQuestion[]> {
  await delay(700)

  const questionBank: Record<string, Record<string, string[]>> = {
    'tech-basic': {
      'JavaScript': [
        '请解释 JavaScript 的事件循环机制',
        '闭包的原理和使用场景是什么？',
        '谈谈你对原型链的理解',
        'Promise.all 和 Promise.race 的区别？',
        '请解释防抖和节流的实现原理',
      ],
      'TypeScript': [
        'TypeScript 中 interface 和 type 的区别？',
        '请解释泛型的使用场景',
        'TypeScript 的类型推导机制是怎样工作的？',
        '如何在项目中落地 TypeScript 最佳实践？',
      ],
      'Vue3': [
        'Vue3 Composition API 和 Options API 的区别？',
        '请解释 Vue3 的响应式原理（Proxy）',
        'Vue3 中 watch 和 watchEffect 的区别？',
        '谈谈 Vue3 的编译优化策略',
        'Vue3 组件通信有哪些方式？',
      ],
      'HTML/CSS': [
        'CSS 实现水平垂直居中的几种方式？',
        '谈谈你对 BFC 的理解及其应用场景',
        'Flexbox 和 Grid 布局的区别和适用场景？',
      ],
      'HTTP/浏览器': [
        '从输入 URL 到页面展示，发生了哪些过程？',
        '请解释 HTTP 强缓存和协商缓存的区别',
        '什么是跨域？如何解决跨域问题？',
        '谈谈你对浏览器渲染流程的理解',
      ],
      '性能优化': [
        '前端性能优化的常用手段有哪些？',
        '如何优化首屏加载速度？',
        '谈谈虚拟列表的实现原理',
        '如何做代码分割和懒加载？',
      ],
      '工程化': [
        'Webpack 和 Vite 的区别是什么？',
        '谈谈你对 CI/CD 的理解和实践经验',
        '如何搭建一个组件库的工程化环境？',
      ],
    },
    'project-deep': {
      '项目表达': [
        '请用 1 分钟介绍你最有挑战性的项目',
        '这个项目中你遇到了什么技术难点？如何解决的？',
        '如果重新设计这个项目，你会做哪些改进？',
        '这个项目的架构是怎样的？为什么选择这种架构？',
        '项目中你是如何进行技术选型的？',
      ],
    },
    'baguwen': {
      'JavaScript': [
        'var、let、const 的区别是什么？',
        '箭头函数和普通函数的区别？',
        '深拷贝和浅拷贝的区别？如何实现深拷贝？',
        '什么是事件委托？有什么优点？',
      ],
      'Vue3': [
        'v-if 和 v-show 的区别？',
        'Vue Router hash 和 history 模式的区别？',
        'Pinia 和 Vuex 的区别？',
        'ref 和 reactive 的区别和使用场景？',
      ],
    },
    'scenario': {
      'JavaScript': [
        '实现一个 Promise 并发控制函数',
        '设计一个前端埋点系统，你会考虑哪些方面？',
      ],
      'Vue3': [
        '设计一个大型表单系统，如何处理复杂的联动和验证？',
        '设计一个通用权限管理系统前端方案',
      ],
      '性能优化': [
        '一个页面加载很慢，请描述你的排查和优化思路',
        '如何设计一个前端监控 SDK？',
      ],
    },
    'comprehensive': {
      'JavaScript': [
        'ES6 之后你常用的新特性有哪些？举例说明',
        '谈谈你对前端模块化发展的理解',
      ],
      'Vue3': [
        'Vue3 相比 Vue2 有哪些重大改进？',
        '你是如何做 Vue3 项目的性能优化的？',
      ],
    },
  }

  const modeBank = questionBank[config.interviewMode] || questionBank['tech-basic']
  const candidates: Array<{ question: string; area: string }> = []

  for (const area of config.focusAreas) {
    const areaQuestions = modeBank[area]
    if (areaQuestions) {
      areaQuestions.forEach((q) => candidates.push({ question: q, area }))
    }
  }

  // Fallback: use all areas
  if (candidates.length === 0) {
    for (const [area, questions] of Object.entries(modeBank)) {
      questions.forEach((q) => candidates.push({ question: q, area }))
    }
  }

  const shuffled = candidates.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, config.questionCount)

  return selected.map((item, i) => ({
    id: generateId('q'),
    question: `${i + 1}. ${item.question}`,
    type: config.interviewMode,
    tags: [item.area, config.difficulty],
    difficulty: config.difficulty,
    source: config.targetRole,
    referenceAnswer: '参考答案将在你提交回答后展示。建议结合项目经验作答，注重逻辑和深度。',
  }))
}

// 3. Evaluate answer
export async function mockEvaluateAnswer(
  _question: InterviewQuestion,
  userAnswer: string,
  _resumeInfo: ResumeInfo | null
): Promise<AnswerEvaluation> {
  await delay(800)

  const len = userAnswer.length
  const baseScore =
    len > 300 ? 85 + Math.floor(Math.random() * 13) :
    len > 150 ? 70 + Math.floor(Math.random() * 15) :
    len > 60 ? 55 + Math.floor(Math.random() * 15) :
    len > 20 ? 35 + Math.floor(Math.random() * 20) : 0

  const totalScore = Math.min(98, baseScore)

  return {
    questionId: _question.id,
    totalScore,
    accuracy: Math.min(100, totalScore + Math.floor(Math.random() * 6) - 3),
    completeness: Math.min(100, totalScore + Math.floor(Math.random() * 10) - 5),
    expression: Math.min(100, totalScore + Math.floor(Math.random() * 8) - 4),
    projectRelevance: Math.floor(totalScore * (0.6 + Math.random() * 0.3)),
    depth: Math.min(100, totalScore + Math.floor(Math.random() * 6) - 8),
    strengths: totalScore > 70
      ? ['回答结构清晰，思路明确', '对核心概念有较好的理解']
      : totalScore > 50
        ? ['基本回答了核心问题']
        : [],
    weaknesses: totalScore > 70
      ? ['可以补充更多实际项目经验']
      : totalScore > 50
        ? ['知识点覆盖不够全面', '缺少实际案例支撑']
        : ['知识点掌握不牢固，建议系统复习该模块'],
    improvedAnswer: '建议结合你的实际项目经验来补充具体案例，使回答更具说服力。',
    followUpQuestion: totalScore > 60
      ? '能否再展开说说在实际项目中你是如何应用这一知识点的？'
      : '',
  }
}

// 4. Generate report
export async function mockGenerateReport(session: InterviewSession): Promise<InterviewReport> {
  await delay(600)

  const validEvals = session.evaluations.filter((e) => e.totalScore > 0)
  const totalScore = validEvals.length > 0
    ? Math.round(validEvals.reduce((s, e) => s + e.totalScore, 0) / validEvals.length)
    : 0

  return {
    sessionId: session.id,
    totalScore,
    abilityScores: {
      technicalFoundation: Math.round(40 + Math.random() * 50),
      projectExperience: Math.round(40 + Math.random() * 50),
      expressiveness: Math.round(40 + Math.random() * 50),
      depthOfThinking: Math.round(30 + Math.random() * 50),
      comprehensiveness: Math.round(40 + Math.random() * 50),
    },
    strengths: totalScore > 60
      ? ['回答逻辑清晰', '有一定技术深度', '表达流畅']
      : ['态度认真', '有基础概念'],
    weaknesses: totalScore > 60
      ? ['项目经验表达可以更精准', '部分知识点需要深入']
      : ['技术基础有待加强', '建议多做模拟练习'],
    suggestedTopics: totalScore > 60
      ? ['项目经验整理', '技术深度提升', '系统设计能力']
      : ['JavaScript 基础', 'Vue3 核心概念', '面试表达训练'],
    questionReviews: session.questions.map((q) => {
      const ev = session.evaluations.find((e) => e.questionId === q.id)
      const msg = session.messages.find((m) => m.questionId === q.id && m.role === 'user')
      return {
        questionId: q.id,
        question: q.question,
        userAnswer: msg?.content || '（未作答）',
        score: ev?.totalScore || 0,
        suggestion: ev?.improvedAnswer || '',
        referenceAnswer: q.referenceAnswer,
      }
    }),
  }
}

// 5. Polish project description
export async function mockPolishProject(project: ResumeProject): Promise<{
  optimized: ResumeProject
  suggestions: string[]
}> {
  await delay(600)

  return {
    optimized: {
      ...project,
      description: `${project.description}\n\n【优化建议】建议使用 STAR 法则来描述项目：先说明业务背景，再介绍技术方案，最后用量化数据展示成果。`,
      highlights: [
        ...project.highlights,
        '建议补充：使用了哪些技术方案解决了具体的业务问题',
        '建议补充：项目的性能指标或业务数据的提升',
      ],
      difficulties: `${project.difficulties || '（待补充）'}\n\n【优化建议】描述难点时，应包含：遇到的问题 → 尝试的方案 → 最终解决方案 → 总结反思。`,
    },
    suggestions: [
      '使用更具体的技术名词代替笼统表述',
      '补充量化数据增强说服力（如性能提升百分比）',
      '突出你的个人贡献而非团队成果',
      '用 STAR 法则重新组织项目描述结构',
    ],
  }
}

// 6. Generate project deep-dive questions
export async function mockGenerateProjectQuestions(project: ResumeProject): Promise<InterviewQuestion[]> {
  await delay(500)

  const baseQuestions = [
    `请用 1 分钟介绍「${project.name}」这个项目`,
    `在「${project.name}」中，你遇到了哪些技术挑战？是如何解决的？`,
    `如果重新设计「${project.name}」，你会做哪些改进？`,
    `「${project.name}」的技术架构是怎样的？为什么选择 ${project.techStack.slice(0, 3).join('、')}？`,
    `在「${project.name}」开发中，你如何保证代码质量和项目的可维护性？`,
  ]

  return baseQuestions.map((q, i) => ({
    id: generateId('pq'),
    question: q,
    type: 'project-deep',
    tags: project.techStack.slice(0, 3),
    difficulty: 'medium',
    source: project.name,
    relatedProjectId: project.id,
    referenceAnswer: '请结合你的实际项目经验作答，注重细节和量化表达。',
  }))
}
