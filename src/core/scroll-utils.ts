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
