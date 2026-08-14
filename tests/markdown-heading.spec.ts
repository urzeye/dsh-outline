import { describe, expect, it } from 'vitest'
import { parseMarkdownHeadings } from '../src/core/markdown-heading.ts'

describe('parseMarkdownHeadings', () => {
  it('parses ATX headings h1~h6', () => {
    const md = ['# 一级', '## 二级', '### 三级', '#### 四级', '##### 五级', '###### 六级'].join('\n')
    const headings = parseMarkdownHeadings(md)
    expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6])
    expect(headings[0]?.text).toBe('一级')
  })

  it('rejects 7+ hashes and missing space', () => {
    expect(parseMarkdownHeadings('####### 七级')).toEqual([])
    expect(parseMarkdownHeadings('#无空格')).toEqual([])
  })

  it('strips closing hash sequences', () => {
    expect(parseMarkdownHeadings('## 标题 ##')).toEqual([{ level: 2, text: '标题' }])
  })

  it('skips fenced code blocks (``` and ~~~)', () => {
    const md = ['# 真标题', '```', '# 代码里的注释', '```', '~~~', '## 另一个代码块', '~~~', '## 真二级'].join('\n')
    expect(parseMarkdownHeadings(md)).toEqual([
      { level: 1, text: '真标题' },
      { level: 2, text: '真二级' },
    ])
  })

  it('skips empty heading text', () => {
    expect(parseMarkdownHeadings('## ')).toEqual([])
  })

  it('handles leading whitespace before hashes', () => {
    expect(parseMarkdownHeadings('  ## 缩进标题')).toEqual([{ level: 2, text: '缩进标题' }])
  })
})
