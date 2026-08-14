/**
 * dsh-ui-outline client half: registers the outline dictionaries, the
 * floating panel (shell.overlay, additive list seat, root scope) and the
 * session-header toggle (conversation.session.header.utilities, list seat,
 * session scope). Value imports stay inside the loader module table
 * (react) — every @deepseek-ai import here is type-only and erased at build.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { en, NS, zh } from './locales.ts'
import { createChromeStore } from './store.ts'
import { OutlinePanel } from './panel/OutlinePanel.tsx'
import { OutlineToggleButton } from './panel/OutlineToggleButton.tsx'
import './anchor.css'

/** Required services: slot registry, session object layer, dictionary registry. */
export const inject = ['slots', 'sessions', 'locale']

/**
 * Client plugin body.
 * @param ctx - the client cordis context.
 */
export function apply(ctx: ClientContext): void {
  // Dictionaries follow the DSH i18n system: the locale service re-renders
  // slot entries live on language switches (framework-injected `t` seat).
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-outline: dictionaries')

  // One chrome store per activation (the official createXXXStore() factory
  // rule — no module-level singleton), shared by the panel and the toggle.
  const store = createChromeStore()

  // The floating panel: additive entry in the frame-wide click-through layer.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'ui-outline',
    order: 100,
    locale: NS,
    inject: () => ({ store, sessions: ctx.sessions }),
  }, OutlinePanel))

  // The per-session header toggle.
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'ui-outline',
    order: 100,
    locale: NS,
    inject: () => ({ store }),
  }, OutlineToggleButton))
}
