import { describe, expect, it } from 'vitest'
import {
  buildTree, captureCollapseState, clearForceExpandedState, flattenVisible,
  maxActualLevel, computeLevelCounts, markBookmarkedPaths, restoreCollapseState,
  revealPath, clearForceVisible,
} from '../src/core/outline-tree.ts'
import type { OutlineItem, OutlineNode } from '../src/core/types.ts'

function item(level: number, text: string): OutlineItem {
  return { level, text, id: `${level}:${text}`, ...(level === 0 ? { isUserQuery: true } : {}) }
}

/** Q1(h2 a, h3 b) Q2(h1 c) */
function sampleItems(): OutlineItem[] {
  return [
    item(0, '问题一'),
    item(2, '方案A'),
    item(3, '细节a'),
    item(0, '问题二'),
    item(1, '总结'),
  ]
}

function texts(nodes: readonly OutlineNode[]): string[] {
  return nodes.map((n) => n.text)
}

describe('buildTree', () => {
  it('nests headings under the current user question', () => {
    const tree = buildTree(sampleItems())
    expect(texts(tree)).toEqual(['问题一', '问题二'])
    expect(texts(tree[0]?.children ?? [])).toEqual(['方案A'])
    expect(texts(tree[0]?.children[0]?.children ?? [])).toEqual(['细节a'])
    expect(texts(tree[1]?.children ?? [])).toEqual(['总结'])
  })

  it('assigns sequential indices and query numbers', () => {
    const tree = buildTree(sampleItems())
    expect(tree[0]?.index).toBe(0)
    expect(tree[0]?.queryIndex).toBe(1)
    expect(tree[1]?.index).toBe(3)
    expect(tree[1]?.queryIndex).toBe(2)
  })
})

describe('level state machine', () => {
  it('setLevel(0) collapses every node whose children are all headings', () => {
    const tree = buildTree(sampleItems())
    clearForceExpandedState(tree, 0)
    expect(tree[0]?.collapsed).toBe(true)
    expect(tree[1]?.collapsed).toBe(true)
    const visible = flattenVisible(tree, { expandLevel: 0, searching: false, bookmarkMode: false })
    expect(texts(visible)).toEqual(['问题一', '问题二'])
  })

  it('setLevel(2) shows h2 but hides h3; node with only deeper children reads collapsed', () => {
    const tree = buildTree(sampleItems())
    clearForceExpandedState(tree, 2)
    const h2 = tree[0]?.children[0]
    expect(h2?.collapsed).toBe(true) // 唯一子级 细节a 是 h3
    const visible = flattenVisible(tree, { expandLevel: 2, searching: false, bookmarkMode: false })
    expect(texts(visible)).toEqual(['问题一', '方案A', '问题二', '总结'])
  })

  it('manual expand (forceExpanded) survives beyond expandLevel until setLevel clears it', () => {
    const tree = buildTree(sampleItems())
    clearForceExpandedState(tree, 2)
    const h2 = tree[0]?.children[0]
    if (h2 === undefined) throw new Error('missing h2')
    // toggleNode 语义：展开 → forceExpanded
    h2.collapsed = false
    h2.forceExpanded = true
    let visible = flattenVisible(tree, { expandLevel: 2, searching: false, bookmarkMode: false })
    expect(texts(visible)).toContain('细节a')
    // setLevel 清算 forceExpanded
    clearForceExpandedState(tree, 2)
    visible = flattenVisible(tree, { expandLevel: 2, searching: false, bookmarkMode: false })
    expect(texts(visible)).not.toContain('细节a')
  })

  it('collapsed node hides its subtree', () => {
    const tree = buildTree(sampleItems())
    clearForceExpandedState(tree, 6)
    const q1 = tree[0]
    if (q1 === undefined) throw new Error('missing q1')
    q1.collapsed = true
    const visible = flattenVisible(tree, { expandLevel: 6, searching: false, bookmarkMode: false })
    expect(texts(visible)).toEqual(['问题一', '问题二', '总结'])
  })
})

describe('collapse state reconciliation', () => {
  it('restores collapsed/forceExpanded by id after rebuild; new nodes init by level rule', () => {
    const tree = buildTree(sampleItems())
    clearForceExpandedState(tree, 6)
    const q1 = tree[0]
    if (q1 === undefined) throw new Error('missing q1')
    q1.collapsed = true
    const saved = captureCollapseState(tree)

    const rebuilt = buildTree([...sampleItems(), item(2, '新增方案')])
    restoreCollapseState(rebuilt, saved, 2)
    expect(rebuilt[0]?.collapsed).toBe(true)
    // 新增节点（h2，跟在 h1 总结 后面 → 按层级嵌套为 总结 的子级）按规则初始化——此处无子级
    const added = rebuilt[1]?.children[0]?.children.find((n) => n.text === '新增方案')
    expect(added).toBeDefined()
    expect(added?.collapsed).toBe(false)
  })
})

describe('search and bookmark filtering', () => {
  it('search bypasses level limit and shows match ancestors', () => {
    const tree = buildTree(sampleItems())
    // 模拟 performSearch 的标记结果
    const h3 = tree[0]?.children[0]?.children[0]
    if (h3 === undefined) throw new Error('missing h3')
    h3.isMatch = true
    const q1 = tree[0]
    const h2 = tree[0]?.children[0]
    if (q1 === undefined || h2 === undefined) throw new Error('missing')
    q1.hasMatchedDescendant = true
    h2.hasMatchedDescendant = true
    q1.collapsed = false
    h2.collapsed = false
    const visible = flattenVisible(tree, { expandLevel: 0, searching: true, bookmarkMode: false })
    expect(texts(visible)).toEqual(['问题一', '方案A', '细节a'])
  })

  it('bookmark mode shows bookmarked nodes and their ancestor paths', () => {
    const tree = buildTree(sampleItems())
    markBookmarkedPaths(tree, new Set(['3:细节a']))
    const visible = flattenVisible(tree, { expandLevel: 6, searching: false, bookmarkMode: true })
    expect(texts(visible)).toEqual(['问题一', '方案A', '细节a'])
  })
})

describe('revealPath / clearForceVisible', () => {
  it('reveals the target path and clearForceVisible restores level rules', () => {
    const tree = buildTree(sampleItems())
    clearForceExpandedState(tree, 0)
    const h3 = tree[0]?.children[0]?.children[0]
    if (h3 === undefined) throw new Error('missing h3')
    expect(revealPath(tree, h3.index)).toBe(true)
    let visible = flattenVisible(tree, { expandLevel: 0, searching: false, bookmarkMode: false })
    expect(texts(visible)).toContain('细节a')
    clearForceVisible(tree, 0)
    visible = flattenVisible(tree, { expandLevel: 0, searching: false, bookmarkMode: false })
    expect(texts(visible)).toEqual(['问题一', '问题二'])
  })
})

describe('level stats', () => {
  it('computes levelCounts and maxActualLevel', () => {
    const items = sampleItems()
    expect(computeLevelCounts(items)).toEqual({ 1: 1, 2: 1, 3: 1 })
    expect(maxActualLevel(items)).toBe(3)
    expect(maxActualLevel([item(0, '只有问题')])).toBe(0)
  })
})
