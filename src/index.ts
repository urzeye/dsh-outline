/**
 * dsh-outline host half: intentionally empty. The outline panel is a pure
 * browser-side feature (it reads the client runtime's conversation snapshot);
 * this module exists only as the cordis plugin anchor the bundle patch mounts.
 * No tools, no agent-loop listeners, no routes.
 */
import type { Context } from '@deepseek-ai/cordis'

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-outline'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function apply(_ctx: Context): void {
  // Nothing to do on the host.
}
