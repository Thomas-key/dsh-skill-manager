# dsh-skill-manager

> 管理 DeepSeek Harness 的文件系统技能：列出、启用/禁用——既可通过 agent 直接操作，也可用设置页 UI（动态插件模式）。

DeepSeek Harness 直接从文件系统加载技能（`~/.agents/skills/<name>/SKILL.md`、`~/.dsh/skills`、项目级 `.dsh/skills` 和 `.agents/skills`），但**没有任何管理界面**：看不到装了什么技能，也无法关闭某个技能。`dsh-skill-manager` 补上这块空缺。

- **`skills_list`** — 列出所有文件系统技能及其启用状态和一句话描述。
- **`skills_toggle`** — 即时启用/禁用任意技能（无需重启）。

禁用的原理是把 `<name>/SKILL.md` 改名为 `<name>/SKILL.md.disabled`，启用则改回来。DSH 内置的技能文件系统提供方会 watch 技能根目录，所以被禁用的技能会**立刻从模型可见的技能目录中消失**（重新启用后立即恢复）。技能内容不会被改动——只动 `SKILL.md` 这个文件名。

## 安装

本插件是 dsh bundle（声明了 `dsh.bundle.patch`），像普通插件一样安装：

```sh
dsh plugin --profile web add <你的GitHub用户名>/dsh-skill-manager
```

或从本地目录安装：

```sh
dsh plugin --profile web add ./dsh-skill-manager
```

重启 `dsh web` 后，直接对 agent 说：

> 列出我的技能。
> 禁用 `read` 这个技能。

agent 会调用 `skills_list` / `skills_toggle` 完成操作。开关即时生效——同一会话里再问一次"能看到哪些技能"即可验证。

## 设置页 UI（可选，动态插件模式）

同样的管理能力也可以作为**设置页**（设置 → 侧栏"技能"页）使用。由于 Web UI 以 client bundle 形式分发，本模式以动态 Cordis 插件提供（会话级；DSH 重启后需重新安装）：

1. 打开插件仓库里的 `plugin/skill-manager.js`。
2. 用 `cordis_define` 把 `code.host` 设为该文件的 host 部分、`code.client` 设为 client 部分；然后 `cordis_run` 并批准。

UI 列出同样的技能，带启用/禁用开关和刷新按钮。

## 工作原理

```
agent → skills_list / skills_toggle（模型工具）
     → Host 插件 → `node -e` 桥接（stdin: JSON 操作，stdout: JSON 结果）
     → 扫描技能根目录 / 改名 SKILL.md <-> SKILL.md.disabled
     → dsh-skill-filesystem watcher → 技能目录即时更新
```

桥接脚本零依赖（仅 Node 内置模块），运行在 DSH 常规的 subprocess 服务中。

## 边界

- 只扫描四个标准技能根目录，其他位置一概不碰。
- 只改 `SKILL.md` / `SKILL.md.disabled` 的文件名——从不读取、修改或删除技能内容。
- 禁用技能只是把它从"目录"（模型可见列表）中隐藏；文件原样保留，禁用完全可逆。

## License

MIT
