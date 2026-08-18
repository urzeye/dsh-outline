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
      data-dsho-id={node.id}
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
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 3.5h10M2 7h6.5M2 10.5h8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function GitHubGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function CloseGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** 固定/取消固定面板：大头钉（24 viewBox 描边，与展开/收起图标同规格） */
export function PinGlyph() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  )
}

/** 展开全部：列表 + 外扩箭头（移植自 Ophel ExpandAllIcon，24 viewBox 描边） */
export function ExpandAllGlyph() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M4 6h6" />
      <path d="M4 10h9" />
      <path d="M4 14h9" />
      <path d="M4 18h6" />
      <path d="M18 5v14" />
      <path d="m15.5 7.5 2.5-2.5 2.5 2.5" />
      <path d="m15.5 16.5 2.5 2.5 2.5-2.5" />
    </svg>
  )
}

/** 收起全部：列表 + 内收箭头（移植自 Ophel CollapseAllIcon） */
export function CollapseAllGlyph() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M4 6h9" />
      <path d="M4 12h9" />
      <path d="M4 18h9" />
      <path d="M18 3v6" />
      <path d="m15.5 6.5 2.5 2.5 2.5-2.5" />
      <path d="M18 21v-6" />
      <path d="m15.5 17.5 2.5-2.5 2.5 2.5" />
    </svg>
  )
}

export function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6.3" cy="6.3" r="3.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.2 9.2l2.6 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function StarGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1.8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 10.1l-3.2 1.6.6-3.6L1.8 5.6l3.6-.5L7 1.8z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
      />
    </svg>
  )
}

export function CopyGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true">
      <path d="M632.96 954.88H201.813333a132.906667 132.906667 0 0 1-132.693333-132.693333V391.04a132.906667 132.906667 0 0 1 132.693333-132.906667h431.146667a132.906667 132.906667 0 0 1 132.906667 132.906667v431.146667a132.906667 132.906667 0 0 1-132.906667 132.693333zM201.813333 352a39.04 39.04 0 0 0-38.826666 39.04v431.146667a39.04 39.04 0 0 0 38.826666 38.826666h431.146667a39.04 39.04 0 0 0 39.04-38.826666V391.04a39.04 39.04 0 0 0-39.04-39.04z" />
      <path d="M907.946667 846.293333a47.146667 47.146667 0 0 1-46.933334-46.933333V234.666667A71.04 71.04 0 0 0 789.333333 162.986667H224.64a46.933333 46.933333 0 1 1 0-93.866667H789.333333A164.906667 164.906667 0 0 1 954.88 234.666667v565.333333a46.933333 46.933333 0 0 1-46.933333 46.293333z" />
      <path d="M531.626667 561.066667h-241.066667a46.933333 46.933333 0 0 1 0-93.866667h241.066667a46.933333 46.933333 0 0 1 0 93.866667zM531.626667 731.733333h-241.066667a46.933333 46.933333 0 0 1 0-93.866666h241.066667a46.933333 46.933333 0 0 1 0 93.866666z" />
    </svg>
  )
}

/** 复制成功反馈：对号（移植自 Ophel CheckIcon） */
export function CheckGlyph() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** 回到顶部：上箭头 + 顶线 */
export function ScrollTopGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
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
