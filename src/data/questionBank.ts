export interface BankQuestion {
  id: string
  category: string
  question: string
  tags: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  referenceAnswer: string
}

export interface BankCategory {
  id: string
  name: string
  icon: string
}

export const categories: BankCategory[] = [
  { id: 'html-css', name: 'HTML/CSS', icon: '🎨' },
  { id: 'javascript', name: 'JavaScript', icon: '🟨' },
  { id: 'typescript', name: 'TypeScript', icon: '🔷' },
  { id: 'vue3', name: 'Vue3', icon: '💚' },
  { id: 'pinia', name: 'Pinia', icon: '🍍' },
  { id: 'http', name: 'HTTP/浏览器', icon: '🌐' },
  { id: 'performance', name: '性能优化', icon: '⚡' },
  { id: 'engineering', name: '前端工程化', icon: '🔧' },
  { id: 'webgis', name: 'WebGIS', icon: '🗺️' },
  { id: 'threejs', name: 'Three.js', icon: '🎮' },
  { id: 'cesium', name: 'Cesium', icon: '🌍' },
  { id: 'openlayers', name: 'OpenLayers', icon: '🗾' },
  { id: 'ai-frontend', name: 'AI 前端应用', icon: '🤖' },
]

export const questionBank: BankQuestion[] = [
  // HTML/CSS
  {
    id: 'html-1',
    category: 'html-css',
    question: '请解释 HTML5 语义化标签及其对 SEO 和可访问性的影响',
    tags: ['HTML5', 'SEO', '语义化'],
    difficulty: 'easy',
    referenceAnswer: 'HTML5 语义化标签如 header、nav、main、article、section、aside、footer 等，能够让页面结构更加清晰。对 SEO 的影响：搜索引擎可以更好地理解页面内容结构，提升内容权重。对可访问性：屏幕阅读器可以更准确地解析页面，帮助残障用户浏览。',
  },
  {
    id: 'html-2',
    category: 'html-css',
    question: 'CSS 实现水平垂直居中的几种方式及优缺点',
    tags: ['CSS', '布局', '居中'],
    difficulty: 'easy',
    referenceAnswer: '1. Flexbox：display:flex + justify-content:center + align-items:center，现代布局首选。2. Grid：display:grid + place-items:center，最简洁。3. 绝对定位 + transform：兼容性好，但需要脱离文档流。4. 绝对定位 + margin:auto：需要宽高已知。5. table-cell：较老的方法，不推荐。',
  },
  {
    id: 'html-3',
    category: 'html-css',
    question: '谈谈你对 BFC（块级格式化上下文）的理解及其应用场景',
    tags: ['CSS', 'BFC', '布局'],
    difficulty: 'medium',
    referenceAnswer: 'BFC 是独立的渲染区域，内部元素不会影响外部。触发条件：float非none、overflow非visible、display:flex/grid、position:absolute/fixed。应用：清除浮动、防止margin重叠、自适应两栏布局。',
  },

  // JavaScript
  {
    id: 'js-1',
    category: 'javascript',
    question: '请解释 JavaScript 的事件循环机制（Event Loop）',
    tags: ['JavaScript', '事件循环', '异步'],
    difficulty: 'medium',
    referenceAnswer: 'JS 是单线程语言，通过事件循环实现异步。流程：同步代码 → 微任务队列(Promise.then, MutationObserver) → 宏任务队列(setTimeout, setInterval, I/O)。每个宏任务执行完会清空当前所有微任务，然后继续下一轮循环。',
  },
  {
    id: 'js-2',
    category: 'javascript',
    question: '闭包的原理、使用场景及内存泄漏问题',
    tags: ['JavaScript', '闭包', '内存'],
    difficulty: 'medium',
    referenceAnswer: '闭包是指函数能够访问其外部作用域变量的能力。原理：内部函数引用外部变量，外部函数执行后变量不会被回收。场景：数据私有化、函数工厂、回调函数。内存泄漏：闭包会维持对外部变量的引用，不使用时需要手动解除引用。',
  },
  {
    id: 'js-3',
    category: 'javascript',
    question: 'Promise.all、Promise.race、Promise.allSettled、Promise.any 的区别',
    tags: ['JavaScript', 'Promise', '异步'],
    difficulty: 'medium',
    referenceAnswer: 'Promise.all：全部成功才成功，一个失败就失败。Promise.race：第一个完成的结果（无论成功失败）。Promise.allSettled：全部完成后返回所有结果（包含成功和失败）。Promise.any：第一个成功的，全部失败才失败。',
  },

  // TypeScript
  {
    id: 'ts-1',
    category: 'typescript',
    question: 'TypeScript 中 interface 和 type 的区别及使用场景',
    tags: ['TypeScript', '类型系统'],
    difficulty: 'medium',
    referenceAnswer: '相同点：都可以描述对象形状。区别：interface 可被合并（declaration merging），type 不行；type 可以定义联合类型、元组等。使用场景：对外 API 推荐 interface（可扩展），复杂类型组合推荐 type。',
  },
  {
    id: 'ts-2',
    category: 'typescript',
    question: '请解释 TypeScript 泛型的使用场景并举例',
    tags: ['TypeScript', '泛型'],
    difficulty: 'medium',
    referenceAnswer: '泛型允许在定义时不指定具体类型，使用时再确定。场景：通用工具函数(如 Array.map)、泛型约束(extends)、条件类型(infer)。例如：function identity<T>(arg: T): T { return arg; }',
  },

  // Vue3
  {
    id: 'vue-1',
    category: 'vue3',
    question: 'Vue3 Composition API 和 Options API 的区别及选择建议',
    tags: ['Vue3', 'Composition API'],
    difficulty: 'medium',
    referenceAnswer: 'Options API 按选项组织(data/methods/computed)，适合简单组件。Composition API 按逻辑功能组织，支持更好的逻辑复用、更灵活的代码组织、更好的 TypeScript 支持。建议：新项目统一 Composition API，小型工具组件可用 Options。',
  },
  {
    id: 'vue-2',
    category: 'vue3',
    question: '请解释 Vue3 的响应式原理（Proxy 对比 Object.defineProperty）',
    tags: ['Vue3', '响应式', 'Proxy'],
    difficulty: 'medium',
    referenceAnswer: 'Vue2 使用 Object.defineProperty 劫持属性，无法检测新增/删除属性、数组索引修改。Vue3 使用 Proxy 代理整个对象，支持动态属性、数组操作、Map/Set 等。优势：更全面、性能更好、支持更多数据结构。',
  },
  {
    id: 'vue-3',
    category: 'vue3',
    question: 'Vue3 中 ref 和 reactive 的区别及选择建议',
    tags: ['Vue3', 'ref', 'reactive'],
    difficulty: 'easy',
    referenceAnswer: 'ref 适用于基本类型和对象，.value 访问，模板自动解包。reactive 仅适用于对象类型，直接访问属性。建议：基本类型用 ref，对象推荐 ref（配合 toRefs 解构），需要响应式集合用 reactive。',
  },

  // HTTP/浏览器
  {
    id: 'http-1',
    category: 'http',
    question: '从输入 URL 到页面展示，浏览器做了什么？',
    tags: ['浏览器', 'HTTP', '渲染'],
    difficulty: 'hard',
    referenceAnswer: '1. DNS 解析域名 → IP。2. TCP 三次握手建立连接。3. TLS 握手（HTTPS）。4. 发送 HTTP 请求。5. 服务器响应。6. 浏览器解析 HTML → DOM 树。7. 解析 CSS → CSSOM 树。8. 合成 Render Tree。9. Layout 布局计算。10. Paint 绘制。11. Composite 合成图层。',
  },
  {
    id: 'http-2',
    category: 'http',
    question: '请解释 HTTP 强缓存和协商缓存的区别及对应 Header',
    tags: ['HTTP', '缓存'],
    difficulty: 'medium',
    referenceAnswer: '强缓存：不向服务器发请求，直接使用本地缓存。Header：Expires(HTTP/1.0) / Cache-Control: max-age(HTTP/1.1)。协商缓存：向服务器验证是否过期，304 使用缓存。Header：Last-Modified/If-Modified-Since 和 ETag/If-None-Match。',
  },

  // 性能优化
  {
    id: 'perf-1',
    category: 'performance',
    question: '前端性能优化的常用手段有哪些？',
    tags: ['性能优化', '综合'],
    difficulty: 'medium',
    referenceAnswer: '网络层面：CDN、压缩、HTTP2、资源预加载。构建层面：Tree Shaking、代码分割、懒加载。渲染层面：虚拟列表、防抖节流、requestAnimationFrame、Web Worker。缓存：Service Worker、localStorage、IndexedDB。监控：Performance API、Lighthouse。',
  },

  // Engineering
  {
    id: 'eng-1',
    category: 'engineering',
    question: 'Webpack 和 Vite 的区别及各自的适用场景',
    tags: ['工程化', 'Webpack', 'Vite'],
    difficulty: 'medium',
    referenceAnswer: 'Webpack：基于 bundle 的构建方式，插件生态丰富，适合大型复杂项目。Vite：基于 ESM 的开发服务器，开发时使用 esbuild 预构建，生产使用 Rollup。优势：冷启动快、HMR 快。适用：新项目推荐 Vite，老项目或特殊需求使用 Webpack。',
  },

  // WebGIS
  {
    id: 'gis-1',
    category: 'webgis',
    question: 'Cesium 中如何优化大量实体（Entity）的渲染性能？',
    tags: ['Cesium', 'WebGIS', '性能'],
    difficulty: 'hard',
    referenceAnswer: '1. 使用 Primitive 替代 Entity（Entity 是对 Primitive 的封装，有额外开销）。2. LOD（层次细节）根据距离调整模型精度。3. 视锥体裁剪：只渲染视野内的对象。4. 聚合显示：大量点数据使用聚类。5. 3D Tiles 优化：使用合适的几何误差。6. 减少不必要的更新。',
  },
  {
    id: 'gis-2',
    category: 'webgis',
    question: 'OpenLayers 中如何实现高性能的矢量数据渲染？',
    tags: ['OpenLayers', '矢量', '性能'],
    difficulty: 'hard',
    referenceAnswer: '1. 使用 WebGL 渲染器替代 Canvas 渲染器。2. 矢量切片（Vector Tiles）减少数据传输和渲染压力。3. 图层按需加载，根据缩放级别控制显示。4. 使用空间索引（R-tree）加速查询。5. 简化几何数据，减少顶点数。6. 使用 ImageLayer 缓存静态矢量图层。',
  },

  // Three.js
  {
    id: 'three-1',
    category: 'threejs',
    question: 'Three.js 中如何优化 3D 场景的渲染性能？',
    tags: ['Three.js', '3D', '性能'],
    difficulty: 'hard',
    referenceAnswer: '1. 降低几何体面数（使用 BufferGeometry）。2. 使用 InstancedMesh 批量渲染相同几何体。3. LOD 根据距离切换模型精度。4. 纹理压缩和 Mipmap。5. 视锥体裁剪和遮挡剔除。6. 使用 requestAnimationFrame 控制帧率。7. 减少光源数量，使用烘焙光照。',
  },

  // AI Frontend
  {
    id: 'ai-1',
    category: 'ai-frontend',
    question: '前端如何实现 SSE（Server-Sent Events）流式输出？',
    tags: ['SSE', '流式', 'AI'],
    difficulty: 'medium',
    referenceAnswer: '使用 fetch API + ReadableStream 或 EventSource API。fetch 方式：post 请求 → response.body.getReader() → 逐块读取 → 解析 data: 行 → 渲染。需要处理：断线重连、流式 Markdown 不完整的情况、手动停止。关键点：使用 AbortController 中断，正确处理 Unicode 字符边界。',
  },
]
