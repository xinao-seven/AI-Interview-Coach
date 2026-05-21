export interface StreamCallbacks {
  onMessage: (text: string) => void
  onError?: (error: Error) => void
  onDone?: () => void
}

export interface StreamRequestOptions {
  url: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
  headers?: Record<string, string>
  callbacks: StreamCallbacks
}

/**
 * Create a fetch-based SSE stream request.
 * Returns an AbortController for cancellation.
 *
 * Protocol: SSE standard `data: ...` lines, terminated by `data: [DONE]`.
 */
export function createStreamRequest(options: StreamRequestOptions): AbortController {
  const { url, method = 'POST', body, headers = {}, callbacks } = options
  const controller = new AbortController()

  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  })
    .then(async (response) => {
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

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6)
              if (data === '[DONE]') {
                callbacks.onDone?.()
                return
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.content || parsed.text || parsed.delta || ''
                if (content) {
                  callbacks.onMessage(content)
                }
              } catch {
                callbacks.onMessage(data)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      callbacks.onDone?.()
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') {
        callbacks.onError?.(err)
      }
    })

  return controller
}

/**
 * Simulate a streaming response by outputting text character by character.
 * Returns a cleanup function to stop the simulation.
 */
export function simulateStream(
  fullText: string,
  callbacks: StreamCallbacks,
  options?: { charDelay?: number; chunkSize?: number }
): () => void {
  const { charDelay = 20, chunkSize = 3 } = options || {}
  let index = 0
  let cancelled = false

  function pump() {
    if (cancelled || index >= fullText.length) {
      if (!cancelled) {
        callbacks.onDone?.()
      }
      return
    }

    const chunk = fullText.slice(index, index + chunkSize)
    index += chunk.length
    callbacks.onMessage(chunk)

    setTimeout(pump, charDelay + Math.random() * 10)
  }

  setTimeout(pump, 100)

  return () => {
    cancelled = true
  }
}
