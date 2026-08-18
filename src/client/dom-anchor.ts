/**
 * DOM 锚定：大纲项 → 正文元素。顺序匹配，不逆向 data-chat-flow-key 的内部编码。
 *
 * 依据（demo.htm 实测 + 技术方案 §3）：
 * - 聊天气泡带稳定 data 属性 data-chat-flow-kind="user|steering|assistant-step|tool-call|..."；
 * - 大纲与正文同源同序：第 n 个 user/steering 行 = 第 n 个用户问题（含插队），
 *   第 k 个"非工具/上下文块内的 h1~h6" = 第 k 个标题大纲项；
 * - 失配（虚拟列表/未渲染分页/计数不一致）时按文本回退查找；
 *   仍找不到返回 null，由 UI 呈现"暂不可定位"，绝不静默错位滚动。
 */
import { findScrollableAncestor, scrollElementInContainer } from '../core/scroll-utils.ts'
import type { OutlineNode } from '../core/types.ts'

const EXCLUDE_ANCESTOR =
  '[data-chat-flow-kind="tool-call"], [data-chat-flow-kind="context"], [data-chat-flow-kind="turn-tail"]'
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6'
const FLASH_CLASS = 'dsho-anchor-flash'
const FLASH_MS = 1600

export function findChatRoot(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>('[data-slot="conversation"]')
}

/** 会话滚动容器（每次调用重新取，代价可忽略且避免陈旧引用）。 */
export function findChatScrollContainer(root: HTMLElement): HTMLElement | null {
  const firstFlow = root.querySelector('[data-chat-flow-kind]')
  return findScrollableAncestor(firstFlow)
}

/** 用户问题行：普通 user + 插队 steering，文档序与 outline-source 的 userIndex 对齐。 */
export function collectUserRows(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]',
  )]
}

export function collectHeadings(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)]
    .filter((el) => el.closest(EXCLUDE_ANCESTOR) === null)
}

function compactText(value: string): string {
  return value.replaceAll(/\s+/g, '')
}

function matchesUser(el: HTMLElement, item: OutlineNode): boolean {
  const probe = compactText(item.text.slice(0, 20))
  if (probe === '') return true
  return compactText(el.textContent ?? '').includes(probe)
}

function matchesHeading(el: HTMLElement, item: OutlineNode): boolean {
  return el.tagName === `H${item.level}` && (el.textContent ?? '').trim() === item.text
}

/** 顺序匹配 + 文本校验 + 回退扫描。找不到返回 null。 */
export function locateItem(root: HTMLElement, item: OutlineNode): HTMLElement | null {
  if (item.isUserQuery === true) {
    const rows = collectUserRows(root)
    const direct = item.userIndex === undefined ? undefined : rows[item.userIndex]
    if (direct !== undefined && matchesUser(direct, item)) return direct
    // 回退：索引被插队行打乱或虚拟列表错位时按文本找，绝不拿错行滚动
    if (compactText(item.text) === '') return null
    return rows.find((el) => matchesUser(el, item)) ?? null
  }

  const headings = collectHeadings(root)
  const direct = item.headingIndex === undefined ? undefined : headings[item.headingIndex]
  if (direct !== undefined && matchesHeading(direct, item)) return direct
  // 回退：取第一个 (level, text) 匹配项——重复标题场景由顺序主路径负责，回退只负责"找得到"
  return headings.find((el) => matchesHeading(el, item)) ?? null
}

/** 点击定位：滚动到目标并短暂高亮。返回是否成功。 */
export function scrollToItem(root: HTMLElement, item: OutlineNode): boolean {
  const el = locateItem(root, item)
  if (el === null) return false
  const container = findChatScrollContainer(root)
  if (container !== null) {
    scrollElementInContainer(el, container)
  } else {
    el.scrollIntoView({ block: 'start' })
  }
  el.classList.add(FLASH_CLASS)
  window.setTimeout(() => { el.classList.remove(FLASH_CLASS) }, FLASH_MS)
  return true
}

export function scrollChatToTop(root: HTMLElement): void {
  findChatScrollContainer(root)?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
}

export function scrollChatToBottom(root: HTMLElement): void {
  const container = findChatScrollContainer(root)
  if (container !== null) {
    container.scrollTo({ top: container.scrollHeight, behavior: 'instant' as ScrollBehavior })
  }
}

/**
 * 阅读位置追踪：返回当前可视区顶部最近的锚点项 id（无则 null）。
 * 由调用方用 scroll 事件 + rAF 节流驱动。
 */
export function computeActiveItemId(root: HTMLElement, items: readonly OutlineNode[]): string | null {
  const container = findChatScrollContainer(root)
  if (container === null) return null
  const threshold = container.getBoundingClientRect().top + 80
  let active: OutlineNode | null = null
  for (const item of items) {
    const el = locateItem(root, item)
    if (el === null) continue
    if (el.getBoundingClientRect().top <= threshold) {
      active = item
    } else {
      break // items 与 DOM 同序，越过阈值后即可停
    }
  }
  return active?.id ?? null
}
