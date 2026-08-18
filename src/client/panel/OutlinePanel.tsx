/**
 * 大纲面板（shell.overlay 条目，root 作用域）。
 *
 * 数据链：useSessions(全局标准套件) 取当前 sessionId → ctx.sessions.binding()
 * 拿 SessionFace → useSyncExternalStore 订阅 ConversationSnapshot →
 * buildOutlineItems 扁平化 → OutlineManager（core，持有层级/搜索/收藏状态）。
 * 面板自身只渲染与转发交互，不持有业务状态副本。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import { OutlineManager } from '../../core/outline-manager.ts'
import { resolveVisibleActiveId } from '../../core/outline-tree.ts'
import type { OutlineNode } from '../../core/types.ts'
import { buildOutlineItems } from '../outline-source.ts'
import { ensureElementInView } from '../../core/scroll-utils.ts'
import {
  computeActiveItemId, findChatRoot, scrollChatToBottom, scrollChatToTop, scrollToItem,
} from '../dom-anchor.ts'
import {
  loadBookmarks, loadExpandLevel, saveBookmarks, saveExpandLevel, type ChromeStore,
} from '../store.ts'
import {
  CheckGlyph, CloseGlyph, CollapseAllGlyph, CopyGlyph, ExpandAllGlyph, GitHubGlyph, LevelSlider,
  OutlineGlyph, OutlineRow, PinGlyph, ScrollBottomGlyph, ScrollTopGlyph, SearchGlyph, StarGlyph,
} from './parts.tsx'
import css from './panel.module.css'

export interface OutlineInjected {
  store: ChromeStore
  sessions: ISessions
}

export type OutlinePanelProps =
  PropsRuntime<'shell.overlay'> & InjectFace<OutlineInjected> & PropsLocale<'outline'>

const PANEL_WIDTH = 320
const REPO_URL = 'https://github.com/urzeye/dsh-outline'

export function OutlinePanel(props: OutlinePanelProps) {
  const { store, sessions, useSessions, t } = props
  const chrome = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const sessionId = useSessions((s) => s.current)

  // 悬浮预览：触发条和面板共享 hover 区域，进/出各带短延迟防抖。
  // peek 是纯瞬态 UI 状态，不进 store 不持久化。
  const [peek, setPeek] = useState(false)
  const enterTimer = useRef(0)
  const leaveTimer = useRef(0)
  useEffect(() => () => {
    window.clearTimeout(enterTimer.current)
    window.clearTimeout(leaveTimer.current)
  }, [])
  const onHoverEnter = useCallback((): void => {
    window.clearTimeout(leaveTimer.current)
    enterTimer.current = window.setTimeout(() => setPeek(true), 120)
  }, [])
  const onHoverLeave = useCallback((): void => {
    window.clearTimeout(enterTimer.current)
    leaveTimer.current = window.setTimeout(() => setPeek(false), 200)
  }, [])
  const visible = chrome.pinned || peek

  // 每个会话一个大纲管理器（书签按会话持久化，层级偏好全局）
  const manager = useMemo(() => {
    if (sessionId === undefined) return null
    return new OutlineManager({
      expandLevel: loadExpandLevel(),
      bookmarks: loadBookmarks(sessionId),
      onExpandLevelChange: saveExpandLevel,
      onBookmarksChange: (ids) => saveBookmarks(sessionId, ids),
    })
  }, [sessionId])

  // 会话快照订阅（ObservableSnapshot：getSnapshot/subscribe）
  const binding = sessionId === undefined ? undefined : sessions.binding(sessionId)
  const subscribeSession = useCallback(
    (fn: () => void) => binding?.session.subscribe(fn) ?? (() => {}),
    [binding],
  )
  const snapshot = useSyncExternalStore(
    subscribeSession,
    () => binding?.session.getSnapshot(),
  )

  const items = useMemo(
    () => (snapshot === undefined ? [] : buildOutlineItems(snapshot)),
    [snapshot],
  )

  useEffect(() => {
    manager?.setItems(items)
  }, [manager, items])

  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => manager?.subscribe(bump), [manager])
  const state = manager?.getState()

  // 阅读位置追踪（捕获阶段监听 chatRoot，覆盖滚动容器替换；rAF 节流）
  const activeIdRef = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [, bumpActive] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!visible || state === undefined) return
    const root = findChatRoot()
    if (root === null) return
    const flat: OutlineNode[] = []
    const collect = (nodes: readonly OutlineNode[]): void => {
      for (const node of nodes) {
        flat.push(node)
        collect(node.children)
      }
    }
    collect(state.tree)
    const followActive = (id: string | null): void => {
      const list = listRef.current
      if (id === null || list === null) return
      const row = list.querySelector(`[data-dsho-id="${CSS.escape(id)}"]`)
      if (row instanceof HTMLElement) ensureElementInView(row, list)
    }
    let raf = 0
    const onScroll = (): void => {
      if (raf !== 0) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        const rawId = computeActiveItemId(root, flat)
        const id = resolveVisibleActiveId(rawId, state.tree, state.visible)
        if (id !== activeIdRef.current) {
          activeIdRef.current = id
          bumpActive()
          followActive(id)
        }
      })
    }
    root.addEventListener('scroll', onScroll, { capture: true, passive: true })
    onScroll()
    return () => {
      root.removeEventListener('scroll', onScroll, { capture: true })
      if (raf !== 0) window.cancelAnimationFrame(raf)
    }
  }, [visible, state, sessionId])

  // 标题栏拖拽（4px 移动阈值，clamp 在视口内，拖动后松手才持久化并固定）。
  // 阈值是必须的：pin/关闭按钮也在标题栏里，没有阈值时 pointerup 会把
  // pinned 置 true，随后的 click 再取反，两次写入抵消（点击 pin 无响应）。
  const panelRef = useRef<HTMLDivElement | null>(null)
  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const panel = panelRef.current
    if (panel === null) return
    const rect = panel.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    const startX = e.clientX
    const startY = e.clientY
    let moved = false
    const onMove = (ev: PointerEvent): void => {
      if (!moved && Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return
      moved = true
      panel.style.left = `${Math.max(0, Math.min(window.innerWidth - rect.width, ev.clientX - dx))}px`
      panel.style.top = `${Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - dy))}px`
      panel.style.right = 'auto'
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved) return
      // 拖拽即视为固定意图：位置持久化的同时把面板钉住
      store.set({
        left: Math.max(0, Math.min(window.innerWidth - rect.width, ev.clientX - dx)),
        top: Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - dy)),
        pinned: true,
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [store])

  const onItemClick = (node: OutlineNode): void => {
    const root = findChatRoot()
    const ok = root !== null && scrollToItem(root, node)
    window.clearTimeout(unlocatableTimer.current)
    setUnlocatable(!ok)
    if (!ok) {
      unlocatableTimer.current = window.setTimeout(() => setUnlocatable(false), 2000)
    }
  }

  // 复制成功反馈：图标变对号 2 秒后恢复（复用字典里的 action.copied）
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  // 定位失败反馈：DOM 找不到对应正文时短暂提示"暂不可定位"（dom-anchor 承诺的兜底 UI）
  const [unlocatable, setUnlocatable] = useState(false)
  const unlocatableTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(unlocatableTimer.current), [])

  const onCopy = (): void => {
    if (state === undefined) return
    const lines: string[] = []
    const walk = (nodes: readonly OutlineNode[]): void => {
      for (const node of nodes) {
        const indent = '  '.repeat(Math.max(0, node.level))
        lines.push(node.isUserQuery === true
          ? `Q${node.queryIndex ?? ''}. ${node.text}`
          : `${indent}${'#'.repeat(node.level)} ${node.text}`)
        walk(node.children)
      }
    }
    walk(state.tree)
    void navigator.clipboard?.writeText(lines.join('\n'))
    window.clearTimeout(copiedTimer.current)
    setCopied(true)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  const panelStyle = chrome.left !== null && chrome.top !== null
    ? { width: PANEL_WIDTH, left: chrome.left, top: chrome.top }
    : { width: PANEL_WIDTH, right: 30, top: '30%' }

  const panelNode = visible ? (
    <div
      ref={panelRef}
      className={css.panel}
      style={panelStyle}
      role="complementary"
      aria-label={t('panel.title')}
      onPointerEnter={onHoverEnter}
      onPointerLeave={onHoverLeave}
    >
      <div className={css.header} onPointerDown={onDragStart}>
        <span className={css.headerGlyph}><OutlineGlyph /></span>
        <span className={css.title}>{t('panel.title')}</span>
        <a
          className={css.iconBtn}
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={t('panel.github')}
          aria-label={t('panel.github')}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <GitHubGlyph />
        </a>
        <button
          type="button"
          className={chrome.pinned ? `${css.iconBtn} ${css.iconBtnActive}` : css.iconBtn}
          title={chrome.pinned ? t('panel.unpin') : t('panel.pin')}
          aria-label={chrome.pinned ? t('panel.unpin') : t('panel.pin')}
          aria-pressed={chrome.pinned}
          onClick={() => store.set({ pinned: !chrome.pinned })}
        >
          <PinGlyph />
        </button>
        <button
          type="button"
          className={css.iconBtn}
          title={t('panel.close')}
          aria-label={t('panel.close')}
          onClick={() => {
            store.set({ pinned: false })
            setPeek(false)
          }}
        >
          <CloseGlyph />
        </button>
      </div>
      <div className={css.toolbar}>
        <button
          type="button"
          className={css.iconBtn}
          title={state?.isAllExpanded === true ? t('action.collapseAll') : t('action.expandAll')}
          aria-label={state?.isAllExpanded === true ? t('action.collapseAll') : t('action.expandAll')}
          onClick={() => state?.isAllExpanded === true ? manager?.collapseAll() : manager?.expandAll()}
        >
          {state?.isAllExpanded === true ? <CollapseAllGlyph /> : <ExpandAllGlyph />}
        </button>
        <button
          type="button"
          className={state?.bookmarkMode === true ? `${css.iconBtn} ${css.iconBtnActive}` : css.iconBtn}
          title={t('action.bookmarkMode')}
          aria-label={t('action.bookmarkMode')}
          aria-pressed={state?.bookmarkMode ?? false}
          onClick={() => manager?.setBookmarkMode(state?.bookmarkMode !== true)}
        >
          <StarGlyph />
        </button>
        <button
          type="button"
          className={copied ? `${css.iconBtn} ${css.iconBtnCopied}` : css.iconBtn}
          title={copied ? t('action.copied') : t('action.copy')}
          aria-label={copied ? t('action.copied') : t('action.copy')}
          onClick={onCopy}
        >
          {copied ? <CheckGlyph /> : <CopyGlyph />}
        </button>
        <div className={css.searchBox}>
          <span className={css.searchIcon}><SearchGlyph /></span>
          <input
            className={css.search}
            type="search"
            placeholder={t('search.placeholder')}
            value={state?.searchQuery ?? ''}
            onChange={(e) => manager?.setSearchQuery(e.target.value)}
          />
          {state !== undefined && state.searchQuery !== '' && (
            <button
              type="button"
              className={css.searchClear}
              title={t('search.clear')}
              aria-label={t('search.clear')}
              onClick={() => manager?.setSearchQuery('')}
            >
              <CloseGlyph />
            </button>
          )}
        </div>
      </div>
      <LevelSlider
        expandLevel={state?.expandLevel ?? 6}
        levelCounts={state?.levelCounts ?? {}}
        onChange={(level) => manager?.setLevel(level)}
        t={t}
      />
      <div className={css.list} ref={listRef}>
        {state === undefined || state.visible.length === 0 ? (
          <div className={css.empty}>
            <span className={css.emptyGlyph}><OutlineGlyph /></span>
            <div>{t('panel.empty')}</div>
            <div className={css.emptyHint}>{t('panel.emptyHint')}</div>
          </div>
        ) : (
          state.visible.map((node) => (
            <OutlineRow
              key={node.id}
              node={node}
              active={node.id === activeIdRef.current}
              query={state.searchQuery}
              onClick={onItemClick}
              onToggle={(n) => manager?.toggleNode(n.index)}
              onBookmark={(n) => manager?.toggleBookmark(n.index)}
              t={t}
            />
          ))
        )}
      </div>
      <div className={css.footer}>
        <button
          type="button"
          className={css.footBtn}
          onClick={() => {
            const root = findChatRoot()
            if (root !== null) scrollChatToTop(root)
          }}
        >
          <ScrollTopGlyph />
          {t('action.scrollTop')}
        </button>
        <button
          type="button"
          className={css.footBtn}
          onClick={() => {
            const root = findChatRoot()
            if (root !== null) scrollChatToBottom(root)
          }}
        >
          <ScrollBottomGlyph />
          {t('action.scrollBottom')}
        </button>
      </div>
      {unlocatable && (
        <div className={css.toast} role="status">
          {t('action.unlocatable')}
        </div>
      )}
    </div>
  ) : null

  // 固定状态只渲染面板；未固定时触发条常驻、peek 才挂面板。
  // 预览期间触发条保持挂载且与面板共享一条边（面板 right:30 = 触发条宽度），
  // 指针零死区滑入滑出，不存在"面板替换触发条后 pointerleave 丢失"的卡住路径。
  if (chrome.pinned) return panelNode
  return (
    <>
      <button
        type="button"
        className={css.edgeTrigger}
        title={t('panel.open')}
        aria-label={t('panel.open')}
        aria-expanded={peek}
        onPointerEnter={onHoverEnter}
        onPointerLeave={onHoverLeave}
        onClick={() => store.set({ pinned: true })}
      >
        <OutlineGlyph />
      </button>
      {panelNode}
    </>
  )
}
