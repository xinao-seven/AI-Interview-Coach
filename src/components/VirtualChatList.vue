<script setup lang="ts">
/**
 * VirtualChatList — 基于动态高度测量的虚拟聊天列表
 * ======================================================
 *
 * ## 解决的问题
 * 聊天消息累积到数百条时，全量 DOM 渲染导致：
 * - 初始渲染阻塞主线程（Layout/Paint 耗时随消息数线性增长）
 * - 滚动帧率下降（大量 DOM 节点导致 Style/Composite 开销）
 * - 内存占用过高
 *
 * ## 核心设计
 * 1. **动态高度测量**：ResizeObserver 监听每个已渲染项的实际高度并缓存
 * 2. **预估高度回退**：未测量项使用默认预估值
 * 3. **可视区域裁剪**：仅渲染 viewport ± overscan 范围内的项
 * 4. **自动粘底**：新消息时自动滚底；用户手动上滚阅读历史时暂停
 * 5. **流式适配**：消息 streaming 中持续增长，ResizeObserver 实时捕获高度变化
 *
 * ## 使用方式
 * ```vue
 * <VirtualChatList :items="messages" :estimated-item-height="120">
 *   <template #default="{ item }">
 *     <ChatBubble :msg="item" />
 *   </template>
 * </VirtualChatList>
 * ```
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

// ─── Props & Emits ──────────────────────────────

const props = withDefaults(defineProps<{
  /** 数据源（每项必须有唯一 id） */
  items: Record<string, any>[]
  /** 未测量项的预估高度（px） */
  estimatedItemHeight?: number
  /** 可视区外额外渲染的项数 */
  overscan?: number
  /** 是否自动粘底 */
  stickToBottom?: boolean
}>(), {
  estimatedItemHeight: 120,
  overscan: 3,
  stickToBottom: true,
})

const emit = defineEmits<{
  (e: 'scroll-end'): void
}>()

// ─── 状态 ──────────────────────────────────────

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(600)
const userScrollingUp = ref(false)
const heightCache = ref<Record<string, number>>({})  // id -> measured height
const itemElMap = new Map<string, HTMLElement>()
let resizeObserver: ResizeObserver | null = null
let prevItemCount = 0

// ─── 辅助函数 ──────────────────────────────────

function getItemId(item: Record<string, any>): string {
  return String(item.id || item._key || '')
}

function getItemHeight(id: string): number {
  return heightCache.value[id] ?? props.estimatedItemHeight
}

// ─── 累积偏移量 ────────────────────────────────

const offsets = computed(() => {
  const arr: number[] = [0]
  for (let i = 0; i < props.items.length; i++) {
    const id = getItemId(props.items[i])
    arr.push(arr[i] + getItemHeight(id))
  }
  return arr
})

const totalHeight = computed(() =>
  offsets.value.length > 0 ? offsets.value[offsets.value.length - 1] : 0
)

// ─── 可见范围（二分查找）───────────────────────

const startIndex = computed(() => {
  if (offsets.value.length <= 1) return 0
  const target = scrollTop.value
  let lo = 0, hi = props.items.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (offsets.value[mid] <= target) lo = mid + 1
    else hi = mid
  }
  return Math.max(0, lo - 1 - props.overscan)
})

const endIndex = computed(() => {
  if (offsets.value.length <= 1) return props.items.length
  const target = scrollTop.value + containerHeight.value
  let lo = 0, hi = props.items.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (offsets.value[mid] <= target) lo = mid + 1
    else hi = mid
  }
  return Math.min(props.items.length, lo + props.overscan)
})

const visibleItems = computed(() => {
  const result: { item: Record<string, any>; idx: number; top: number; id: string }[] = []
  for (let i = startIndex.value; i < endIndex.value; i++) {
    const item = props.items[i]
    if (!item) continue
    const id = getItemId(item)
    result.push({ item, idx: i, top: offsets.value[i], id })
  }
  return result
})

// ─── ResizeObserver 高度测量 ────────────────────

function initObserver() {
  if (resizeObserver) return
  resizeObserver = new ResizeObserver((entries) => {
    let changed = false
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      const id = el.dataset.virtualId
      if (!id) continue
      const h = Math.round(entry.contentRect.height)
      if (h > 0 && heightCache.value[id] !== h) {
        heightCache.value = { ...heightCache.value, [id]: h }
        changed = true
      }
    }
  })
}

function observeItem(el: HTMLElement, id: string) {
  if (!resizeObserver) initObserver()
  if (el.dataset.virtualId === id) return
  // 取消旧观察
  const old = itemElMap.get(id)
  if (old && old !== el) resizeObserver?.unobserve(old)
  el.dataset.virtualId = id
  resizeObserver!.observe(el)
  itemElMap.set(id, el)
}

/** 模板 ref 回调：绑定 ResizeObserver */
function onItemRef(el: Element | any, id: string) {
  if (el instanceof HTMLElement) observeItem(el, id)
}

// ─── 滚动控制 ──────────────────────────────────

function handleScroll(e: Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
  userScrollingUp.value = dist > 50
  if (dist < 5) emit('scroll-end')
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  nextTick(() => {
    const el = containerRef.value
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    userScrollingUp.value = false
  })
}

defineExpose({ scrollToBottom })

// ─── Watchers ──────────────────────────────────

watch(() => props.items.length, (n) => {
  if (n > prevItemCount && props.stickToBottom && !userScrollingUp.value) {
    scrollToBottom()
  }
  prevItemCount = n
})

// 深度监听：流式消息增长时自动滚底
watch(() => props.items, () => {
  if (props.stickToBottom && !userScrollingUp.value) {
    nextTick(() => scrollToBottom())
  }
}, { deep: true, flush: 'post' })

// ─── 生命周期 ──────────────────────────────────
onMounted(() => {
  initObserver()
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
    new ResizeObserver(([e]) => {
      if (e) containerHeight.value = e.contentRect.height
    }).observe(containerRef.value)
  }
  if (props.stickToBottom) scrollToBottom()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  itemElMap.clear()
})
</script>

<template>
  <div
    ref="containerRef"
    class="virtual-chat-container"
    @scroll="handleScroll"
  >
    <!-- 外层相对定位包裹：phantom 撑高 + viewport 叠加 -->
    <div class="virtual-chat-inner" :style="{ minHeight: totalHeight + 'px' }">
      <div
        v-for="vi in visibleItems"
        :key="vi.id"
        :ref="(el: any) => onItemRef(el, vi.id)"
        class="virtual-chat-item"
        :style="{ position: 'absolute', top: vi.top + 'px', left: 0, right: 0 }"
      >
        <slot name="default" :item="vi.item" :index="vi.idx" />
      </div>
    </div>

    <!-- 回到底部按钮 -->
    <transition name="vb-fade">
      <div
        v-if="userScrollingUp && stickToBottom"
        class="scroll-bottom-btn"
        @click="scrollToBottom('smooth')"
      >
        <span>↓ 回到底部</span>
        <span v-if="items.length" class="count-badge">{{ items.length }} 条</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.virtual-chat-container {
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  will-change: scroll-position;
}

/*
 * 关键布局：inner 使用 minHeight 撑开滚动条，
 * 内部的 item 用 position:absolute + top 定位。
 * 这消除了 phantom+viewport 分离导致的 y 偏移问题。
 */
.virtual-chat-inner {
  position: relative;
  width: 100%;
}

.virtual-chat-item {
  width: 100%;
  box-sizing: border-box;
}

.scroll-bottom-btn {
  position: sticky;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #409eff;
  color: #fff;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.35);
  z-index: 10;
  width: fit-content;
  transition: transform 0.2s, box-shadow 0.2s;
}
.scroll-bottom-btn:hover {
  transform: translateX(-50%) translateY(-1px);
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.45);
}
.count-badge {
  font-size: 11px;
  opacity: 0.8;
  padding-left: 8px;
  border-left: 1px solid rgba(255,255,255,0.4);
}
.vb-fade-enter-active, .vb-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.vb-fade-enter-from, .vb-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
