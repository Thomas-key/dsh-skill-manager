# dsh-skill-manager

> List and toggle DeepSeek Harness filesystem skills — from the agent, or from a Settings page ("技能" / "Skills").

DeepSeek Harness loads skills straight from the filesystem (`~/.agents/skills/<name>/SKILL.md`, `~/.dsh/skills`, project-level `.dsh/skills` and `.agents/skills`) but ships **no management surface**: there is no way to see which skills are installed, and no way to turn one off. `dsh-skill-manager` fills that gap.

- **`skills_list`** — list every filesystem skill with its enabled state and one-line description.
- **`skills_toggle`** — enable/disable any skill instantly (no restart).
- **Settings UI** — a "技能" (Skills) page in Settings with the same list and enable/disable toggles (bundle-included, no extra setup).

Disabling renames `<name>/SKILL.md` to `<name>/SKILL.md.disabled`; enabling renames it back. The built-in skill-filesystem provider watches the roots, so a disabled skill **disappears from the model-visible skill catalog immediately** (and reappears when re-enabled). Skill content is never modified — only the `SKILL.md` filename.

## Install

The plugin is a dsh bundle (declares `dsh.bundle.patch`), so it installs like any other profile plugin.

### Requirements

- **Node.js ≥ 22.19** (check with `node --version`)
- A dsh web profile (`dsh plugin` commands target the profile directory, e.g. `--profile web`)

### ⚠️ Name collision warning

There is an **unrelated npm package also named `dsh-skill-manager`** (published by a different author). Installing by bare npm name may pull the wrong package. Always install from this repository explicitly:

```sh
# from GitHub
dsh plugin --profile web add Thomas-key/dsh-skill-manager

# or from a local checkout
dsh plugin --profile web add ./dsh-skill-manager
```

### Installing

Your profile directory is a pnpm workspace root, so the install command **must include the `-w` flag** (otherwise pnpm refuses with `ERR_PNPM_ADDING_TO_ROOT`):

```sh
dsh plugin --profile web add -w Thomas-key/dsh-skill-manager
```

For a local checkout, the plugin's runtime dependency (`@deepseek-ai/dsh-tools`) must be installed **inside the checkout** before adding it (the profile links the directory and Node resolves imports from it; a missing dependency crashes `dsh web` at startup with `ERR_MODULE_NOT_FOUND`):

```sh
cd dsh-skill-manager
npm install
cd ..
dsh plugin --profile web add -w ./dsh-skill-manager
```

### Verify

Restart `dsh web`, then either:

- open **Settings → 技能** (the Settings UI lists every skill with enable/disable toggles), or
- ask the agent: "List my skills." / "Disable the skill `read`."

The agent will call `skills_list` / `skills_toggle` for you. Toggling takes effect immediately — you can verify in the same session by asking what skills are visible. If `dsh web` fails to start after installing, check the error is not a missing `@deepseek-ai/dsh-tools` (see above).

## Settings UI

The same management surface is available as a settings page ("技能" / "Skills" in Settings). The web UI ships as a client bundle (`lib/client.js`, loaded via the shell's `__ModuleLoader__`) and works out of the box — no extra setup, survives restarts.

> Legacy note: an earlier dynamic-plugin variant (`plugin/skill-manager.js`) provided the same UI via `cordis_define`/`cordis_run`. It is kept for reference only; the bundle now covers both the tools and the UI.

## How it works

```
agent → skills_list / skills_toggle (model tools)
     → Host plugin → `node -e` bridge (stdin: JSON op, stdout: JSON result)
     → scans skill roots / renames SKILL.md <-> SKILL.md.disabled
     → dsh-skill-filesystem watcher → catalog updates instantly
```

The bridge is zero-dependency (Node built-ins only) and runs inside DSH's normal subprocess service.

## Boundaries

- Scans only the four standard skill roots; anything else is untouched.
- Only renames `SKILL.md`/`SKILL.md.disabled` — never reads, edits, or deletes skill content.
- Toggling a skill only hides it from the *catalog* (model-visible list). Installed files stay in place; disabling is fully reversible.

## Maintenance status

This plugin was authored by **deepseek-v4-flash** (an AI agent). If this notice has not been removed, the author does not actively maintain this plugin — it was built to scratch a personal itch (DSH ships no skill-management surface) and works as-is. No updates are planned as long as it keeps working. Forks and PRs are welcome.

## License

MIT
