# dsh-outline

DeepSeek Harness（DSH）Web GUI 的**实时大纲插件**：在会话页面提供"用户问题 + Markdown 标题（1~6 级）"的大纲树面板。

- 流式生成时实时更新，点击节点滚动定位并高亮当前阅读位置
- 层级滑块控制展开深度（0~6 档），节点可单独展开/收起
- 搜索、按会话收藏、跟随 DSH 主题与中英文语言
- 面板为 `shell.overlay` 浮层：可拖拽移动、可最小化、不挤压聊天区

交互形态移植自 Ophel（浏览器扩展）；插件形态遵循 DSH 官方[打包与安装约定](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/publish.zh.md)，参考 [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar)。

## 安装

以下命令均通过 `dsh plugin` 转发给 profile 目录内的 pnpm，安装后**重启 `dsh web`** 生效（host 半在启动时加载）。

### 从 npm 安装（推荐）

```sh
dsh plugin --profile web add dsh-outline
```

### 从 tarball 安装

无需发布 npm，也不需要任何构建授权：

```sh
pnpm pack                                          # 产出 dsh-outline-<version>.tgz
dsh plugin --profile web add ./dsh-outline-0.1.0.tgz
```

### 从 GitHub 安装

git 安装拉取的是源码而非构建产物，本包通过 `prepare` 脚本在安装时构建：

```sh
dsh plugin --profile web add github:urzeye/dsh-outline
```

pnpm ≥10 在得到显式允许前拒绝运行 git 依赖的 `prepare`，首次 `add` 会失败并提示修法：把包键加入该 profile 的 `pnpm-workspace.yaml` 后重试：

```yaml
# $DSH_HOME/profiles/web/pnpm-workspace.yaml
allowBuilds:
  dsh-outline: true
```

注意：这表示**允许该包的代码在安装时在你的机器上执行**。只对可信来源授权，并锁定 commit（`github:urzeye/dsh-outline#<sha>`），避免后续推送悄悄改变实际运行的内容。

### 本地路径安装（开发调试）

```sh
dsh plugin --profile web add D:\workspace\dsh-ui-outline   # 或相对路径 ./dsh-ui-outline
```

link 安装后 client 改动经 `pnpm watch` 重建即可 HMR 生效；host 半变更需重启 `dsh web`。

### 卸载

```sh
dsh plugin --profile web remove dsh-outline
```

## 使用

1. 启动 `dsh web`，打开任意会话页。
2. 会话头部工具条出现大纲开关按钮，点击展开/收起大纲面板。
3. 面板内：点节点跳转正文；顶部滑块调整展开层级；节点行内提供展开/收起与收藏按钮；支持关键词搜索。

## 开发

```sh
pnpm install       # 安装依赖（prepare 会自动构建 lib/）
pnpm build         # tsc 类型 + tsdown client bundle
pnpm test          # vitest（core 纯逻辑 + DOM 锚点）
pnpm typecheck
```

架构纪律见 [AGENTS.md](AGENTS.md)：`src/core/` 只放纯逻辑，DSH API 调用只出现在适配层与槽位注册代码里。

## 文档

- [docs/feasibility.md](docs/feasibility.md) — 可行性分析（证据、能力映射、边界）
- [docs/technical-plan.md](docs/technical-plan.md) — 技术方案与分阶段实施计划
