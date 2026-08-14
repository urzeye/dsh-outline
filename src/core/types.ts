/**
 * Outline data model (pure, no DSH/DOM imports).
 *
 * Level convention: 0 = 用户问题节点, 1~6 = Markdown 标题层级。
 */

/** One flat outline row produced by the source adapter. */
export interface OutlineItem {
  /** 0 = 用户问题；1~6 = h1~h6。 */
  level: number
  text: string
  /** 已按 (level, text) 去重的稳定签名（djb2 + 出现序号），跨增量重建保持稳定。 */
  id: string
  isUserQuery?: boolean
  /** 在 user/steering 节点中的文档序序号（DOM 顺序匹配用）。 */
  userIndex?: number
  /** 全局标题文档序序号（DOM 顺序匹配用）。 */
  headingIndex?: number
  /** 来自流式 partial 的标题（生成中）。 */
  streaming?: boolean
  /** 超长截断标记。 */
  isTruncated?: boolean
}

/** Tree node: item + presentation/collapse state. */
export interface OutlineNode extends OutlineItem {
  children: OutlineNode[]
  /** 扁平序号（0 起，渲染与定位的稳定下标）。 */
  index: number
  /** 用户问题的展示序号（1 起，徽标数字）。 */
  queryIndex?: number
  collapsed: boolean
  /** 手动单点展开标记：setLevel 调层时统一清算，调层前不被层级规则误收。 */
  forceExpanded?: boolean
  /** 定位/搜索命中时强制可见（不改 collapsed 本身）。 */
  forceVisible?: boolean
  isMatch?: boolean
  hasMatchedDescendant?: boolean
  isBookmarked?: boolean
  hasBookmarkedDescendant?: boolean
}

export interface OutlineState {
  tree: OutlineNode[]
  /** 当前应渲染的扁平行（已按层级/搜索/收藏过滤）。 */
  visible: OutlineNode[]
  expandLevel: number
  isAllExpanded: boolean
  /** 每个标题层级（1~6）的节点数，滑块 tooltip 用。 */
  levelCounts: Record<number, number>
  searchQuery: string
  matchCount: number
  bookmarkMode: boolean
  bookmarkIds: ReadonlySet<string>
}
