/**
 * SSE（Server-Sent Events）流式请求工具模块
 * =============================================
 *
 * 本模块提供三个核心能力：
 * 1. createStreamRequest —— 基于 fetch + ReadableStream 的 SSE 流式请求
 * 2. createStreamSession  —— 带会话管理的流式请求（重试/超时/中断）
 * 3. simulateStream       —— 本地模拟流式输出（用于开发调试）
 *
 * ## SSE 协议
 * - 每条消息格式：data: <JSON>\n\n
 * - 流结束标记：   data: [DONE]\n\n
 * - 错误标记：     data: {"error":"..."}\n\n
 *
 * ## 关键设计
 * - 缓冲区 + 行分割：处理 TCP 分片的半包/沾包问题
 * - TextDecoder 流模式：防止多字节字符（中文 UTF-8 3字节）被截断
 * - AbortController：组件卸载时主动取消请求，避免内存泄漏
 * - 推理内容分离：兼容 DeepSeek 等模型的 reasoning_content 字段
 */

// ─── 类型定义 ───────────────────────────────────

/** 单条流式响应数据块（来自服务端 SSE） */
export interface StreamChunk {
  /** 正文内容增量 */
  content?: string
  /** 推理/思考过程增量（DeepSeek R1 等推理模型） */
  reasoning_content?: string
  /** 错误信息（如果有） */
  error?: string
}

/** SSE 增强流式回调接口 */
export interface StreamCallbacks {
  /** 收到正文文本片段 */
  onMessage: (text: string) => void
  /** 收到推理/思考过程片段（可选，用于支持 DeepSeek 等推理模型） */
  onReasoning?: (text: string) => void
  /** 发生错误时调用 */
  onError?: (error: Error) => void
  /** 流正常结束时调用 */
  onDone?: () => void
}

/** SSE 流式请求配置 */
export interface StreamRequestOptions {
  url: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  headers?: Record<string, string>
  callbacks: StreamCallbacks
  /** 请求超时时间（毫秒），默认 60000 */
  timeout?: number
}

/** 带会话管理的流式请求配置 */
export interface StreamSessionOptions extends StreamRequestOptions {
  /** 最大重试次数，默认 0（不重试） */
  maxRetries?: number
  /** 重试间隔（毫秒），默认 2000 */
  retryDelay?: number
}

// ─── 核心实现 ───────────────────────────────────

/**
 * 解析单行 SSE data，分派到正文 / 推理 / 错误回调
 */
function dispatchStreamChunk(
  rawData: string,
  callbacks: StreamCallbacks
): 'done' | 'error' | 'ok' {
  // 流结束标记
  if (rawData === '[DONE]') {
    callbacks.onDone?.()
    return 'done'
  }

  // 尝试 JSON 解析
  try {
    const parsed: StreamChunk = JSON.parse(rawData)

    // 错误消息
    if (parsed.error) {
      callbacks.onError?.(new Error(parsed.error))
      return 'error'
    }

    // 推理/思考内容（DeepSeek R1 等推理模型）
    if (parsed.reasoning_content && callbacks.onReasoning) {
      callbacks.onReasoning(parsed.reasoning_content)
    }

    // 正文内容（兼容 content / text / delta / message 等字段名）
    const content =
      parsed.content ||
      (parsed as any).text ||
      (parsed as any).delta ||
      (parsed as any).message ||
      ''

    if (content) {
      callbacks.onMessage(content)
    }

    return 'ok'
  } catch {
    // 非 JSON 纯文本也作为正文处理
    callbacks.onMessage(rawData)
    return 'ok'
  }
}

/**
 * 创建基于 fetch + ReadableStream 的 SSE 流式请求
 *
 * ## 核心设计
 *
 * ### 1. 缓冲区解决 TCP 分片半包/沾包
 * ```
 * TCP chunk1: "data: {\"con"
 * TCP chunk2: "tent\":\"你好\"}\n\ndata: {\"con"
 *                              ↑ 完整的消息边界
 * ```
 * 缓冲区拼接 → 按 \n 分割 → 最后一行保留 → 逐行处理
 *
 * ### 2. TextDecoder 流模式防止多字节字符截断
 * `decoder.decode(chunk, { stream: true })` 保证 UTF-8 多字节字符
 * （如中文 3 字节）被切分时不会产生 � 乱码。
 *
 * ### 3. AbortController 生命周期管理
 * 返回 controller 给调用方，组件 onUnmounted 时 abort，
 * reader.read() 抛出 AbortError → 静默忽略。
 *
 * ### 4. 推理内容分离
 * 兼容 DeepSeek R1 等推理模型：`reasoning_content` 走 onReasoning 回调，
 * `content` 走 onMessage 回调，前端可独立渲染。
 *
 * @returns AbortController，调用 .abort() 可中断请求
 */
export function createStreamRequest(options: StreamRequestOptions): AbortController {
  const {
    url,
    method = 'POST',
    body,
    headers = {},
    callbacks,
    timeout = 60000,
  } = options

  const controller = new AbortController()

  // 超时控制
  const timeoutId = setTimeout(() => {
    controller.abort()
    callbacks.onError?.(new Error(`请求超时（${timeout / 1000}s）`))
  }, timeout)

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  })
    .then(async (response) => {
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // 流式解码：保证多字节字符不被截断
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 最后不完整行保留

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue

            const data = trimmed.slice(6)
            const result = dispatchStreamChunk(data, callbacks)
            if (result === 'done') return
          }
        }
      } finally {
        reader.releaseLock()
      }

      callbacks.onDone?.()
    })
    .catch((err: Error) => {
      clearTimeout(timeoutId)
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err)
      }
    })

  return controller
}

/**
 * 创建带会话管理的流式请求（支持重试）
 *
 * 与 createStreamRequest 的区别：
 * - 内置重试机制（网络抖动自动恢复）
 * - 返回 SessionController 提供更丰富的控制能力
 * - 适合长对话场景
 */
export function createStreamSession(options: StreamSessionOptions): SessionController {
  const { maxRetries = 0, retryDelay = 2000, ...requestOptions } = options

  let retryCount = 0
  let controller: AbortController | null = null
  let disposed = false

  function start() {
    if (disposed) return
    controller = createStreamRequest({
      ...requestOptions,
      callbacks: {
        ...requestOptions.callbacks,
        onError: (err) => {
          if (retryCount < maxRetries) {
            retryCount++
            console.warn(
              `[SSE] 连接中断，${retryDelay / 1000}s 后重试 (${retryCount}/${maxRetries})`
            )
            setTimeout(start, retryDelay)
          } else {
            requestOptions.callbacks.onError?.(err)
          }
        },
      },
    })
  }

  start()

  return {
    abort: () => {
      disposed = true
      controller?.abort()
    },
    get isActive() {
      return !disposed && controller !== null
    },
    get retryCount() {
      return retryCount
    },
  }
}

/** 流式会话控制器 */
export interface SessionController {
  abort: () => void
  readonly isActive: boolean
  readonly retryCount: number
}

// ─── 本地模拟流式输出 ──────────────────────────

/**
 * 模拟流式响应 —— 逐字输出文本，用于 Mock / 开发调试
 *
 * ## 特性
 * - 使用 setTimeout 递归调度，模拟真实网络流式传输
 * - 随机延迟 0~10ms 叠加在基础延迟上，模拟自然网络抖动
 * - 支持提前 stop() 取消
 * - 支持推理内容模拟（reasoningText 参数）
 *
 * @param fullText - 主文本内容
 * @param callbacks - 回调集合
 * @param options - 可选配置
 * @returns 停止函数
 */
export function simulateStream(
  fullText: string,
  callbacks: StreamCallbacks,
  options?: {
    charDelay?: number
    chunkSize?: number
    /** 推理过程文本（如果提供，会先模拟输出推理过程再输出正文） */
    reasoningText?: string
    /** 推理过程延迟倍数（默认 1.5，推理过程比正文稍快） */
    reasoningSpeed?: number
  }
): () => void {
  const {
    charDelay = 20,
    chunkSize = 3,
    reasoningText,
    reasoningSpeed = 1.5,
  } = options || {}

  let index = 0
  let cancelled = false
  let phase: 'reasoning' | 'content' | 'done' = reasoningText ? 'reasoning' : 'content'

  function getTarget(): string {
    if (phase === 'reasoning') return reasoningText!
    return fullText
  }

  function pump() {
    if (cancelled) return

    const targetText = getTarget()

    if (index >= targetText.length) {
      if (phase === 'reasoning') {
        phase = 'content'
        index = 0
        // 推理结束短暂停顿，模拟模型切换
        setTimeout(pump, 80)
        return
      }
      callbacks.onDone?.()
      return
    }

    const chunk = targetText.slice(index, index + chunkSize)
    index += chunk.length

    // 推理内容走 onReasoning 回调，正文走 onMessage
    if (phase === 'reasoning' && callbacks.onReasoning) {
      callbacks.onReasoning(chunk)
    } else {
      callbacks.onMessage(chunk)
    }

    // 当前阶段的延迟
    const delay = phase === 'reasoning'
      ? charDelay / reasoningSpeed
      : charDelay
    setTimeout(pump, delay + Math.random() * 10)
  }

  setTimeout(pump, 100)

  return () => {
    cancelled = true
  }
}
