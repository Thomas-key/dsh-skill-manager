# dsh-skill-manager

> 管理 DeepSeek Harness 的文件系统技能：列出、启用/禁用——既可通过 agent 直接操作，也可用设置页 UI（"技能"页）。

DeepSeek Harness 直接从文件系统加载技能（`~/.agents/skills/<name>/SKILL.md`、`~/.dsh/skills`、项目级 `.dsh/skills` 和 `.agents/skills`），但**没有任何管理界面**：看不到装了什么技能，也无法关闭某个技能。`dsh-skill-manager` 补上这块空缺。

- **`skills_list`** — 列出所有文件系统技能及其启用状态和一句话描述。
- **`skills_toggle`** — 即时启用/禁用任意技能（无需重启）。
- **设置页 UI** — 设置里的"技能"页，同样的列表和启用/禁用开关（bundle 内置，无需额外配置）。

禁用的原理是把 `<name>/SKILL.md` 改名为 `<name>/SKILL.md.disabled`，启用则改回来。DSH 内置的技能文件系统提供方会 watch 技能根目录，所以被禁用的技能会**立刻从模型可见的技能目录中消失**（重新启用后立即恢复）。技能内容不会被改动——只动 `SKILL.md` 这个文件名。

## 安装

本插件是 dsh bundle（声明了 `dsh.bundle.patch`），像其他 profile 插件一样安装。

### 环境要求

- **Node.js ≥ 22.19**（用 `node --version` 确认）
- 已有 dsh web profile（`dsh plugin` 命令操作 profile 目录，如 `--profile web`）

### ⚠️ 同名包警告

npm 上存在**另一个同名 `dsh-skill-manager` 包**（不同作者发布）。直接按裸包名安装可能装到错误的包。请始终显式指定本仓库：

```sh
# 从 GitHub 安装
dsh plugin --profile web add Thomas-key/dsh-skill-manager

# 或从本地目录安装
dsh plugin --profile web add ./dsh-skill-manager
```

### 安装步骤

你的 profile 目录是 pnpm workspace root，安装命令**必须带 `-w` 参数**（否则 pnpm 报 `ERR_PNPM_ADDING_TO_ROOT` 拒绝执行）：

```sh
dsh plugin --profile web add -w Thomas-key/dsh-skill-manager
```

若从本地目录安装，插件的运行时依赖（`@deepseek-ai/dsh-tools`）必须**先在本地仓库装好**再 add（profile 是 link 方式引用该目录，Node 从目录内解析依赖；依赖缺失会导致 `dsh web` 启动即崩，报 `ERR_MODULE_NOT_FOUND`）：

```sh
cd dsh-skill-manager
npm install
cd ..
dsh plugin --profile web add -w ./dsh-skill-manager
```

### 验证

重启 `dsh web` 后，任选其一：

- 打开**设置 → 技能**（设置页 UI 列出所有技能，带启用/禁用开关），或
- 对 agent 说："列出我的技能。" / "禁用 `read` 这个技能。"

agent 会调用 `skills_list` / `skills_toggle` 完成操作。开关即时生效——同一会话里再问一次"能看到哪些技能"即可验证。若装完 `dsh web` 启动失败，先检查报错是否为缺 `@deepseek-ai/dsh-tools`（见上文）。

## 设置页 UI

同样的管理能力也作为**设置页**（设置 → 侧栏"技能"页）提供。Web UI 以 client bundle 形式分发（`lib/client.js`，由 shell 的 `__ModuleLoader__` 加载），开箱即用、无需额外配置、重启后依然存在。

> 遗留说明：早期的动态插件变体（`plugin/skill-manager.js`）通过 `cordis_define`/`cordis_run` 提供同一套 UI。该文件仅作参考保留；现在的 bundle 已同时覆盖工具和 UI。

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

## 维护状态

本插件由 **deepseek-v4-flash**（AI agent）制作。如果这句话没有被删除，说明作者不会主动维护此插件——它只是为了解决"DSH 没有技能管理界面"这个个人需求而做的，能用就行，不计划更新。欢迎 fork 和 PR。

## License

MIT
