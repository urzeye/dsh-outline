/**
 * OutlineManager：面板侧唯一状态所有者（框架无关，可单测）。
 * 组合 outline-tree 的纯函数，持有 expandLevel / 搜索 / 收藏状态并对外通知。
 */
import { itemSignature } from './signature.ts'
import {
  buildTree, captureCollapseState, clearForceExpandedState, clearForceVisible,
  computeLevelCounts, flattenVisible, markBookmarkedPaths, maxActualLevel,
  restoreCollapseState, revealPath,
} from './outline-tree.ts'
import type { OutlineItem, OutlineNode, OutlineState } from './types.ts'
import type { CollapseRecord } from './outline-tree.ts'

export interface OutlineManagerOptions {
  expandLevel?: number
  /** 初始收藏 id 集（持久化恢复）。 */
  bookmarks?: Iterable<string>
  /** expandLevel 变化回调（持久化偏好用）。 */
  onExpandLevelChange?: (level: number) => void
  /** 收藏集变化回调（持久化用）。 */
  onBookmarksChange?: (ids: ReadonlySet<string>) => void
}

export class OutlineManager {
  private items: OutlineItem[] = []
  private tree: OutlineNode[] = []
  private expandLevel: number
  private searchQuery = ''
  private matchCount = 0
  private bookmarkMode = false
  private bookmarkIds: Set<string>
  private readonly onExpandLevelChange?: (level: number) => void
  private readonly onBookmarksChange?: (ids: ReadonlySet<string>) => void
  private listeners = new Set<() => void>()

  constructor(options: OutlineManagerOptions = {}) {
    this.expandLevel = options.expandLevel ?? 6
    this.bookmarkIds = new Set(options.bookmarks ?? [])
    this.onExpandLevelChange = options.onExpandLevelChange
    this.onBookmarksChange = options.onBookmarksChange
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private notify(): void {
    for (const fn of this.listeners) fn()
  }

  /** 数据源推送新一批扁平项。签名按当前批次重算（同文本多次出现按序消歧）。 */
  setItems(items: readonly Omit<OutlineItem, 'id'>[]): void {
    const seen = new Map<string, number>()
    const signed: OutlineItem[] = items.map((item) => {
      const base = `${item.level}:${item.text}`
      const occ = seen.get(base) ?? 0
      seen.set(base, occ + 1)
      return { ...item, id: itemSignature(item.level, item.text, occ) }
    })

    const saved: Map<string, CollapseRecord> = this.tree.length > 0
      ? captureCollapseState(this.tree)
      : new Map()
    this.items = signed
    this.tree = buildTree(signed)
    restoreCollapseState(this.tree, saved, this.expandLevel)
    markBookmarkedPaths(this.tree, this.bookmarkIds)
    if (this.searchQuery !== '') this.performSearch(this.searchQuery)
    this.notify()
  }

  getState(): OutlineState {
    return {
      tree: this.tree,
      visible: flattenVisible(this.tree, {
        expandLevel: this.expandLevel,
        searching: this.searchQuery !== '',
        bookmarkMode: this.bookmarkMode,
      }),
      expandLevel: this.expandLevel,
      isAllExpanded: this.expandLevel >= maxActualLevel(this.items),
      levelCounts: computeLevelCounts(this.items),
      searchQuery: this.searchQuery,
      matchCount: this.matchCount,
      bookmarkMode: this.bookmarkMode,
      bookmarkIds: this.bookmarkIds,
    }
  }

  /** 层级滑块：展开/收起到指定层级（0 = 只显示用户问题）。 */
  setLevel(level: number): void {
    this.expandLevel = Math.max(0, Math.min(6, level))
    clearForceExpandedState(this.tree, this.expandLevel)
    this.onExpandLevelChange?.(this.expandLevel)
    this.notify()
  }

  expandAll(): void {
    this.setLevel(maxActualLevel(this.items))
  }

  collapseAll(): void {
    this.setLevel(0)
  }

  /** 单节点折叠/展开；展开打 forceExpanded，调层前不被层级规则误收。 */
  toggleNode(index: number): void {
    const node = this.findNode(index)
    if (node === null || node.children.length === 0) return
    node.collapsed = !node.collapsed
    if (!node.collapsed) node.forceExpanded = true
    this.notify()
  }

  /** 点击定位时揭示目标路径（若目标当前不可见）。 */
  revealNode(index: number): void {
    clearForceVisible(this.tree, this.expandLevel)
    if (revealPath(this.tree, index)) this.notify()
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query
    if (query === '') {
      this.matchCount = 0
      // 退出搜索：回到层级规则
      clearForceExpandedState(this.tree, this.expandLevel)
    } else {
      this.performSearch(query)
    }
    this.notify()
  }

  private performSearch(query: string): void {
    const needle = query.toLowerCase()
    let count = 0
    const traverse = (nodes: OutlineNode[]): boolean => {
      let anyMatch = false
      for (const node of nodes) {
        node.isMatch = node.text.toLowerCase().includes(needle)
        if (node.isMatch) count++
        node.hasMatchedDescendant = traverse(node.children)
        if (node.hasMatchedDescendant) node.collapsed = false
        if (node.isMatch || node.hasMatchedDescendant) anyMatch = true
      }
      return anyMatch
    }
    traverse(this.tree)
    this.matchCount = count
  }

  setBookmarkMode(on: boolean): void {
    this.bookmarkMode = on
    this.notify()
  }

  toggleBookmark(index: number): void {
    const node = this.findNode(index)
    if (node === null) return
    if (this.bookmarkIds.has(node.id)) {
      this.bookmarkIds.delete(node.id)
    } else {
      this.bookmarkIds.add(node.id)
    }
    markBookmarkedPaths(this.tree, this.bookmarkIds)
    this.onBookmarksChange?.(this.bookmarkIds)
    this.notify()
  }

  private findNode(index: number): OutlineNode | null {
    const walk = (nodes: readonly OutlineNode[]): OutlineNode | null => {
      for (const node of nodes) {
        if (node.index === index) return node
        const hit = walk(node.children)
        if (hit !== null) return hit
      }
      return null
    }
    return walk(this.tree)
  }
}
