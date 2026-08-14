/**
 * 面板外壳状态（固定/预览、拖拽位置）+ 轻量偏好持久化。
 * pinned=false 时面板只在悬浮触发条上临时预览；pinned=true 才常驻。
 * 只用 localStorage 记用户显式偏好（固定、位置、默认层级、收藏），
 * 会话数据一律来自 runtime，不写第二份。
 */

export interface ChromeState {
  pinned: boolean
  /** 拖拽后的绝对位置；null = 默认停靠右侧。 */
  left: number | null
  top: number | null
}

export interface ChromeStore {
  getSnapshot(): ChromeState
  subscribe(fn: () => void): () => void
  set(patch: Partial<ChromeState>): void
}

const CHROME_KEY = 'dsh-outline:panel'
const LEVEL_KEY = 'dsh-outline:expandLevel'
const BOOKMARKS_PREFIX = 'dsh-outline:bookmarks:'
const BOOKMARKS_CAP = 200

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as T)
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 隐私模式等写失败场景：偏好丢失可接受，不兜底伪造
  }
}

export function createChromeStore(): ChromeStore {
  // 旧版本字段是 open/minimized：open=true 迁移为 pinned=true，minimized 丢弃
  const saved = readJson<Partial<ChromeState> & { open?: boolean }>(CHROME_KEY)
  let state: ChromeState = {
    pinned: saved?.pinned ?? saved?.open ?? false,
    left: saved?.left ?? null,
    top: saved?.top ?? null,
  }
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    set(patch) {
      state = { ...state, ...patch }
      writeJson(CHROME_KEY, state)
      for (const fn of listeners) fn()
    },
  }
}

export function loadExpandLevel(): number {
  const value = readJson<number>(LEVEL_KEY)
  return typeof value === 'number' && value >= 0 && value <= 6 ? value : 6
}

export function saveExpandLevel(level: number): void {
  writeJson(LEVEL_KEY, level)
}

export function loadBookmarks(sessionId: string): string[] {
  const value = readJson<string[]>(`${BOOKMARKS_PREFIX}${sessionId}`)
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function saveBookmarks(sessionId: string, ids: ReadonlySet<string>): void {
  writeJson(`${BOOKMARKS_PREFIX}${sessionId}`, [...ids].slice(-BOOKMARKS_CAP))
}
