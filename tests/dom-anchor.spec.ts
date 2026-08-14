import { describe, expect, it } from 'vitest'
import {
  collectHeadings, collectUserRows, findChatRoot, locateItem,
} from '../src/client/dom-anchor.ts'
import type { OutlineNode } from '../src/core/types.ts'

function node(partial: Partial<OutlineNode>): OutlineNode {
  return { level: 1, text: '', id: 'x', children: [], index: 0, collapsed: false, ...partial }
}

function setupDom(): HTMLElement {
  document.body.innerHTML = `
    <div data-slot="conversation">
      <div data-chat-flow-kind="user">如何配置 nginx？</div>
      <div data-chat-flow-kind="assistant-step">
        <h1>结论</h1>
        <h2>步骤一</h2>
        <div data-chat-flow-kind="tool-call"><h2>工具里的标题</h2></div>
      </div>
      <div data-chat-flow-kind="user">第二个问题</div>
      <div data-chat-flow-kind="assistant-step"><h2>补充</h2></div>
    </div>`
  const root = findChatRoot()
  if (root === null) throw new Error('chat root not found')
  return root
}

describe('dom-anchor', () => {
  it('collects user rows in document order', () => {
    const root = setupDom()
    const rows = collectUserRows(root)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('nginx')
  })

  it('collects headings excluding tool-call subtrees', () => {
    const root = setupDom()
    const headings = collectHeadings(root)
    expect(headings.map((h) => h.textContent)).toEqual(['结论', '步骤一', '补充'])
  })

  it('locates a user item by order with text sanity check', () => {
    const root = setupDom()
    const hit = locateItem(root, node({ isUserQuery: true, userIndex: 1, level: 0, text: '第二个问题' }))
    expect(hit?.textContent).toBe('第二个问题')
    // 文本不匹配（虚拟列表错位等）→ null，绝不错位滚动
    expect(locateItem(root, node({ isUserQuery: true, userIndex: 1, level: 0, text: '不相干的问题' }))).toBeNull()
    expect(locateItem(root, node({ isUserQuery: true, userIndex: 9, level: 0, text: '越界' }))).toBeNull()
  })

  it('locates headings by index, falls back to text match on mismatch', () => {
    const root = setupDom()
    const hit = locateItem(root, node({ level: 2, text: '步骤一', headingIndex: 1 }))
    expect(hit?.tagName).toBe('H2')
    // 索引错位但文本能匹配 → 回退成功
    const fallback = locateItem(root, node({ level: 2, text: '补充', headingIndex: 0 }))
    expect(fallback?.textContent).toBe('补充')
    // 工具块里的标题被排除，找不到
    expect(locateItem(root, node({ level: 2, text: '工具里的标题', headingIndex: 5 }))).toBeNull()
  })
})
