import { describe, expect, it, vi } from 'vitest'
import { ensureElementInView } from '../src/core/scroll-utils.ts'

function rect(top: number, height: number, left = 0, width = 200): DOMRect {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    left,
    bottom: top + height,
    right: left + width,
    toJSON() { return this },
  }
}

function setupPair(): { container: HTMLElement, element: HTMLElement, scrollTo: ReturnType<typeof vi.fn> } {
  const container = document.createElement('div')
  const element = document.createElement('div')
  container.scrollTop = 0
  const scrollTo = vi.fn((opts: ScrollToOptions) => {
    if (typeof opts.top === 'number') container.scrollTop = opts.top
  })
  container.scrollTo = scrollTo as HTMLElement['scrollTo']
  return { container, element, scrollTo }
}

describe('ensureElementInView', () => {
  it('does not scroll when the element is fully inside the container', () => {
    const { container, element, scrollTo } = setupPair()
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect(0, 400))
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(40, 30))
    expect(ensureElementInView(element, container)).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls down when the element sits below the visible area', () => {
    const { container, element, scrollTo } = setupPair()
    container.scrollTop = 0
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect(0, 400))
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(420, 30))
    expect(ensureElementInView(element, container)).toBe(true)
    expect(scrollTo).toHaveBeenCalledOnce()
    // padding 8 → bottomLimit = 392, delta = 450 - 392 = 58
    expect(container.scrollTop).toBe(58)
  })

  it('scrolls up when the element sits above the visible area', () => {
    const { container, element } = setupPair()
    container.scrollTop = 200
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect(0, 400))
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect(-40, 30))
    expect(ensureElementInView(element, container)).toBe(true)
    // padding 8 → topLimit = 8, delta = -40 - 8 = -48
    expect(container.scrollTop).toBe(152)
  })
})
