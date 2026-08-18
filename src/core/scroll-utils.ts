/** 滚动定位工具（移植自 Ophel src/core/outline/dom-outline.ts，去掉站点耦合）。 */

export function findScrollableAncestor(element: Element | null): HTMLElement | null {
  let current = element?.parentElement || null
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY
    const canScroll =
      current.scrollHeight > current.clientHeight &&
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
    if (canScroll) return current
    current = current.parentElement
  }
  return null
}

export function scrollElementInContainer(
  element: HTMLElement,
  container: HTMLElement | null,
  offset = 12,
): boolean {
  if (!container || container === element) return false
  const containerRect = container.getBoundingClientRect()
  const targetRect = element.getBoundingClientRect()
  container.scrollTo({
    top: container.scrollTop + targetRect.top - containerRect.top - offset,
    behavior: 'instant' as ScrollBehavior,
  })
  return true
}

/**
 * 仅当 element 不完全在 container 可视区内时滚动 container（nearest）。
 * 不调用 scrollIntoView，避免把祖先（聊天区）一起带走。
 * @returns 是否发生了滚动
 */
export function ensureElementInView(
  element: HTMLElement,
  container: HTMLElement,
  padding = 8,
): boolean {
  if (container === element) return false
  const cRect = container.getBoundingClientRect()
  const eRect = element.getBoundingClientRect()
  const topLimit = cRect.top + padding
  const bottomLimit = cRect.bottom - padding
  if (eRect.top >= topLimit && eRect.bottom <= bottomLimit) return false
  const delta = eRect.top < topLimit
    ? eRect.top - topLimit
    : eRect.bottom - bottomLimit
  container.scrollTo({
    top: container.scrollTop + delta,
    behavior: 'instant' as ScrollBehavior,
  })
  return true
}
