/**
 * 会话头部右侧的大纲开关（conversation.session.header.utilities 条目，
 * session 作用域；标准套件里的 sessionId/useSession 本组件用不到）。
 */
import { useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChromeStore } from '../store.ts'
import { OutlineGlyph } from './parts.tsx'
import css from './panel.module.css'

export type OutlineToggleProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<{ store: ChromeStore }>
  & PropsLocale<'outline'>

export function OutlineToggleButton(props: OutlineToggleProps) {
  const { store, t } = props
  const chrome = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return (
    <button
      type="button"
      className={chrome.open ? `${css.toggle} ${css.toggleActive}` : css.toggle}
      title={t('panel.open')}
      aria-label={t('panel.open')}
      aria-pressed={chrome.open}
      onClick={() => store.set({ open: !chrome.open, minimized: false })}
    >
      <OutlineGlyph />
    </button>
  )
}
