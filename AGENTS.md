# AGENTS.md

面向本仓库 AI/Codex 代理的项目级规则。默认用中文回复。

## 项目概述

`dsh-outline`：DeepSeek Harness（DSH）Web GUI 的实时大纲插件。方案与背景见 `docs/feasibility.md`、`docs/technical-plan.md`，动手前先读这两份文档。

## 硬性约束

- 插件形态照 DSH-better-sidebar：npm 包 + `dsh.plugin.json` + `cordis.patch.yml`，`dsh plugin --profile web add` 安装；不改 DSH 源码。
- 只做 client 半 UI 插件 + 极简 host 挂载；不向模型暴露工具，不动 agent loop。
- 插件 bundle 内 value import 一律用 `/client` 子路径（如 `@deepseek-ai/dsh-client-runtime/client`），禁止裸包名（会打进第二份模块实例）。
- `src/core/` 只放纯逻辑，不 import 任何 DSH/DOM API；DSH API 调用只能出现在 `src/client/outline-source.ts` 与槽位注册代码里。
- 颜色只用 `--dsw-*` / `--dsh-*` 变量，类名前缀 `dsho-`；不写死色值，不依赖 DSH 的 hash class，DOM 定位只用 `data-chat-*` / `data-slot` / `data-testid` 稳定属性。
- 文案走 `dsh-client-locale` 字典，zh/en 同步，不硬编码界面文字。
- 依赖管理用 pnpm。

## 常用命令

- 构建：`pnpm build`（tsdown client bundle + tsc 类型）
- 类型检查：`pnpm typecheck`
- 测试：`pnpm test`（vitest）
- 本地安装到 DSH：`npx -y --package @deepseek-ai/dsh dsh plugin --profile web add <本包>`；client 改动 HMR 生效，host 半改动需重启 DSH。

## 验证

- 改 `core/`：跑 vitest。
- 改适配层/面板：`pnpm typecheck` + 本地 DSH 实例人工冒烟（新开会话、历史会话、流式生成、刷新）。
- 交付前说明：改了什么、跑了什么验证、剩余风险。
