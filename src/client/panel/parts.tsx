/** 面板子组件与内联图标（14px、currentColor，随 DSH 主题变色）。 */
import type { OutlineNode } from '../../core/types.ts'
import type { OutlinePanelProps } from './OutlinePanel.tsx'
import css from './panel.module.css'

type Translate = OutlinePanelProps['t']

export function LevelSlider(props: {
  expandLevel: number
  levelCounts: Record<number, number>
  onChange: (level: number) => void
  t: Translate
}) {
  const { expandLevel, levelCounts, onChange, t } = props
  return (
    <div className={css.slider} role="group" aria-label="level">
      <div className={css.sliderDots}>
        <div className={css.sliderTrack}>
          <div className={css.sliderProgress} style={{ width: `${(expandLevel / 6) * 100}%` }} />
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((level) => (
          <button
            key={level}
            type="button"
            className={level > expandLevel
              ? css.dot
              : `${css.dot} ${css.dotActive} ${level === expandLevel ? css.dotCurrent : ''}`}
            title={level === 0 ? t('level.zero') : t('level.tooltip', { level, count: levelCounts[level] ?? 0 })}
            aria-label={level === 0 ? t('level.zero') : `H${level}`}
            onClick={() => onChange(level)}
          />
        ))}
      </div>
      <span className={css.sliderLabel}>
        {expandLevel === 0 ? t('level.zero') : `H${expandLevel}`}
      </span>
    </div>
  )
}

export function OutlineRow(props: {
  node: OutlineNode
  active: boolean
  query: string
  onClick: (node: OutlineNode) => void
  onToggle: (node: OutlineNode) => void
  onBookmark: (node: OutlineNode) => void
  t: Translate
}) {
  const { node, active, query, onClick, onToggle, onBookmark, t } = props
  const hasChildren = node.children.length > 0
  return (
    <div
      className={`${css.item} ${active ? css.itemActive : ''} ${node.isUserQuery === true ? css.itemUser : ''}`}
      style={{ paddingLeft: 8 + node.level * 14 }}
      data-level={node.level}
      role="button"
      tabIndex={0}
      onClick={() => onClick(node)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onClick(node)
      }}
    >
      <span
        className={`${css.chevron} ${!hasChildren ? css.chevronHidden : ''} ${!node.collapsed ? css.chevronOpen : ''}`}
        onClick={(e) => {
          if (!hasChildren) return
          e.stopPropagation()
          onToggle(node)
        }}
      >
        <ChevronGlyph />
      </span>
      {node.isUserQuery === true && (
        <span className={css.queryBadge}>{node.queryIndex}</span>
      )}
      <span className={`${css.itemText} ${node.streaming === true ? css.itemStreaming : ''}`}>
        <HighlightText text={node.text} query={query} isMatch={node.isMatch === true} />
      </span>
      <span
        className={`${css.bookmark} ${node.isBookmarked === true ? css.bookmarkActive : ''}`}
        title={node.isBookmarked === true ? t('action.bookmarkRemove') : t('action.bookmarkAdd')}
        onClick={(e) => {
          e.stopPropagation()
          onBookmark(node)
        }}
      >
        <StarGlyph />
      </span>
    </div>
  )
}

function HighlightText(props: { text: string; query: string; isMatch: boolean }) {
  const { text, query, isMatch } = props
  if (query === '' || !isMatch) return <>{text}</>
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let i = 0
  while (i < text.length) {
    const hit = lower.indexOf(needle, i)
    if (hit === -1) {
      parts.push({ text: text.slice(i), hit: false })
      break
    }
    if (hit > i) parts.push({ text: text.slice(i, hit), hit: false })
    parts.push({ text: text.slice(hit, hit + needle.length), hit: true })
    i = hit + needle.length
  }
  return (
    <>
      {parts.map((part, idx) => part.hit
        ? <mark key={idx} className={css.mark}>{part.text}</mark>
        : part.text)}
    </>
  )
}

export function OutlineGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 3.5h10M2 7h6.5M2 10.5h8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function MinusGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CloseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 展开/收起全部：上下双向箭头 */
export function ExpandAllGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3.2 5.4L7 1.8l3.8 3.6M3.2 8.6L7 12.2l3.8-3.6"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

export function SearchGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6.3" cy="6.3" r="3.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.2 9.2l2.6 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function StarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 10.1l-3.2 1.6.6-3.6L1.8 5.6l3.6-.5L7 1.8z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
      />
    </svg>
  )
}

export function CopyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M9.5 4.5v-1a1.2 1.2 0 0 0-1.2-1.2H3.7A1.2 1.2 0 0 0 2.5 3.5v4.6a1.2 1.2 0 0 0 1.2 1.2h1"
        stroke="currentColor" strokeWidth="1.2"
      />
    </svg>
  )
}

/** 回到顶部：上箭头 + 顶线 */
export function ScrollTopGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 2.5h9M7 11.5V5.2M4.6 7.4L7 5l2.4 2.4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

/** 回到底部：下箭头 + 底线 */
export function ScrollBottomGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2.5 11.5h9M7 2.5v6.3M4.6 6.6L7 9l2.4-2.4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M4 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
