// dsh-skill-manager — client half (bundle mode Settings UI).
//
// Registers a "技能" (Skills) settings section that lists every filesystem
// skill with its enabled state and an enable/disable toggle. Data comes from
// the host half's same-origin JSON routes (/api/skill-manager/list,
// /api/skill-manager/toggle) — bundle clients cannot use harness.handle /
// host.call, so they fetch the webServer routes instead.
//
// This file is loaded by the DSH web shell via __ModuleLoader__ (declared in
// package.json dsh.client + exports["./client"]). No TypeScript/JSX/imports:
// plain CommonJS-style factory with require("react").
window.__ModuleLoader__.load({
	id: "dsh-skill-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const inject = ["slots"];

		const LIST_URL = "/api/skill-manager/list";
		const TOGGLE_URL = "/api/skill-manager/toggle";

		function SkillManager() {
			const [state, setState] = react.useState({ loading: true, items: [], error: "" });
			const [busy, setBusy] = react.useState("");

			const refresh = react.useCallback(function () {
				setState(function (s) { return { loading: true, items: s.items, error: "" }; });
				fetch(LIST_URL)
					.then(function (response) { return response.json(); })
					.then(function (payload) {
						if (payload && payload.ok === true && Array.isArray(payload.skills)) {
							setState({ loading: false, items: payload.skills, error: "" });
						} else {
							setState({ loading: false, items: [], error: "bad payload" });
						}
					})
					.catch(function (e) {
						setState({ loading: false, items: [], error: String((e && e.message) || e) });
					});
			}, []);

			react.useEffect(function () { refresh(); }, [refresh]);

			const toggle = function (name, currentEnabled) {
				setBusy(name);
				fetch(TOGGLE_URL, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ name: name, enabled: !currentEnabled }),
				})
					.then(function (response) { return response.json(); })
					.then(function (payload) {
						if (!payload || payload.ok !== true) {
							throw new Error((payload && payload.error) || "toggle failed");
						}
						refresh();
					})
					.catch(function (e) {
						setState(function (s) { return { loading: false, items: s.items, error: String((e && e.message) || e) }; });
					})
					.finally(function () { setBusy(""); });
			};

			const btnStyle = { padding: "4px 12px", borderRadius: 6, border: "1px solid currentColor", background: "transparent", cursor: "pointer", fontSize: 13 };
			const row = function (item) {
				return react.createElement("div", { key: item.name, style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,127,127,0.25)" } },
					react.createElement("div", { style: { flex: 1, minWidth: 0 } },
						react.createElement("div", { style: { fontWeight: 600, fontSize: 14 } }, item.enabled ? item.name : item.name + "（已禁用）"),
						item.description ? react.createElement("div", { style: { fontSize: 12, opacity: 0.75, marginTop: 2 } }, String(item.description)) : null,
						react.createElement("div", { style: { fontSize: 11, opacity: 0.45, marginTop: 2 } }, String(item.root))
					),
					react.createElement("button", { style: btnStyle, onClick: function () { toggle(item.name, item.enabled); }, disabled: busy === item.name },
						busy === item.name ? "…" : (item.enabled ? "禁用" : "启用"))
				);
			};

			return react.createElement("div", { style: { padding: 16 } },
				react.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 } },
					react.createElement("div", { style: { fontWeight: 600 } }, "技能管理"),
					react.createElement("button", { style: btnStyle, onClick: refresh, disabled: state.loading }, state.loading ? "…" : "刷新")
				),
				state.error ? react.createElement("div", { style: { color: "#e5534b", marginBottom: 8, fontSize: 13 } }, String(state.error)) : null,
				state.loading ? react.createElement("div", { style: { opacity: 0.6 } }, "加载中…") :
					(state.items.length === 0 ? react.createElement("div", { style: { opacity: 0.6 } }, "未在技能目录发现技能") :
						react.createElement("div", null, state.items.map(row)))
			);
		}

		function apply(ctx) {
			const slots = ctx.get("slots");
			if (slots === undefined) return;
			ctx.effect(() => slots.inject("settings.section", () => slots.register(
				{ name: "settings.section", id: "skills", order: 16, label: "技能" },
				() => react.createElement(SkillManager, null)
			)), "skill-manager: section");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
