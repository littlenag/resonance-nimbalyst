# Resonance for Nimbalyst

A Nimbalyst extension that adds a **Resonance** panel to the workspace: the same spec, change log, diagnostics and logs as Resonance's web UI (`resonance/web`), rebuilt in Nimbalyst's own look. It doesn't embed the web UI.

It is UI only. It does not bundle the Resonance skill, MCP server or hook: `resonance init` already installs that agent kit in each repository, and Nimbalyst's agents pick it up from there. It has no backend module.

## Layout, and keeping it in step with the web UI

`src/` mirrors `resonance/web/src` file for file, so a change on one side can be carried to the other:

| Here | In the web UI | How it differs |
| --- | --- | --- |
| `types.ts`, `fields.ts`, `specFilter.ts`, `specTypes.ts`, `boot.ts` | same names | Copied unchanged |
| `pages/`, `components/` | same names | Same logic; Mantine components swapped for `ui/` |
| `api.ts` | `api.ts` | Same `call()`; carried by `transport.ts` |
| `live.ts` | `live.ts` | Same interface; polls instead of an event stream |
| `App.tsx` | `App.tsx` | Same shell; command palette in `components/CommandPalette.tsx` |
| `nav.tsx`, `hotkeys.tsx`, `notify.ts` | react-router, Mantine hooks and notifications | Small in-memory replacements |
| `ui/`, `styles.css` | Mantine | Nimbalyst's look |

## Look and feel

Nimbalyst extensions don't use a component library. They use React (the host's copy) styled with the host's `--nim-*` theme variables, and Material Symbols icons. This extension does the same:

- `ui/index.tsx` holds the widgets (buttons, badges, inputs, menus, dialogs, a drawer), styled in `styles.css` with `--nim-*` variables, so they follow every Nimbalyst theme, light or dark.
- Layout uses Tailwind utilities with the SDK's `nimbalystPreset`, scoped to `.rn-root` and without Tailwind's reset, so nothing leaks into the host.
- Notifications go through Nimbalyst's own (`services.ui`).
- Keyboard shortcuts work only while focus is inside the panel.

## How it talks to the daemon

1. `resonance.ts` finds the binary (the `binaryPath` setting, then `~/.cargo/bin/resonance`). It tells "not a git repository" apart from "not set up", then runs `resonance ui --no-open --json`, which starts the daemon if needed and gives its port and key.
2. `transport.ts` calls the daemon's web API (`/auth`, `POST /api/call`) with `curl`, run through `PanelHost.exec`. Nimbalyst's renderer is a `file://` page: it can't send the daemon's `SameSite=Strict` cookie, the daemon would refuse its `Origin`, and the API sends no CORS headers. The key never appears on a command line: the curl configuration travels in an environment variable and reaches curl on stdin. Each call takes about 20 ms.
3. `live.ts` polls `diagnostics` and `logs` with `since` every 1.5 s, in place of the web UI's event stream. The daemon answers both from memory and records neither as activity. New `changeset`, `changelog`, `reconcile`, `git` or `divergence` events refresh the views.

Known differences from the web UI:
- The panel doesn't appear in the daemon's client list, and polling doesn't keep an idle daemon alive. After 30 idle minutes the daemon exits, and the panel offers **Start and reconnect**.
- Changes show up within about 1.5 s rather than at once.
- The theme follows Nimbalyst, so there is no light/dark toggle.

A small change in Resonance would let the panel use `fetch` and the event stream directly: accept the key in an `Authorization` header, with CORS. Then only `transport.ts` and `live.ts` change.

## Future
- [ ] Direct `fetch` and the event stream, after a Resonance change to how the daemon accepts its key
- [ ] Rework the layout for Nimbalyst's UX (next discussion)
- [ ] Open the panel at a spec item from a command or a link
- [ ] A badge with pending change-log entries
- [ ] Show the agent kit's state, as `resonance status` does
- [ ] A keybinding for the panel toggle (`io.github.littlenag.resonance.spec.toggle`)
- [ ] Marketplace metadata, and a release workflow that attaches a `.nimext` file to GitHub Releases

## Development

```
npm install
npm run build
```

Develop through Nimbalyst's Extension Dev Tools (Settings > Application > Advanced). `extension_install` symlinks this folder into Nimbalyst's extension folder, and `extension_reload` rebuilds and reloads it without a restart. A restart loads whatever is in `dist/` at the time.

Test in repositories made with `just fixture-repo` from the Resonance repository (it prints a new temporary repository's path), then `resonance -C <path> init`. Don't test in the Resonance repository itself.
