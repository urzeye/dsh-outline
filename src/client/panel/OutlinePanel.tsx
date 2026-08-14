/**
 * 大纲面板（shell.overlay 条目，root 作用域）。
 *
 * 数据链：useSessions(全局标准套件) 取当前 sessionId → ctx.sessions.binding()
 * 拿 SessionFace → useSyncExternalStore 订阅 ConversationSnapshot →
 * buildOutlineItems 扁平化 → OutlineManager（core，持有层级/搜索/收藏状态）。
 * 面板自身只渲染与转发交互，不持有业务状态副本。
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ISessions } from '@deepseek-ai/dsh-client-runtime/client'
import { OutlineManager } from '../../core/outline-manager.ts'
import type { OutlineNode } from '../../core/types.ts'
import { buildOutlineItems } from '../outline-source.ts'
import {
  computeActiveItemId, findChatRoot, scrollChatToBottom, scrollChatToTop, scrollToItem,
} from '../dom-anchor.ts'
import {
  loadBookmarks, loadExpandLevel, saveBookmarks, saveExpandLevel, type ChromeStore,
} from '../store.ts'
import {
  CloseGlyph, CopyGlyph, ExpandAllGlyph, LevelSlider, MinusGlyph, OutlineGlyph, OutlineRow,
  ScrollBottomGlyph, ScrollTopGlyph, SearchGlyph, StarGlyph,
} from './parts.tsx'
import css from './panel.module.css'

export interface OutlineInjected {
  store: ChromeStore
  sessions: ISessions
}

export type OutlinePanelProps =
  PropsRuntime<'shell.overlay'> & InjectFace<OutlineInjected> & PropsLocale<'outline'>

const PANEL_WIDTH = 320

export function OutlinePanel(props: OutlinePanelProps) {
  const { store, sessions, useSessions, t } = props
  const chrome = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const sessionId = useSessions((s) => s.current)

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
  const [, bumpActive] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!chrome.open || state === undefined) return
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
    let raf = 0
    const onScroll = (): void => {
      if (raf !== 0) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        const id = computeActiveItemId(root, flat)
        if (id !== activeIdRef.current) {
          activeIdRef.current = id
          bumpActive()
        }
      })
    }
    root.addEventListener('scroll', onScroll, { capture: true, passive: true })
    onScroll()
    return () => {
      root.removeEventListener('scroll', onScroll, { capture: true })
      if (raf !== 0) window.cancelAnimationFrame(raf)
    }
  }, [chrome.open, state, sessionId])

  // 标题栏拖拽（clamp 在视口内，松手时持久化）
  const panelRef = useRef<HTMLDivElement | null>(null)
  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const panel = panelRef.current
    if (panel === null) return
    const rect = panel.getBoundingClientRect()
    const dx = e.clientX - rect.left
    const dy = e.clientY - rect.top
    const onMove = (ev: PointerEvent): void => {
      panel.style.left = `${Math.max(0, Math.min(window.innerWidth - rect.width, ev.clientX - dx))}px`
      panel.style.top = `${Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - dy))}px`
      panel.style.right = 'auto'
    }
    const onUp = (ev: PointerEvent): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      store.set({
        left: Math.max(0, Math.min(window.innerWidth - rect.width, ev.clientX - dx)),
        top: Math.max(0, Math.min(window.innerHeight - 80, ev.clientY - dy)),
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [store])

  if (!chrome.open) return null

  if (chrome.minimized) {
    const minStyle = chrome.left !== null && chrome.top !== null
      ? { left: chrome.left, top: chrome.top }
      : undefined
    return (
      <button
        type="button"
        className={css.minibar}
        style={minStyle}
        title={t('panel.restore')}
        aria-label={t('panel.restore')}
        onClick={() => store.set({ minimized: false })}
      >
        <OutlineGlyph />
      </button>
    )
  }

  const onItemClick = (node: OutlineNode): void => {
    const root = findChatRoot()
    if (root !== null) scrollToItem(root, node)
  }

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
  }

  const panelStyle = chrome.left !== null && chrome.top !== null
    ? { width: PANEL_WIDTH, left: chrome.left, top: chrome.top }
    : { width: PANEL_WIDTH, right: 16, top: 88 }

  return (
    <div
      ref={panelRef}
      className={css.panel}
      style={panelStyle}
      role="complementary"
      aria-label={t('panel.title')}
    >
      <div className={css.header} onPointerDown={onDragStart}>
        <span className={css.headerGlyph}><OutlineGlyph /></span>
        <span className={css.title}>{t('panel.title')}</span>
        <button
          type="button"
          className={css.iconBtn}
          title={t('panel.minimize')}
          aria-label={t('panel.minimize')}
          onClick={() => store.set({ minimized: true })}
        >
          <MinusGlyph />
        </button>
        <button
          type="button"
          className={css.iconBtn}
          title={t('panel.close')}
          aria-label={t('panel.close')}
          onClick={() => store.set({ open: false })}
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
          <ExpandAllGlyph />
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
          className={css.iconBtn}
          title={t('action.copy')}
          aria-label={t('action.copy')}
          onClick={onCopy}
        >
          <CopyGlyph />
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
      <div className={css.list}>
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
    </div>
  )
}
