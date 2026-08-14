// dsh-skill-manager — list and toggle DeepSeek Harness filesystem skills.
//
// A skill is enabled when its directory contains SKILL.md; disabling renames
// it to SKILL.md.disabled and enabling renames it back. The dsh
// skill-filesystem provider watches the skill roots, so a toggle takes effect
// immediately (the skill disappears from / reappears in the model-visible
// catalog) without a restart.
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'skill-manager'

// Bridge script run through `node -e` (payload arrives on stdin, result on
// stdout as one JSON line). Pure Node built-ins; no dependencies.
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
  "          const m = txt.match(/^description:\\s*(?:\"([^\"]*)\"|'([^']*)'|(.*))$/m);",
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
].join('\n')

export function apply(ctx) {
  const tools = ctx.get('tools')
  const subprocess = ctx.get('subprocess')
  const sandboxPolicy = ctx.get('sandboxPolicy')
  if (tools === undefined || subprocess === undefined) return
  const cwd = sandboxPolicy !== undefined && typeof sandboxPolicy.workspaceRoot === 'string'
    ? sandboxPolicy.workspaceRoot
    : '.'

  async function runBridge(payload, signal) {
    const handle = subprocess.spawn({
      argv: ['node', '-e', SCRIPT],
      cwd,
      stdio: {
        stdin: { data: JSON.stringify(payload) },
        stdout: { maxBytes: 300000 },
        stderr: { maxBytes: 8000 },
      },
      graceMs: 3000,
      signal,
    })
    const outcome = await handle.done
    const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const err = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    if (outcome.exitCode !== 0) {
      throw new Error('skill bridge exit ' + outcome.exitCode + ': ' + (err || out).slice(0, 500))
    }
    let parsed
    try {
      parsed = JSON.parse(out)
    } catch (e) {
      throw new Error('skill bridge bad output: ' + out.slice(0, 300))
    }
    return parsed
  }

  const skillItemSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string', required: true },
      enabled: { type: 'boolean', required: true },
      description: { type: 'string' },
      root: { type: 'string' },
    },
  }

  ctx.effect(() => tools.register(defineTool({
    name: 'skills_list',
    description: 'List every filesystem skill in the DSH skill roots (~/.agents/skills, ~/.dsh/skills, project .dsh/skills and .agents/skills). Each entry reports whether the skill is enabled and its one-line description.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          skills: { type: 'array', required: true, items: skillItemSchema },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: formatList(value.skills),
      }],
    },
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      const list = await runBridge({ op: 'list' }, exec.signal)
      return { skills: Array.isArray(list) ? list : [] }
    },
  })))

  ctx.effect(() => tools.register(defineTool({
    name: 'skills_toggle',
    description: 'Enable or disable a filesystem skill by renaming SKILL.md <-> SKILL.md.disabled. The DSH skill filesystem watcher picks the change up immediately: a disabled skill disappears from the model-visible skill catalog, an enabled one reappears. Pass the target state in `enabled`.',
    parameters: {
      name: { type: 'string', required: true, description: 'The skill directory name (kebab-case).' },
      enabled: { type: 'boolean', required: true, description: 'Target state: true to enable, false to disable.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          error: { type: 'string' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.ok
          ? 'Skill ' + _args.name + ' is now ' + (_args.enabled ? 'enabled' : 'disabled') + '.'
          : 'Failed to toggle skill ' + _args.name + ': ' + (value.error || 'unknown'),
      }],
    },
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const name = String(args.name || '').trim()
      if (!name) throw new Error('name must be a non-empty string')
      return runBridge({ op: 'toggle', name, enabled: args.enabled === true }, exec.signal)
    },
  })))
}

function formatList(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return 'No filesystem skills found.'
  const lines = skills.map((s) => {
    const status = s.enabled ? 'enabled' : 'DISABLED'
    const desc = s.description ? ' — ' + s.description : ''
    return '- ' + s.name + ' [' + status + ']' + desc
  })
  return lines.join('\n')
}
