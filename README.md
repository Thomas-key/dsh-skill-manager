# dsh-skill-manager

> List and toggle DeepSeek Harness filesystem skills — from the agent, or from the Settings UI (dynamic-plugin mode).

DeepSeek Harness loads skills straight from the filesystem (`~/.agents/skills/<name>/SKILL.md`, `~/.dsh/skills`, project-level `.dsh/skills` and `.agents/skills`) but ships **no management surface**: there is no way to see which skills are installed, and no way to turn one off. `dsh-skill-manager` fills that gap.

- **`skills_list`** — list every filesystem skill with its enabled state and one-line description.
- **`skills_toggle`** — enable/disable any skill instantly (no restart).

Disabling renames `<name>/SKILL.md` to `<name>/SKILL.md.disabled`; enabling renames it back. The built-in skill-filesystem provider watches the roots, so a disabled skill **disappears from the model-visible skill catalog immediately** (and reappears when re-enabled). Skill content is never modified — only the `SKILL.md` filename.

## Install

The plugin is a dsh bundle (declares `dsh.bundle.patch`), so it installs like any other plugin:

```sh
dsh plugin --profile web add Thomas-key/dsh-skill-manager
```

or from a local checkout:

```sh
dsh plugin --profile web add ./dsh-skill-manager
```

Restart `dsh web`, then ask the agent:

> List my skills.
> Disable the skill `read`.

The agent will call `skills_list` / `skills_toggle` for you. Toggling takes effect immediately — you can verify in the same session by asking what skills are visible.

## Settings UI (optional, dynamic-plugin mode)

The same management surface is also available as a **settings page** ("技能" / "Skills" in Settings → sidebar). Because the web UI ships as a client bundle, this mode is provided as a dynamic Cordis plugin (session-scoped; re-install after a DSH restart):

1. Open the plugin's `plugin/skill-manager.js`.
2. `cordis_define` with `code.host` = that file's host body and `code.client` = the client body; then `cordis_run` and approve.

The UI lists the same skills with enable/disable toggles and a refresh button.

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
