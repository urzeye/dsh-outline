# 可行性分析：dsh-outline

日期：2026-08-14 · 证据来源：DSH 官方 reference 文档、deepseek-ai/deepseek-harness 仓库源码、`demo.htm`（DSH Web GUI 实际页面快照）、Ophel 仓库现网代码、DSH-better-sidebar 仓库。

## 结论

**可行，且比浏览器扩展场景更顺**。DSH Web GUI 自带正式的客户端插件体系：官方 slot 扩展点、会话运行时对象、样式注入机制、插件安装 CLI，全部是一等公民能力。Ophel 的大纲核心逻辑（树构建、折叠、搜索、收藏、滚动定位）与宿主无关，可直接移植；需要重写的只有"数据从哪来"和"面板挂在哪"两件事，而这两件 DSH 都给了官方通道。

## DSH 插件体系关键事实（文档 + 源码双重验证）

### 插件形态与安装

- 插件 = npm 包。包内 `dsh.plugin.json`（id/version/client 入口）+ `cordis.patch.yml`（挂载补丁），通过官方 CLI 安装挂载：
  `npx -y --package @deepseek-ai/dsh dsh plugin --profile web add <pkg>`
  （DSH-better-sidebar 即此模式，不改 DSH 源码。）
- 浏览器半：在 `package.json` 声明 `dsh.client`（`platform: 'web'`、可选 `inject` 依赖边），并在 `exports["./client"]` 导出构建好的 bundle。host 扫描后组合 `window.__DSH_BOOT__` entry 图，经 `/plugins/<id>/client.js` 提供 bundle；client bundle 变更支持 HMR（`dsh-client-hmr`，SSE 广播 rev）。
- 客户端包用 tsdown 构建（DSH-better-sidebar 的现成配置可直接参考），dsh 系列包作为 peerDependency/external。
- 注意：插件 bundle 里 value import 必须用 `/client` 子路径（如 `@deepseek-ai/dsh-client-runtime/client`），裸包名会打进第二份模块实例导致 scope Symbol 不匹配（runtime README 明确警告）。

### UI 扩展点（slot 系统）

- `@deepseek-ai/dsh-client-ui-slots`：`ctx.slots.register({name, key?, ...}, Component)` 贡献组件；`ctx.slots.inject(name, cb)` 等声明就绪后注入，声明撤销自动 dispose。支持 keyed entry、chain 选择、子 slot 声明、`defineStore` store 席位。
- `demo.htm` 实测可用的 slot（节选，均带 `data-slot` 稳定属性）：
  `details`（右侧详情栏）、`sidebar`、`sidebar.footer.action`、`shell.overlay`（全局浮层）、
  `conversation.session.header.utilities`（会话头部按钮区）、`conversation.chat.node`（消息行，keyed）、
  `conversation.composer.*`、`settings.trigger` 等。
- 大纲面板的目标位置有两条官方路径（见 technical-plan 的形态决策）：
  1. **右栏面板**：`details` slot（会话页右侧已有"详情"列，天然适合大纲）；
  2. **浮动面板**：`shell.overlay` + `conversation.session.header.utilities` 开关按钮（最接近 Ophel 的悬浮面板形态）。

### 数据源（核心：不抓 DOM，吃会话事件流）

- `@deepseek-ai/dsh-client-runtime`（浏览器半 cordis boot）暴露 `SessionRuntime` / `Session` 对象：每个 Session 持有连续事件窗口 + `ConversationNodeAssembler`，顶层有 `nodes`、`partial`、`runningCalls` 兼容字段与 `ConversationSnapshot`。
- 用户消息与 assistant 文本都是**持久 session 事件**，按 seq 有序、可回放、增量 append；append 路径是"每条事件对每个 Definition 匹配一次"的常数级热路径。大纲可以从会话数据直接构建：用户消息事件 → 大纲一级节点；assistant markdown 文本 → 解析 `#`~`######` 标题 → 挂到对应问答下。
- 这意味着"实时"是免费的：流式 token 到达即事件 append，插件订阅即可；且刷新/重连/历史分页都由 runtime 重建，插件不用自己处理 DOM 抖动。
- 备用/兜底路径：DOM 抓取（见下）。两路径可并存：数据以事件流为准，DOM 只用于滚动定位。

### DOM 锚点（用于点击定位与 active 高亮）

`demo.htm` 实测，聊天气泡带**稳定的 data 属性**（不依赖 hash class）：

- `data-chat-anchor-key` / `data-chat-flow-key`：节点 key（如 `9`、`14`、`13:input-message<uuid>`）；
- `data-chat-flow-kind=user | assistant-step | tool-call | context | turn-tail`：节点类别；
- `data-turn-start=true`：轮次起点。

点击大纲项 → 按 key 查 DOM（`[data-chat-flow-key="..."]`）→ `scrollIntoView`；assistant 标题再在该 step 块内按文本匹配 `h1`~`h6`（Ophel 的 `findHeadingByText` 直接可用）。

### 样式与 i18n

- 插件 CSS 有官方注入通道：`demo.htm` 中可见 `<style data-plugin="@deepseek-ai/dsh-client-ui-conversation" data-plugin-css=".../MessageItem.module.css">`。
- DSH 全套设计变量可用：`--dsw-alias-*` / `--dsw-static-*` / `--dsh-*`（demo.htm `:root` 已证实，明暗主题都在这套变量上）。
- i18n：`@deepseek-ai/dsh-client-locale` 支持插件注册命名空间字典（ui-user-questions 的 zh/en 字典即此模式，切语言实时重渲染）。

### 现成的相邻先例

- `packages/client/ui-user-questions`：官方"提问"插件，演示了 keyed slot 注册 + locale 字典 + 会话状态驱动的完整写法。
- `DSH-better-sidebar`（三方）：完整的生产级插件工程模板——`dsh.plugin.json`、`cordis.patch.yml`、tsdown 构建、install 脚本、`ctx.slots`/`ctx.remote` 用法、按会话持久化 UI 状态。本项目工程结构直接照它搭。

## 能力映射：Ophel → DSH

| Ophel 能力 | 实现位置 | 移植方式 |
|---|---|---|
| 大纲树构建（OutlineNode、层级/相对层级、折叠态） | `src/core/outline-manager.ts` | ✅ 纯逻辑，直接移植 |
| 标题提取与文本截断 | `src/core/outline/dom-outline.ts` | 🔄 数据源换成"解析 assistant markdown 文本"；`findHeadingByText` 保留用于 DOM 定位 |
| 滚动定位（findScrollableAncestor / scrollElementInContainer） | 同上 | ✅ 直接移植，容器换成会话滚动区 |
| 搜索过滤（匹配/强制展开/层级联动） | `outline-manager.ts` | ✅ 纯逻辑，直接移植 |
| 收藏/书签（djb2 签名、ghost 书签） | `outline-manager.ts` | ✅ 签名算法直接移植；存储换成按会话持久化 |
| 面板 UI（树渲染、进度点、顶/底按钮） | `src/components/OutlineTab.tsx` | 🔄 React 组件重写（去掉 Shadow DOM 约束，样式换 `--dsw-*` 变量） |
| 数据源（站点适配器 DOM 抓取） | `src/adapters/*` | ❌ 整个不需要，换成 Session 事件流 |
| 面板宿主（Shadow DOM 浮动面板、content script） | `src/contents/*` | ❌ 换成 slot 注册（details / shell.overlay） |
| 存储（chrome.storage / GM） | `src/stores/*` `src/platform/*` | ❌ 换成 slot `defineStore` 席位 + host settings（`bindSettingsScope`） |
| 导出大纲 | `src/utils/export-outline.ts` | ✅ 纯逻辑，直接移植（P3） |

## 边界与风险

1. **DSH 处于 rc 阶段**（`0.1.0-rc.6`），client API 可能演进。对策：全部依赖锁 peer 范围、只做 client 半插件（不动 agent loop）、核心逻辑与 DSH API 之间留薄适配层。
2. **`details` slot 是否接受第三方 keyed 注入、session 作用域 inject 参数的确切形态**，文档未逐字写明——列为 P0 首验项；备选 `shell.overlay` 浮动面板路线不受影响（slot 声明与注册机制是文档化的）。
3. **assistant 标题 → DOM 的映射**：事件数据里没有标题的 DOM 位置，需要"step 块内按文本找 heading"。极端情况（同一 step 内重复标题文本）用出现序号消歧，Ophel 已有同样问题的处理经验。
4. **大纲只对"对话内容"负责**：工具行、thinking、todo 面板等节点不进大纲（按 `data-chat-flow-kind` / 事件类型排除），与 Ophel 的"用户问题 + 标题"口径一致。

## 验证记录

- `demo.htm`：slot 清单、`data-chat-*` 锚点、markdown `h1/h2` 渲染结构、插件 CSS 注入标签——均已实测存在。
- 官方文档：client-modules（bundle 分发/HMR）、extension-cookbook（UI 插件模式）、adding-a-conversation-node（事件流 + `ctx.slots` 用法）、ui-slots/ui-user-questions/runtime README——均与上述结论一致。
