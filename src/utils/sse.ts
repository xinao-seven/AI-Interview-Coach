/**
 * SSE（Server-Sent Events）流式请求工具模块
 *
 * 本模块提供两个核心能力：
 * 1. createStreamRequest —— 基于 fetch API 的 SSE 流式请求（支持 POST）
 * 2. simulateStream —— 本地模拟流式输出（用于 Mock/开发调试）
 *
 * SSE 协议说明：
 * - 服务端通过 text/event-stream MIME 类型持续推送数据
 * - 每条数据以 "data: " 开头，以 "\n\n" 结尾
 * - 流结束信号为 "data: [DONE]\n\n"
 * - 错误信号为 "data: {\"error\": \"...\"}\n\n"
 */

/** SSE 流式回调接口 */
export interface StreamCallbacks {
  /** 收到文本片段时调用（可能被多次调用，每次传递一小段文本） */
  onMessage: (text: string) => void
  /** 发生错误时调用（可选） */
  onError?: (error: Error) => void
  /** 流正常结束时调用（可选） */
  onDone?: () => void
}

/** SSE 流式请求配置选项 */
export interface StreamRequestOptions {
  /** 请求 URL */
  url: string
  /** HTTP 方法，默认 POST */
  method?: 'GET' | 'POST'
  /** 请求体（仅 POST 时有效，会自动序列化为 JSON） */
  body?: Record<string, unknown>
  /** 自定义请求头 */
  headers?: Record<string, string>
  /** 回调函数集合 */
  callbacks: StreamCallbacks
}

/**
 * 创建基于 fetch API 的 SSE 流式请求
 *
 * ## 工作流程
 *
 * 1. **发起请求**：使用 fetch API 向指定 URL 发送 POST/GET 请求
 * 2. **获取读取器**：通过 `response.body.getReader()` 获取可读流的读取器
 * 3. **逐块读取**：循环调用 `reader.read()` 读取二进制数据块
 * 4. **解码拼接**：使用 TextDecoder 将二进制数据解码为文本，拼接到缓冲区
 * 5. **按行解析**：将缓冲区按 `\n` 分割成行，逐行处理
 * 6. **提取 data**：匹配以 `data: ` 开头的行，提取后面的 JSON 数据
 * 7. **分发回调**：
 *    - 普通数据 → 调用 `callbacks.onMessage(content)`
 *    - `[DONE]` 标记 → 调用 `callbacks.onDone()`
 *    - 错误信息 → 调用 `callbacks.onError(error)`
 *
 * ## 关键设计
 *
 * ### 缓冲区机制（处理 TCP 分片）
 * ```
 * 网络传输可能将一条完整的 SSE 消息拆成多个 TCP 包发送，
 * 例如 "data: {"con" 和 "tent":"hello"}\n\n" 分两次到达。
 * 缓冲区 buffer 负责拼接不完整的行，确保按完整行解析。
 * ```
 *
 * ### TextDecoder 流模式
 * ```
 * decoder.decode(value, { stream: true })
 * stream: true 表示这是流式解码，解码器会记住上次的状态，
 * 避免多字节字符（如中文 UTF-8 3字节）被截断导致的乱码问题。
 * ```
 *
 * ### AbortController 取消机制
 * ```
 * 返回 AbortController 实例，调用方可通过 controller.abort()
 * 随时中断正在进行的流式请求，reader.read() 会抛出 AbortError。
 * ```
 *
 * ### 数据格式兼容
 * ```
 * 尝试从 JSON 中提取 content/text/delta 字段，
 * 如果 JSON 解析失败，直接将原始字符串作为内容传递。
 * 这样兼容了多种后端实现的数据格式。
 * ```
 *
 * @param options - 请求配置选项
 * @returns AbortController 实例，用于取消请求
 *
 * @example
 * ```ts
 * const controller = createStreamRequest({
 *   url: '/api/chat/stream',
 *   body: { messages: [...] },
 *   callbacks: {
 *     onMessage: (text) => { content.value += text },
 *     onDone: () => { console.log('流结束') },
 *     onError: (err) => { console.error(err) },
 *   },
 * })
 * // 取消请求：
 * // controller.abort()
 * ```
 */
export function createStreamRequest(options: StreamRequestOptions): AbortController {
  const { url, method = 'POST', body, headers = {}, callbacks } = options
  // 创建 AbortController，用于支持手动取消请求
  const controller = new AbortController()

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    // 将 AbortController 的 signal 传递给 fetch，建立取消关联
    signal: controller.signal,
  })
    .then(async (response) => {
      // 检查 HTTP 状态码，非 2xx 视为错误
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 获取响应体的可读流读取器
      // response.body 是一个 ReadableStream<Uint8Array>
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      // TextDecoder 用于将二进制数据解码为 UTF-8 文本
      const decoder = new TextDecoder()
      // 缓冲区：用于存储不完整的行（跨 TCP 分片的情况）
      let buffer = ''

      try {
        // 循环读取流数据，直到流结束
        while (true) {
          // reader.read() 返回 { done: boolean, value: Uint8Array | undefined }
          // done=true 表示流已关闭
          const { done, value } = await reader.read()
          if (done) break

          // 将新到达的二进制数据解码并追加到缓冲区
          // stream: true 保证多字节字符不会被截断
          buffer += decoder.decode(value, { stream: true })

          // 按换行符分割，最后一段可能是不完整的行，保留在 buffer 中
          const lines = buffer.split('\n')
          // pop() 取出最后一个元素（可能是不完整的行），放回 buffer 等待补全
          buffer = lines.pop() || ''

          // 逐行处理完整的行
          for (const line of lines) {
            const trimmed = line.trim()
            // 跳过空行和注释行
            if (!trimmed) continue

            // SSE 标准格式：以 "data: " 开头
            if (trimmed.startsWith('data: ')) {
              // 提取 data: 后面的内容（去掉前6个字符 "data: "）
              const data = trimmed.slice(6)

              // 检测流结束标记
              if (data === '[DONE]') {
                callbacks.onDone?.()
                return
              }

              // 尝试将数据解析为 JSON 对象
              try {
                const parsed = JSON.parse(data)
                // 兼容多种字段名：content / text / delta
                const content = parsed.content || parsed.text || parsed.delta || ''
                if (content) {
                  callbacks.onMessage(content)
                }
              } catch {
                // JSON 解析失败时，将原始字符串作为内容传递
                // 兼容纯文本格式的 SSE 实现
                callbacks.onMessage(data)
              }
            }
          }
        }
      } finally {
        // 无论流是正常结束还是异常退出，都要释放读取器锁
        // 否则会导致资源泄漏
        reader.releaseLock()
      }

      // 流自然结束（reader.read() 返回 done=true）
      callbacks.onDone?.()
    })
    .catch((err: Error) => {
      // AbortError 是用户主动取消，不需要报错
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err)
      }
    })

  return controller
}

/**
 * 模拟流式响应 —— 逐字输出文本，用于开发调试/Mock 场景
 *
 * ## 工作原理
 * 使用 setTimeout 递归调度，每次输出 chunkSize 个字符，
 * 模拟真实的网络流式传输效果。
 *
 * ## 参数说明
 * - `charDelay`：每个字符块之间的延迟（毫秒），默认 20ms
 * - `chunkSize`：每次输出的字符数，默认 3
 * - 实际延迟会加上一个随机值（0~10ms），让模拟效果更自然
 *
 * @param fullText - 要逐字输出的完整文本
 * @param callbacks - 回调函数集合
 * @param options - 可选配置（延迟、块大小）
 * @returns 清理函数，调用后可停止模拟
 *
 * @example
 * ```ts
 * const stop = simulateStream('Hello World', {
 *   onMessage: (chunk) => console.log(chunk),
 *   onDone: () => console.log('完成'),
 * })
 * // 提前停止：
 * // stop()
 * ```
 */
export function simulateStream(
  fullText: string,
  callbacks: StreamCallbacks,
  options?: { charDelay?: number; chunkSize?: number }
): () => void {
  const { charDelay = 20, chunkSize = 3 } = options || {}
  let index = 0       // 当前已输出的字符位置
  let cancelled = false // 取消标记

  function pump() {
    // 如果已取消或已输出完所有文本
    if (cancelled || index >= fullText.length) {
      if (!cancelled) {
        callbacks.onDone?.()
      }
      return
    }

    // 截取下一段文本块
    const chunk = fullText.slice(index, index + chunkSize)
    index += chunk.length
    callbacks.onMessage(chunk)

    // 递归调度下一次输出，加入随机延迟使效果更自然
    setTimeout(pump, charDelay + Math.random() * 10)
  }

  // 首次调用有 100ms 的初始延迟，模拟网络请求的往返时间
  setTimeout(pump, 100)

  // 返回取消函数
  return () => {
    cancelled = true
  }
}
