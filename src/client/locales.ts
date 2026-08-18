/** `outline` namespace dictionaries (zh 为键集合基准，en 对齐检查）。 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': '大纲',
  'panel.open': '大纲面板',
  'panel.close': '关闭',
  'panel.pin': '固定面板',
  'panel.unpin': '取消固定',
  'panel.github': '在 GitHub 上查看',
  'panel.empty': '暂无大纲内容',
  'panel.emptyHint': '发送一条消息，或等待助手回复中出现标题',
  'search.placeholder': '搜索大纲…',
  'search.clear': '清除搜索',
  'search.matchCount': '{count} 个匹配',
  'level.tooltip': 'H{level}：{count} 个',
  'level.zero': '仅问题',
  'action.expandAll': '展开全部',
  'action.collapseAll': '收起全部',
  'action.bookmarkMode': '只看收藏',
  'action.bookmarkAdd': '收藏',
  'action.bookmarkRemove': '取消收藏',
  'action.copy': '复制大纲',
  'action.copied': '已复制',
  'action.scrollTop': '回到顶部',
  'action.scrollBottom': '回到底部',
  'action.unlocatable': '当前节点暂不可定位',
} satisfies Record<string, string>

/** The outline namespace key union. */
export type OutlineKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'panel.title': 'Outline',
  'panel.open': 'Outline panel',
  'panel.close': 'Close',
  'panel.pin': 'Pin panel',
  'panel.unpin': 'Unpin panel',
  'panel.github': 'View on GitHub',
  'panel.empty': 'No outline yet',
  'panel.emptyHint': 'Send a message, or wait for headings in the assistant reply',
  'search.placeholder': 'Search outline…',
  'search.clear': 'Clear search',
  'search.matchCount': '{count} matches',
  'level.tooltip': 'H{level}: {count}',
  'level.zero': 'Questions only',
  'action.expandAll': 'Expand all',
  'action.collapseAll': 'Collapse all',
  'action.bookmarkMode': 'Bookmarks only',
  'action.bookmarkAdd': 'Bookmark',
  'action.bookmarkRemove': 'Remove bookmark',
  'action.copy': 'Copy outline',
  'action.copied': 'Copied',
  'action.scrollTop': 'Scroll to top',
  'action.scrollBottom': 'Scroll to bottom',
  'action.unlocatable': 'This item is not available yet',
} satisfies Record<OutlineKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'outline'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The outline panel's copy. */
    outline: OutlineKey
  }
}
