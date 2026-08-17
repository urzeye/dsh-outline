import { describe, expect, it, vi } from 'vitest'
import { OutlineManager } from '../src/core/outline-manager.ts'

const Q1 = { level: 0, text: '问题一', isUserQuery: true, userIndex: 0 }
const H2A = { level: 2, text: '方案A', headingIndex: 0 }
const H3A = { level: 3, text: '细节a', headingIndex: 1 }
const Q2 = { level: 0, text: '问题二', isUserQuery: true, userIndex: 1 }
const H1C = { level: 1, text: '总结', headingIndex: 2 }

function sample() {
  return [Q1, H2A, H3A, Q2, H1C]
}

describe('OutlineManager', () => {
  it('builds state with visible rows and level counts', () => {
    const m = new OutlineManager()
    m.setItems(sample())
    const s = m.getState()
    expect(s.visible.map((n) => n.text)).toEqual(['问题一', '方案A', '细节a', '问题二', '总结'])
    expect(s.levelCounts).toEqual({ 1: 1, 2: 1, 3: 1 })
    expect(s.isAllExpanded).toBe(true)
  })

  it('setLevel(0) keeps only user questions; setLevel persists via callback', () => {
    const onLevel = vi.fn()
    const m = new OutlineManager({ onExpandLevelChange: onLevel })
    m.setItems(sample())
    m.setLevel(0)
    expect(m.getState().visible.map((n) => n.text)).toEqual(['问题一', '问题二'])
    expect(m.getState().isAllExpanded).toBe(false)
    expect(onLevel).toHaveBeenCalledWith(0)
  })

  it('toggleNode expands a node beyond expandLevel; setLevel resets it', () => {
    const m = new OutlineManager({ expandLevel: 2 })
    m.setItems(sample())
    // 层级 2 下 细节a(h3) 不可见
    expect(m.getState().visible.map((n) => n.text)).not.toContain('细节a')
    const h2 = m.getState().tree[0]?.children[0]
    if (h2 === undefined) throw new Error('missing h2')
    m.toggleNode(h2.index)
    expect(m.getState().visible.map((n) => n.text)).toContain('细节a')
    m.setLevel(2)
    expect(m.getState().visible.map((n) => n.text)).not.toContain('细节a')
  })

  it('expandAll / collapseAll', () => {
    const m = new OutlineManager()
    m.setItems(sample())
    m.collapseAll()
    expect(m.getState().expandLevel).toBe(0)
    m.expandAll()
    expect(m.getState().expandLevel).toBe(3)
    expect(m.getState().isAllExpanded).toBe(true)
  })

  it('incremental rebuild preserves manual collapse by signature id', () => {
    const m = new OutlineManager()
    m.setItems(sample())
    const q1 = m.getState().tree[0]
    if (q1 === undefined) throw new Error('missing q1')
    m.toggleNode(q1.index) // 折叠问题一
    // 流式追加一个标题（模拟生成中）
    m.setItems([...sample(), { level: 2, text: '新标题', headingIndex: 3 }])
    const rebuilt = m.getState().tree[0]
    expect(rebuilt?.collapsed).toBe(true)
    // 新标题（h2）按层级嵌套在最后一轮 h1 总结 之下，且不影响 问题一 的折叠态
    const last = m.getState().tree[1]
    expect(last?.children[0]?.children.map((n) => n.text)).toContain('新标题')
  })

  it('duplicate texts get distinct stable ids', () => {
    const m = new OutlineManager()
    const dup = [
      Q1,
      { level: 2, text: '同名', headingIndex: 0 },
      { level: 2, text: '同名', headingIndex: 1 },
    ]
    m.setItems(dup)
    const children = m.getState().tree[0]?.children ?? []
    expect(children[0]?.id).not.toBe(children[1]?.id)
    // 重建后 id 稳定
    m.setItems(dup)
    const again = m.getState().tree[0]?.children ?? []
    expect(again[0]?.id).toBe(children[0]?.id)
  })

  it('search filters with match count and restores on clear', () => {
    const m = new OutlineManager()
    m.setItems(sample())
    m.setSearchQuery('细节')
    let s = m.getState()
    expect(s.matchCount).toBe(1)
    expect(s.visible.map((n) => n.text)).toEqual(['问题一', '方案A', '细节a'])
    m.setSearchQuery('')
    s = m.getState()
    expect(s.matchCount).toBe(0)
    expect(s.visible.map((n) => n.text)).toEqual(['问题一', '方案A', '细节a', '问题二', '总结'])
  })

  it('bookmarks toggle, filter mode, and persistence callback', () => {
    const onBookmarks = vi.fn()
    const m = new OutlineManager({ onBookmarksChange: onBookmarks })
    m.setItems(sample())
    const h3 = m.getState().tree[0]?.children[0]?.children[0]
    if (h3 === undefined) throw new Error('missing h3')
    m.toggleBookmark(h3.index)
    expect(onBookmarks).toHaveBeenCalledOnce()
    m.setBookmarkMode(true)
    expect(m.getState().visible.map((n) => n.text)).toEqual(['问题一', '方案A', '细节a'])
    m.toggleBookmark(h3.index)
    expect(m.getState().visible.map((n) => n.text)).toEqual([])
  })

  it('restored bookmark ids mark nodes after rebuild', () => {
    const first = new OutlineManager()
    first.setItems(sample())
    const h3 = first.getState().tree[0]?.children[0]?.children[0]
    if (h3 === undefined) throw new Error('missing h3')
    first.toggleBookmark(h3.index)
    const saved = [...first.getState().bookmarkIds]

    const second = new OutlineManager({ bookmarks: saved })
    second.setItems(sample())
    expect(second.getState().tree[0]?.children[0]?.children[0]?.isBookmarked).toBe(true)
  })

  it('revealNode makes a hidden target visible', () => {
    const m = new OutlineManager({ expandLevel: 0 })
    m.setItems(sample())
    const h3 = m.getState().tree[0]?.children[0]?.children[0]
    if (h3 === undefined) throw new Error('missing h3')
    expect(m.getState().visible.map((n) => n.text)).not.toContain('细节a')
    m.revealNode(h3.index)
    expect(m.getState().visible.map((n) => n.text)).toContain('细节a')
  })

  it('setItems with shallow-equal content skips rebuild and notify', () => {
    const m = new OutlineManager()
    const fn = vi.fn()
    m.subscribe(fn)
    m.setItems(sample())
    const calls = fn.mock.calls.length
    // 相同内容、新对象引用：应跳过重建，不通知
    m.setItems(sample())
    expect(fn.mock.calls.length).toBe(calls)
    // 任一字段变化：正常重建并通知
    m.setItems([...sample(), { level: 2, text: '新标题', headingIndex: 3 }])
    expect(fn.mock.calls.length).toBe(calls + 1)
    expect(m.getState().visible.map((n) => n.text)).toContain('新标题')
  })
})
