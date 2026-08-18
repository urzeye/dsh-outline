/**
 * 大纲树构建与折叠状态机（纯函数，移植自 Ophel outline-manager 的核心语义）。
 *
 * 语义定稿：
 * - setLevel(L)：清掉所有 forceExpanded，按"子级是否全部深于 L"重算 collapsed；
 * - toggleNode：单节点折叠/展开，展开时打 forceExpanded，使其子树在
 *   expandLevel 之上仍可见（下一次 setLevel 统一清算）；
 * - 搜索/收藏过滤期间绕过层级限制；定位命中的祖先链走 forceVisible。
 */
import type { OutlineItem, OutlineNode } from './types.ts'

/** 扁平 items → 树。用户问题（level 0）为顶层；标题按层级嵌套。 */
export function buildTree(items: readonly OutlineItem[]): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: OutlineNode[] = []
  let index = 0
  let queryIndex = 0
  for (const item of items) {
    const node: OutlineNode = {
      ...item,
      children: [],
      index: index++,
      collapsed: false,
      ...(item.isUserQuery ? { queryIndex: ++queryIndex } : {}),
    }
    while (stack.length > 0 && (stack[stack.length - 1]?.level ?? -1) >= node.level) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]
    if (parent === undefined) {
      roots.push(node)
    } else {
      parent.children.push(node)
    }
    stack.push(node)
  }
  return roots
}

/** 每个标题层级（1~6）的节点数。 */
export function computeLevelCounts(items: readonly OutlineItem[]): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const item of items) {
    if (item.level >= 1) counts[item.level] = (counts[item.level] ?? 0) + 1
  }
  return counts
}

/** 内容实际最大层级（无标题时为 0：只有用户问题）。 */
export function maxActualLevel(items: readonly OutlineItem[]): number {
  let max = 0
  for (const item of items) max = Math.max(max, item.level)
  return max
}

/** setLevel 的核心：清算 forceExpanded，子级全部深于 displayLevel 的节点标记 collapsed。 */
export function clearForceExpandedState(nodes: OutlineNode[], displayLevel: number): void {
  for (const node of nodes) {
    node.forceExpanded = false
    if (node.children.length > 0) {
      node.collapsed = node.children.every((child) => child.level > displayLevel)
      clearForceExpandedState(node.children, displayLevel)
    } else {
      node.collapsed = false
    }
  }
}

export interface CollapseRecord {
  collapsed: boolean
  forceExpanded: boolean
}

/** 按节点 id 捕获折叠状态（树重建后对账恢复）。 */
export function captureCollapseState(nodes: readonly OutlineNode[], out = new Map<string, CollapseRecord>()): Map<string, CollapseRecord> {
  for (const node of nodes) {
    out.set(node.id, { collapsed: node.collapsed, forceExpanded: node.forceExpanded === true })
    captureCollapseState(node.children, out)
  }
  return out
}

/** 树重建后按 id 恢复折叠状态；新节点（无记录）按 expandLevel 规则初始化。 */
export function restoreCollapseState(
  nodes: OutlineNode[],
  saved: ReadonlyMap<string, CollapseRecord>,
  displayLevel: number,
): void {
  for (const node of nodes) {
    const rec = saved.get(node.id)
    if (rec !== undefined) {
      node.collapsed = rec.collapsed
      node.forceExpanded = rec.forceExpanded
    } else if (node.children.length > 0) {
      node.collapsed = node.children.every((child) => child.level > displayLevel)
    }
    restoreCollapseState(node.children, saved, displayLevel)
  }
}

/** 为书签过滤预计算 hasBookmarkedDescendant。 */
export function markBookmarkedPaths(nodes: OutlineNode[], bookmarks: ReadonlySet<string>): boolean {
  let any = false
  for (const node of nodes) {
    const childHas = markBookmarkedPaths(node.children, bookmarks)
    node.isBookmarked = bookmarks.has(node.id)
    node.hasBookmarkedDescendant = childHas
    if (node.isBookmarked || childHas) any = true
  }
  return any
}

export interface FlattenOptions {
  expandLevel: number
  searching: boolean
  bookmarkMode: boolean
}

/**
 * 当前应渲染的扁平行（先序）。
 * 可见性 = (搜索/收藏过滤通过) && (层级通过 || 祖先链 forceExpanded || forceVisible)。
 * 折叠节点的子树不渲染（forceVisible 除外：定位/搜索揭示路径已被置为展开）。
 */
export function flattenVisible(nodes: readonly OutlineNode[], opts: FlattenOptions): OutlineNode[] {
  const out: OutlineNode[] = []
  const walk = (list: readonly OutlineNode[], forceChain: boolean): void => {
    for (const node of list) {
      const passFilter =
        (!opts.searching || node.isMatch === true || node.hasMatchedDescendant === true) &&
        (!opts.bookmarkMode || node.isBookmarked === true || node.hasBookmarkedDescendant === true)
      const passLevel =
        opts.searching || opts.bookmarkMode || forceChain ||
        node.level <= opts.expandLevel || node.forceVisible === true
      if (passFilter && passLevel) out.push(node)
      if (!node.collapsed || node.forceVisible === true) {
        walk(node.children, forceChain || node.forceExpanded === true)
      }
    }
  }
  walk(nodes, false)
  return out
}

/** 定位揭示：祖先链强制展开 + 目标与祖先打 forceVisible（不改既有 collapsed 语义）。 */
export function revealPath(nodes: OutlineNode[], targetIndex: number): boolean {
  const mark = (list: OutlineNode[], parents: OutlineNode[]): boolean => {
    for (const node of list) {
      if (node.index === targetIndex) {
        for (const p of parents) {
          p.collapsed = false
          p.forceExpanded = true
          p.forceVisible = true
        }
        node.forceVisible = true
        return true
      }
      if (mark(node.children, [...parents, node])) return true
    }
    return false
  }
  return mark(nodes, [])
}

/** 从根到目标的祖先链（含自身）；找不到返回 null。 */
function findPath(nodes: readonly OutlineNode[], id: string): OutlineNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node]
    const nested = findPath(node.children, id)
    if (nested !== null) return [node, ...nested]
  }
  return null
}

/**
 * 阅读高亮落到面板可见行：锚点本身可见则用它，否则收到最近的可见祖先。
 * 展开档位挡住子孙标题时，仍能亮起当前能看见的那一层。
 */
export function resolveVisibleActiveId(
  activeId: string | null,
  tree: readonly OutlineNode[],
  visible: readonly OutlineNode[],
): string | null {
  if (activeId === null) return null
  const visibleIds = new Set(visible.map((node) => node.id))
  if (visibleIds.has(activeId)) return activeId
  const path = findPath(tree, activeId)
  if (path === null) return null
  for (let i = path.length - 1; i >= 0; i--) {
    const id = path[i]?.id
    if (id !== undefined && visibleIds.has(id)) return id
  }
  return null
}

/** 清除全部 forceVisible 标记，并按 expandLevel 恢复被揭示路径临时改过的折叠态。 */
export function clearForceVisible(nodes: OutlineNode[], displayLevel: number): void {
  for (const node of nodes) {
    if (node.forceVisible === true) {
      node.forceVisible = false
      node.forceExpanded = false
      if (node.children.length > 0) {
        node.collapsed = node.children.every((child) => child.level > displayLevel)
      }
    }
    clearForceVisible(node.children, displayLevel)
  }
}
