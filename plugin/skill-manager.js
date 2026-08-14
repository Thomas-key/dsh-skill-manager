// dsh-skill-manager — dynamic-plugin mode (Settings UI).
//
// The bundle mode (lib/index.js) exposes skills_list / skills_toggle as model
// tools. This file provides the same management surface as a settings page
// ("技能" / "Skills" in the Settings sidebar) via DSH's dynamic Cordis plugin
// mechanism. It is session-scoped: after a DSH restart, re-install it.
//
// Install:
//   1. cordis_define with kind: "new", idPrefix of your choice
//   2. code.host   = the `HOST_BODY` template below (a JS function body that
//      returns a Cordis plugin)
//   3. code.client = the `CLIENT_BODY` template below
//   4. cordis_run, then approve the client activation in the UI
//   5. Open Settings → "技能" (Skills)

const HOST_BODY = `return {
  apply(ctx) {
    const sub = ctx.get('subprocess')
    const sp = ctx.get('sandboxPolicy')
    if (sub === undefined) return
    const cwd = (sp !== undefined && typeof sp.workspaceRoot === 'string') ? sp.workspaceRoot : '.'

    const SCRIPT = [
      "const fs = require('fs');",
      "const path = require('path');",
      "const home = process.env.USERPROFILE || process.env.HOME || '';",
      "const cwd = process.cwd();",
      "const roots = [path.join(home, '.agents', 'skills'), path.join(home, '.dsh', 'skills'), path.join(cwd, '.dsh', 'skills'), path.join(cwd, '.agents', 'skills')].filter(function (r) { return r && fs.existsSync(r) });",
      "let input = '';",
      "process.stdin.on('data', function (d) { input += d });",
      "process.stdin.on('end', function () {",
      "  let req = {};",
      "  try { req = JSON.parse(input) } catch (e) { req = { op: 'list' } }",
      "  if (req.op === 'list') {",
      "    const out = [];",
      "    for (const root of roots) {",
      "      let names = [];",
      "      try { names = fs.readdirSync(root, { withFileTypes: true }).filter(function (e) { return e.isDirectory() }).map(function (e) { return e.name }) } catch (e) {}",
      "      for (const name of names.sort()) {",
      "        const dir = path.join(root, name);",
      "        const activeFile = path.join(dir, 'SKILL.md');",
      "        const disabledFile = path.join(dir, 'SKILL.md.disabled');",
      "        const enabled = fs.existsSync(activeFile);",
      "        if (!enabled && !fs.existsSync(disabledFile)) continue;",
      "        let description = '';",
      "        try {",
      "          const txt = fs.readFileSync(enabled ? activeFile : disabledFile, 'utf8');",
      "          const m = txt.match(/^description:\\\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|(.*))$/m);",
      "          description = (m ? (m[1] || m[2] || m[3] || '') : '').trim();",
      "        } catch (e) {}",
      "        out.push({ name: name, enabled: enabled, description: description, root: root });",
      "      }",
      "    }",
      "    process.stdout.write(JSON.stringify(out));",
      "  } else if (req.op === 'toggle' && req.name) {",
      "    let changed = false;",
      "    let errMsg = '';",
      "    for (const root of roots) {",
      "      const dir = path.join(root, req.name);",
      "      const activeFile = path.join(dir, 'SKILL.md');",
      "      const disabledFile = path.join(dir, 'SKILL.md.disabled');",
      "      try {",
      "        if (req.enabled && fs.existsSync(disabledFile)) { fs.renameSync(disabledFile, activeFile); changed = true; break; }",
      "        if (!req.enabled && fs.existsSync(activeFile)) { fs.renameSync(activeFile, disabledFile); changed = true; break; }",
      "      } catch (e) { errMsg = String(e && e.message || e); }",
      "    }",
      "    process.stdout.write(JSON.stringify({ ok: changed, error: changed ? '' : (errMsg || 'no such skill dir or already in target state') }));",
      "  } else {",
      "    process.stdout.write(JSON.stringify({ ok: false, error: 'bad op' }));",
      "  }",
      "});"
    ].join('\\n')

    async function runBridge(payload) {
      const handle = sub.spawn({
        argv: ['node', '-e', SCRIPT],
        cwd: cwd,
        stdio: {
          stdin: { data: JSON.stringify(payload) },
          stdout: { maxBytes: 300000 },
          stderr: { maxBytes: 8000 }
        },
        graceMs: 3000
      })
      const outcome = await handle.done
      const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const err = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      if (outcome.exitCode !== 0) throw new Error('skill bridge exit ' + outcome.exitCode + ': ' + (err || out).slice(0, 500))
      let parsed
      try {
        parsed = JSON.parse(out)
      } catch (e) {
        throw new Error('skill bridge bad output: ' + out.slice(0, 300))
      }
      return parsed
    }

    harness.handle('skills.list', async function () {
      return runBridge({ op: 'list' })
    })
    harness.handle('skills.toggle', async function (args) {
      const name = String((args && args.name) || '')
      if (!name) return { ok: false, error: 'name required' }
      return runBridge({ op: 'toggle', name: name, enabled: args.enabled === true })
    })
  }
}`

const CLIENT_BODY = `return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    function SkillManager() {
      const [state, setState] = React.useState({ loading: true, items: [], error: '' })
      const [busy, setBusy] = React.useState('')
      const refresh = React.useCallback(function () {
        setState(function (s) { return { loading: true, items: s.items, error: '' } })
        host.call('skills.list').then(function (res) {
          setState({ loading: false, items: Array.isArray(res) ? res : [], error: '' })
        }).catch(function (e) {
          setState({ loading: false, items: [], error: String((e && e.message) || e) })
        })
      }, [])
      React.useEffect(function () { refresh() }, [refresh])
      const toggle = function (name, currentEnabled) {
        setBusy(name)
        host.call('skills.toggle', { name: name, enabled: !currentEnabled }).then(function () { refresh() }).catch(function (e) {
          setState(function (s) { return { loading: false, items: s.items, error: String((e && e.message) || e) } })
        }).finally(function () { setBusy('') })
      }
      const btnStyle = { padding: '4px 12px', borderRadius: 6, border: '1px solid currentColor', background: 'transparent', cursor: 'pointer', fontSize: 13 }
      const row = function (item) {
        return React.createElement('div', { key: item.name, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(127,127,127,0.25)' } },
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontWeight: 600, fontSize: 14 } }, item.enabled ? item.name : item.name + '（已禁用）'),
            item.description ? React.createElement('div', { style: { fontSize: 12, opacity: 0.75, marginTop: 2 } }, String(item.description)) : null,
            React.createElement('div', { style: { fontSize: 11, opacity: 0.45, marginTop: 2 } }, String(item.root))
          ),
          React.createElement('button', { style: btnStyle, onClick: function () { toggle(item.name, item.enabled) }, disabled: busy === item.name },
            busy === item.name ? '…' : (item.enabled ? '禁用' : '启用'))
        )
      }
      return React.createElement('div', { style: { padding: 16 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 } },
          React.createElement('div', { style: { fontWeight: 600 } }, '技能管理'),
          React.createElement('button', { style: btnStyle, onClick: refresh, disabled: state.loading }, state.loading ? '…' : '刷新')
        ),
        state.error ? React.createElement('div', { style: { color: '#e5534b', marginBottom: 8, fontSize: 13 } }, String(state.error)) : null,
        state.loading ? React.createElement('div', { style: { opacity: 0.6 } }, '加载中…') :
          (state.items.length === 0 ? React.createElement('div', { style: { opacity: 0.6 } }, '未在技能目录发现技能') :
            React.createElement('div', null, state.items.map(row)))
      )
    }

    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'skills', order: 16, label: '技能' },
        function () { return React.createElement(SkillManager, null) }
      )
    })
  }
}`

// Reference only — paste HOST_BODY / CLIENT_BODY into cordis_define.
export { HOST_BODY, CLIENT_BODY }
