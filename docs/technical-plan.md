# 技术方案与实施计划：dsh-outline

前置阅读：[feasibility.md](feasibility.md)。工程模板照抄 [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)，大纲逻辑移植自 Ophel。

## 目标形态

在 DSH Web GUI 会话页提供大纲面板：

- 一级节点 = 用户消息（问题摘要，带序号徽标）；子级 = 该轮 assistant 回复中的 Markdown 标题（h1~h6，按层级缩进/嵌套）。
- 流式生成时实时更新；点击节点滚动定位到正文对应位置并高亮当前阅读位置。
- 层级滑块控制展开深度：点击档位展开/收起到指定层级（0~6）；节点可单独展开/收起，单点展开可越过当前层级上限展示子树，下一次调滑块时统一清算回到层级基准；搜索、收藏；跟随 DSH 主题与语言。

## 架构总览

单包插件（npm 包 `dsh-outline`），只做 client 半 + 极简 host 挂载，不动 agent loop：

```
dsh-outline/
├─ package.json            # dsh.client 声明 + exports["./client"]；dsh 包全走 peerDependencies
├─ dsh.plugin.json         # 插件清单（id: dsh-external/dsh-outline）
├─ cordis.patch.yml        # 挂载补丁（dsh plugin add 自动应用）
├─ tsdown.config.ts        # client bundle 构建（照 DSH-better-sidebar）
├─ src/
│  ├─ host/index.ts        # host 半：空 apply（仅作挂载锚点）
│  ├─ client/
│  │  ├─ index.ts          # apply(ctx)：slots.inject 注册面板 + header 开关按钮
│  │  ├─ outline-source.ts # 适配层：Session 事件窗口 → OutlineItem[]（唯一依赖 DSH API 的模块）
│  │  ├─ markdown-heading.ts  # 解析 markdown 文本中的 #~###### 标题（纯函数）
│  │  ├─ dom-anchor.ts     # node key → [data-chat-flow-key] DOM 查询、scrollIntoView、active 追踪
│  │  ├─ panel/OutlinePanel.tsx  # 面板 React 组件（树渲染/工具条/进度点）
│  │  └─ locales.ts        # zh/en 字典，注册到 dsh-client-locale
│  └─ core/                # 从 Ophel 移植的纯逻辑（不 import 任何 DSH/DOM API）
│     ├─ outline-tree.ts   # OutlineItem[] → OutlineNode 树、折叠状态机（expandLevel / toggleNode / forceExpanded）
│     ├─ outline-search.ts # 搜索匹配、强制展开、层级联动
│     ├─ outline-bookmark.ts # djb2 签名、ghost 书签
│     └─ scroll-utils.ts   # findScrollableAncestor / scrollElementInContainer
└─ tests/                  # vitest + jsdom，只测 core/ 与 markdown-heading
```

分层纪律：`core/` 纯函数（可直接从 Ophel 复制后精简）；`outline-source.ts` 是唯一的 DSH 适配点；`panel/` 只做渲染与交互转发。DSH API 变动时只改适配层。

## 关键设计

### 1. 面板挂载与避让：shell.overlay 浮动面板（已定稿）

挂载形态已通过 slot 契约文档定稿（`ui-layout/src/client/index.ts`、`ui-conversation/src/client/contract/slots.ts`），不再需要 P0 实测二选一：

- `details` 列是 **single 独占席位且已被 ui-conversation 的 DetailsPanel 占用**（工具详情查看器）。注册进去 = 顶掉工具详情，违背"只做加法"原则，**弃用**。同样，`sidebar`/`conversation` 都是 single 且被占。
- `shell.overlay` 是 **list 席位、root 作用域、click-through 层**（条目自行恢复 pointer-events），文档原话即"a badge, a toast stack … the additive seat for a frame-wide surface of your own: a fresh id is added beside the shipped entries"——这就是官方给的浮动面板挂载位。
- `conversation.session.header.utilities` 是 **list 席位、session 作用域**，框架标准套件直接给 `sessionId`/`useSession`/`useInput`/`inputActions`——大纲开关按钮注册在这里。

最终结构：

```ts
// src/client/index.ts（示意，签名以构建时类型为准）
export const inject = ['slots', 'sessions', 'locale']
export function apply(ctx: ClientContext) {
  const store = createOutlineStore() // 开/关、位置、层级等面板状态（每次激活一个实例）
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'outline', order: 100, inject: () => ({ store }) },
    OutlinePanel,
  ))
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register(
    { name: 'conversation.session.header.utilities', id: 'outline', order: 100, inject: () => ({ store }) },
    OutlineToggleButton,
  ))
}
```

避让与移动（浮层规范，全部是本期实现项）：

- 默认停靠在会话页右侧、composer 之上，不进入聊天滚动容器（overlay 层独立于三列，聊天区不需要让宽；面板默认宽度 320px，只覆盖右缘空白/详情列收起后的区域）。
- 标题栏拖拽移动，位置 clamp 在视口内，下边界不越过 composer 顶；
- 位置与开/关状态持久化（localStorage，键前缀 `dsh-outline:`；DSH layout 自身也不用 localStorage 存几何，我们这里仅记用户显式拖动结果，属可接受的轻量偏好）；
- 可最小化为边缘把手（收起为窄条，点击展开）；z-index 低于 shell 的 toast/对话框层；
- 数据获取：overlay 是 root 作用域，用全局标准钩子 `useSessions` 拿当前 sessionId，再经 `ctx.sessions.binding(sessionId)` 取得 `SessionFace`（`ObservableSnapshot<ConversationSnapshot>`）订阅会话快照。

### 2. 数据源：ConversationSnapshot，不吃 DOM

数据模型已按源码定稿（`runtime/src/client/sessions/conversation.ts`）：

- 面板经 `ctx.sessions.binding(sessionId)` 拿 `SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>`，用 `useSyncExternalStore` 订阅快照；runtime 负责打开/重连/历史分页，插件不碰事件窗口管理。
- 映射规则（输入 = `ConversationSnapshot.nodes` 有序 legacy 切片 + `partial` 流式片段）：
  - `UserMessageNode`（`kind: 'user'`）与 `SteeringMessageNode`（`kind: 'steering'`，轮次中追加的人工消息）→ 一级大纲节点（`isUserQuery`，取 text block 拼接、首行截断）。
  - `AssistantMessageNode`（`kind: 'assistant'`）的 `blocks` 中 `kind: 'text'` 的 markdown 文本 → `markdown-heading.ts` 解析 `#`~`######` → 挂到最近的用户问题节点下；`partial`（流式中的 text block）同样解析，保证生成中实时出现。
  - `tool-result` / `context` / `turn-error` / `model-retry` / `command` 等一律排除；`reasoning` block 排除（thinking 不进大纲）。
- 更新纪律：快照订阅 + 浅比较（节点数 + 各节点文本长度/引用），无变化不重建树；树重建按 key 对账保留折叠态（Ophel 语义）。
- 大纲项携带定位信息：用户项 = 在 user/steering 节点中的序号；标题项 = 所属 assistant 节点序号 + 节点内标题出现序号（供 DOM 顺序匹配消歧）。

### 3. 滚动定位与 active 高亮：顺序匹配，不逆向 key 格式

DOM 锚点实测（demo.htm）：聊天气泡带 `data-chat-flow-kind=user | assistant-step | tool-call | ...` 与 `data-chat-anchor-key`/`data-chat-flow-key`，但 key 的编码格式属内部实现，不依赖它。

- 定位策略（顺序匹配）：大纲与正文都是同一批数据按同一顺序渲染，因此——
  - 用户项：文档序第 n 个 `[data-chat-flow-kind="user"]`（含 steering 行则按实测类别补充）= 第 n 个用户大纲项；
  - 标题项：聊天滚动容器内、且不在 `[data-chat-flow-kind="tool-call"|"context"]` 子树内的 `h1~h6`，文档序第 k 个 = 第 k 个标题大纲项（标题本来就是我们从同样的 markdown 文本按序解析出来的）。
  - 找到元素后 `findScrollableAncestor` 定容器、`scrollElementInContainer` 滚动（Ophel 原样移植）。
- 失配兜底：DOM 计数与大纲计数不一致时（虚拟列表/未渲染分页），降级为"滚动到最近的已渲染锚点"并在面板标记该项暂不可定位；不做静默错位滚动。
- active 追踪：监听会话滚动容器（rAF 节流），取可视区顶部最近的已渲染锚点；流式生成且用户贴底跟随时不抢滚动。

### 4. 收藏与持久化

- 书签签名 = djb2(标题文本 + 层级 + 序号)（Ophel 算法原样移植，内容小幅编辑不丢收藏）。
- 存储按会话隔离：优先 slot `defineStore` 席位（声明即带快照源与 actions）；需要跨会话/刷新持久化的部分走 host settings（`bindSettingsScope` 命名空间）。P2 实测两者的持久化语义后定边界。

### 5. 层级控制（滑块 + 单节点展开）

交互与状态机整体移植 Ophel（`outline-manager.ts` 的 `setLevel` / `collapseAll` / `expandAll` / `toggleNode` 与 `OutlineTab.tsx` 的点阵滑块），规则如下：

- **层级语义**：`expandLevel` 取值 0~6。`1~6` = 展开到对应标题层级；`0` = 只显示用户问题节点（仅在"显示用户提问"开启时有意义）。展开全部 = 置为当前内容实际最大层级；收起全部 = 置为 0（或最小层级）。
- **滑块 UI**：工具条内的点阵滑块（7 个档位圆点 + 进度条，即截图中工具条下方的圆点行）。每个档位 tooltip 显示 `H{n}: {levelCounts[n]}` 计数；`level <= expandLevel` 的点高亮。点击档位即 `setLevel(level)`。
- **状态模型**（一个全局基准 + 每节点两个标志，渲染时合成可见性）：
  - `expandLevel`：全局层级基准（0~6），唯一持久化项；
  - `collapsed`：折叠链标志——节点的 `collapsed = true` 时整个子树不渲染；
  - `forceExpanded`：越级可见标志——沿祖先链向下传递，使命链子树不受 `expandLevel` 上限约束。
  - 可见性公式：`可见 = 过滤通过（搜索/收藏）&& (level <= expandLevel || 祖先链含 forceExpanded || forceVisible) && 祖先链无 collapsed`。
- **操作语义**（移植重点，保持 Ophel 语义不变）：
  - `setLevel(level)`（点滑块档位、展开/收起全部）：清掉所有 `forceExpanded`，按"子级是否全部深于 level"重算每个节点的 `collapsed`；更新 `isAllExpanded = level >= maxActualLevel`；持久化 `expandLevel`。即滑块是绝对基准——手动单点展开在调滑块时被统一清算，避免"滑块显示 L 但树上到处越级展开"的状态漂移。
  - `toggleNode(node)`：单节点折叠/展开；展开时同时置 `collapsed = false` + `forceExpanded = true`——这是"单独展开指定节点"的实现基础：该节点子树越过当前 `expandLevel` 上限渲染，直到下一次 `setLevel` 统一清算。
  - 树增量刷新：按节点 id 对账恢复 `collapsed`/`forceExpanded`（`captureCollapseState` / `restoreCollapseState`），新增子级按 `expandLevel` 规则初始化，不掀翻已折叠节点。
- **联动规则**：
  - 搜索中调滑块置 `searchLevelManual = true`，搜索匹配结果仍强制展开到可见；
  - 收藏模式下禁用滑块（档位点置灰，点击 toast 提示）；
  - 定位/搜索命中节点时对其祖先链强制可见（`forceVisible`），不修改 `collapsed` 本身。
- **持久化**：`expandLevel` 作为用户偏好走 host settings（全局，不按会话）；节点级 `collapsed`/`forceExpanded` 是会话内瞬态，不持久化。

### 6. 样式与主题

- 面板样式通过插件 CSS 注入通道（`<style data-plugin=...>`），类名前缀 `dsho-`。
- 颜色一律用 `--dsw-alias-*` / `--dsw-static-*` 变量（label-primary/secondary、interactive-bg-hover、border-l2、deepseek 品牌色），不写死色值，明暗主题自动跟随。
- 视觉对齐 DSH 原生面板（14px 基础字号、24px 行高、6~8px 圆角），不做 Ophel 的阴影浮层风格（除非走 overlay 形态）。

### 7. i18n

- 向 `dsh-client-locale` 注册 `outline` 命名空间的 zh/en 字典；组件拿 bound translator，切语言实时生效（照 ui-user-questions 模式）。先 zh/en 两种，与 DSH 自带语言集对齐。

### 8. 构建与安装

- tsdown 产 client bundle（external：react、react-dom、所有 `@deepseek-ai/*`、cordis）；tsc 产 host 半与类型。
- 本地开发：`dsh plugin --profile web add <本地路径或 packed tgz>`，client 改动 HMR 即刷；host 半变更才需重启。
- 发布：npm 包 + 一键安装脚本（install.sh / install.ps1，照 DSH-better-sidebar）。

## 分阶段计划

| 阶段 | 内容 | 验收 |
|---|---|---|
| P0 验证 | 脚手架 + 本地 `dsh web` 挂载（挂载形态已由文档定稿：`shell.overlay` + `conversation.session.header.utilities`）；实测 overlay 条目的标准套件（`useSessions`）与 `ctx.sessions.binding()` 取快照链路 | 面板在会话页渲染出静态占位内容、开关按钮生效，HMR 生效 |
| P1 数据源 | `markdown-heading` 解析 + `outline-source` 适配层 + core 树构建移植；面板只读展示大纲，流式实时更新 | 新开/打开历史会话，大纲完整；流式生成时逐标题出现；刷新后一致 |
| P2 导航与层级 | 点击定位、active 高亮；层级滑块（0~6 档位点 + 计数 tooltip）、展开/收起全部、单节点展开（forceExpanded 语义）；顶/底部按钮 | 点击每个节点准确滚动；高亮跟随；单点展开的子树越过当前层级上限可见；调滑块后统一回到层级基准（forceExpanded 被清算）；增量刷新保留折叠态 |
| P3 增强 | 搜索、收藏（按会话持久化）、进度点、复制/导出大纲（移植 export-outline） | 搜索过滤正确；收藏刷新不丢；导出 markdown 大纲 |
| P4 打磨 | i18n 完善、主题走查（明/暗）、设置项（默认 expandLevel、显示用户提问开关，schema-form）、性能与边界用例 | vitest 通过；明暗主题无写死色；长会话（>100 节点）无卡顿 |

## 测试策略

- `core/` 与 `markdown-heading`：vitest 纯函数单测（树构建、折叠、搜索、签名稳定性、标题解析边界——嵌套代码块里的 `#` 不算标题）。
- 层级状态机重点用例：`setLevel` 后各节点 `collapsed` 正确；`toggleNode` 展开的子树越过 `expandLevel` 上限可见、经下一次 `setLevel` 被统一清算；`isAllExpanded` 边界（level=0、level=maxActualLevel）；树重建后按 id 对账恢复折叠态；搜索中调滑块；收藏模式禁用。
- `dom-anchor`：jsdom 搭带 `data-chat-*` 属性的桩 DOM 测定位与消歧。
- 集成冒烟靠 P0~P2 的人工验收（DSH 本地实例）；不写 e2e，成本不匹配。

## 明确不做（本期）

- 不做 host 半业务逻辑（不向模型暴露任何工具，不改 agent 行为）。
- 不做多会话大纲聚合、不支持 Trajectory 视图。
- 不移植 Ophel 的会话管理/提示词等非大纲功能。
