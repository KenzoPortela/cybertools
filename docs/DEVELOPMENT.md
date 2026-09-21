# Development

The technical side of cybertools. For installing and hosting it, see the
[README](../README.md).

## Contents

- [Development setup](#development-setup)
- [Updating the upstream sources](#updating-the-upstream-sources)
- [Production build](#production-build)
- [Image and deployment](#image-and-deployment)
- [Architecture](#architecture)

## Development setup

```bash
git clone https://github.com/KenzoPortela/cybertools.git
cd cybertools

npm run vendor:setup      # clones CyberChef and IT-Tools into vendor/, generates the CyberChef config
npm run vendor:sync-deps  # copies IT-Tools' dependencies into package.json
npm install
npm run dev
```

Requirements: Node 24 or newer (CyberChef's own requirement) and git. The first
`npm run dev` builds the CyberChef engine (one to two minutes); later ones reuse
it as long as neither CyberChef nor our build files have changed.

`vendor/` is not tracked in this repository: both upstream sources are cloned by
the script, at the revision recorded in `vendor.lock.json`. They are **never
modified** — after any command in this project, `git status` stays empty inside
`vendor/cyberchef` and `vendor/it-tools`.

## Updating the upstream sources

The revisions of CyberChef and IT-Tools are **pinned** in `vendor.lock.json`:
development, builds and the Docker image all use exactly the sources that were
tested, and a deployment never silently changes upstream version. Moving up is an
explicit decision:

```bash
npm run vendor:setup -- --update   # latest upstream revision, vendor.lock.json updated
npm run vendor:sync-deps           # realigns package.json with IT-Tools' dependencies
npm install
npm run build                      # watch for override warnings
```

Then run the verification scenarios again (see below) and commit
`vendor.lock.json` along with `package.json` and `package-lock.json`. On another
machine, `npm run vendor:setup` brings `vendor/` back to the pinned revision.

`npm run vendor:sync-deps -- --check` fails if `package.json` has drifted, which
makes it a useful guard in CI.

Three decisions deserve an explanation, all in
`build/scripts/sync-vendor-deps.mjs`:

- **Dropped dependencies.** `plausible-tracker` (third-party analytics) is not
  carried over. `unplugin-auto-import` and `vue-tsc` are declared as runtime
  dependencies by IT-Tools although they are build tools; they live in our
  `devDependencies`.
- **Promoted dependencies.** The script scans IT-Tools' source and also picks up
  packages they keep in `devDependencies` but import at runtime (today:
  `prettier`, for the HTML editor).
- **Pinned tiptap family.** IT-Tools installs with pnpm, whose lockfile keeps all
  of tiptap at 2.1.6. With npm, the extensions moved up to 2.27 and demanded a
  newer core. `@tiptap/vue-3` is pinned to `2.1.6` by the script, and the 22
  `@tiptap/*` packages through `overrides` in `package.json`.

## Production build

```bash
npm run build     # type check, CyberChef engine, then Vite → dist/
npm run preview   # serves dist/ on http://localhost:5050
```

`dist/` is a fully static site: any file server will do, with one condition —
serve `index.html` for unknown paths (it is a single-page application:
`/tools/to-hex` does not exist on disk).

## Image and deployment

How to run it (published image, Compose, reverse proxy, no Docker at all) is
covered in the [README](../README.md#hosting-cybertools). Here is what the image
does.

The `Dockerfile` has two stages:

1. **build** (`node:24`): clones CyberChef and IT-Tools at the revisions in
   `vendor.lock.json`, builds the CyberChef engine, then the application. This
   stage always runs on the architecture of the building machine
   (`--platform=$BUILDPLATFORM`): the result is a static site, identical
   everywhere, so nothing is emulated;
2. **runtime** (`nginx-unprivileged`, ~180 MB): nginx, without root, serves
   `dist/` on port **8080**. Only this stage is built for amd64 and arm64.

The Docker context holds only our own sources (`.dockerignore`): no need to have
prepared `vendor/` on the building machine. Expect a few minutes and about 4 GB
of memory (webpack over CyberChef's operations).

**Three Compose files**:

| File | Role |
|---|---|
| `docker-compose.yml` | the image published on ghcr.io, port 8080 published (`CYBERTOOLS_PORT` to change it), read-only container, health check. |
| `docker-compose.proxy.yml` | the same, standalone, with no published port: for a reverse proxy that reaches the container over the Docker network. |
| `docker-compose.build.yml` | an override that builds the image from source instead of pulling it. |

**What nginx does** (`deploy/nginx.conf`):

- serves `index.html` for every application route, never cached;
- serves `assets/` (fingerprinted names) with a one-year cache, and the CyberChef
  engine with revalidation (ETag): a deployment shows up on the next reload;
- compresses with gzip; answers `ok` on `/healthz`;
- sets a **Content Security Policy** that forbids any connection to another
  origin (`connect-src 'self'`): the promise that no data leaves the browser is
  enforced by the browser itself, not only by the code. `Referrer-Policy:
  no-referrer` keeps a link clicked from the application from leaking the page
  address. A feature that needed to contact an outside service would therefore
  require loosening this policy — that is the point.

**Continuous integration** (`.github/workflows/`):

- `ci.yml` — on every push and pull request: `vendor:setup` (with a cache of
  `vendor/`), `npm ci`, `vendor:sync-deps --check`, `npm run build`, and a check
  that `vendor/` is still untouched;
- `docker.yml` — builds the image; on `main` it is published as `latest`, on a
  `vX.Y.Z` tag as that version. On a pull request it is built but not published.

**Updating a deployment**: pull the new image (`docker compose pull && docker
compose up -d`) or rebuild it. `vendor.lock.json` decides which upstream versions
the image carries — see "Updating the upstream sources".

## Architecture

```
src/
  app/            application: App, router, theme, i18n, shell state
  layouts/        AppShell (the chassis) and ToolShell (a tool's frame)
  pages/          pages
  components/     shell/ (rail, top bar, status bar, tab bar), palette,
                  tool rows, context rail, pane resizer
  catalog/        data model shared by both sources, categories, search
  integrations/   CyberChef engine: worker client, forms, Recipes, Magic
  stores/         favourites, recents, current recipe, settings
  overrides/      files that replace their vendor/ counterparts (see below)
  locales/        en / fr translations
build/
  scripts/        vendor setup, CyberChef build, type check, verification
  cyberchef/      webpack config and entry point of the CyberChef worker
  scenarios/      scenarios for verification in a real browser
  vite/           our own Vite plugins
deploy/           nginx configuration of the Docker image
vendor/           upstream sources, cloned, never modified
vendor.lock.json  upstream revisions in use
```

Two import aliases structure the code:

- `~/` is our code (`src/`);
- `@/` is IT-Tools' source (`vendor/it-tools/src/`), because their components
  import each other that way and we consume them without rewriting them.

There is **a single `node_modules`, at the root**. Installing dependencies inside
`vendor/it-tools` would produce two instances of Vue, Pinia and naive-ui, which
breaks reactivity and context injection. That is what `vendor:sync-deps` is for.

### Catalogue

Every tool, whatever its source, is described by the same `ToolDef`
(`src/catalog/tool.types.ts`). Each source produces its list
(`src/catalog/sources/`), the registry (`src/catalog/registry.ts`) merges them
and rejects duplicate ids, slugs or aliases. The rest of the application — home,
search, palette, favourites, recents, router — only knows the registry.

- **IT-Tools**: their registry is read from `vendor/`, so a tool added upstream
  appears with no work on our side. Each one is filed into our categories by an
  explicit table; a tool missing from the table falls back to a default category
  and warns in development.
- **Addresses**: `/tools/<slug>`. The site is English-first, and so are its URLs;
  the earlier French paths (`/outils/…`, `/parametres`, `/a-propos`) still work,
  as do IT-Tools' own URLs (`/hash-text`) and their old aliases.
- **Search** (`src/catalog/search.ts`, shared by the home page, the palette and
  the recipe workbench): word by word, in any order, accent-insensitive, with
  typos tolerated according to word length. A result containing every word comes
  first; failing that, one word may be missing. An equivalence dictionary maps
  French words to the tools' English vocabulary ("déchiffrer" → *decrypt*), and
  `src/catalog/synonyms.ts` gives CyberChef operations the names people actually
  use ("caesar" → ROT13, "sha256" → SHA2).
- **Palette** (`src/components/CommandPalette.vue`): Ctrl+K or ⌘K anywhere;
  `/` outside a text field. Scopes by prefix or by the chips under the field:
  nothing for everything, `/` categories, `#` the saved recipe, `>` commands.
  Results are grouped after the search engine has ranked them: *best matches*
  (the tool's name carries the words, one typo allowed), *also known as* (its
  keywords do — ROT13 for "caesar"), *other results*, then *actions*. On a tool,
  ⌘↵ adds it to the current recipe and ⌘F pins it.
- **Favourites** (pinned tools): in `localStorage`, by id. **Recents**:
  `{ id, at, count }` per tool, most recent first, 100 at most — the home page
  shows when each tool was last opened and which are used most. The older
  id-only format is read back without inventing dates.
- **Settings** (`/settings`, the gear at the bottom of the rail): theme, accent
  colour, language, collapsed rail, live or on-demand computation, reopening the
  last recipe, Magic defaults, clearing favourites and recents, JSON export and
  import, full reset.
  Settings live in `cybertools:settings` (`src/stores/settings.ts`); the import
  only accepts the application's own keys.

### CyberChef

The CyberChef engine runs in a **worker**, in the browser. It is built by
`npm run cyberchef:build` (run automatically before `dev`, `build` and
`typecheck`):

- with **their** webpack configuration, which `build/cyberchef/webpack.config.cjs`
  completes with four adjustments (Windows paths, unneeded plugins, entry points,
  a single bundled operation module). Re-bundling with Vite was tried and
  abandoned in phase 0: their dependencies rely on webpack specifics;
- into `public/cyberchef/`: `chef-worker.js` (4.8 MB, the 214 operations of the
  *Default* module) and 23 modules loaded on demand, as on cyberchef.org;
- with a light index of the operations (`src/generated/`) for the catalogue. The
  full configuration, 106 kB gzipped, is only loaded when an operation is opened.

Each operation becomes a tool (`/tools/to-hex`) whose form is generated from its
configuration, using IT-Tools' components. The tables in
`src/catalog/sources/cyberchef.ts` settle the rest:

- **excluded operations**, with their reason (see "Known limitations");
- **IT-Tools duplicates**: the IT-Tools tool stays alone in the catalogue, and
  the equivalent operation remains available in Recipes;
- **filing** into our categories, with per-operation corrections where
  CyberChef's own category would file a tool poorly;
- the ten **flow control** operations (Fork, Jump, Merge…) only make sense inside
  a recipe and are not listed as tools.

The catalogue therefore holds 540 tools: 86 from IT-Tools, 450 CyberChef
operations, the recipe workbench, Magic, the Stego Lab and its companion tool to
hide data in an image.

### Recipes and Magic

The recipe workbench (`/tools/recipes`, or `/recipes`) chains CyberChef
operations with a live result. It offers every operation, including flow control
and the IT-Tools duplicates; only the excluded operations are missing, and they
are dropped (with a message) from an imported recipe.

- **Three panes**, full height, each scrolling on its own: the operations
  (`RecipeOpsPane.vue` — always open, filtered by the site's search engine,
  grouped by category; ↵ adds, ⇧↵ replaces the recipe), the recipe
  (`RecipeStepCard.vue` — 32 px headers, arguments on two columns), and input and
  output (`CcInput.vue`, `CcOutput.vue`). The first two widths are resizable,
  with the mouse or the keyboard (`PaneResizer.vue`), and remembered. Below
  1000 px, the panes stack. Each pane has its own footer — shortcuts, step
  count, the run banner (`68 o → 29 o · 1 ms · 2 steps · 0 errors`) — so the
  global status bar steps aside on this page only.
- **Input and output** are shared with the operation pages. Input: text with
  line numbers, its bytes in hex, or a file; a strip shows the cursor position,
  the entropy and what the data *looks like* ("base64 → GZIP": a guess made in
  the tab — hex, base64, JSON, URL, then file signatures — not a decode).
  Output: raw text with the byte offset of each line, hex, a tree when the
  output is JSON, and a line diff against the input. The text areas are real
  `<textarea>`s (`CodeView.vue`), with a gutter that only draws visible lines.

- **CyberChef format.** Links are cyberchef.org's own:
  `#recipe=<recipe>&input=<base64 input>`. A link opens here or there, either
  way. The "pretty" format is read and produced by the worker, using CyberChef's
  own implementation (`build/cyberchef/worker-extensions.js`): no parser was
  copied. The address is read and written raw, bypassing vue-router, which would
  decode then re-encode the fragment and corrupt a "+".
- **Address and data.** The address mirrors the recipe at all times, never the
  input; sharing offers to include the input, with a warning. The workbench opens
  empty; the last recipe is saved locally and comes back with one click. The
  input is never saved.
- **Failing step.** A thrown error, or an operation error that stops the recipe
  (CyberChef then makes it the output), highlights the step.
- **Magic** suggests leads from the output of the current recipe, and adds them
  in one click. We read its raw output (the JSON list of candidates), not the
  HTML table it presents. The `/tools/magic` tool does the same on unknown data
  and opens the chosen lead in the workbench. **Automatic depth** (the default):
  Magic is re-run at depth 1, 2, 3… as long as a lead cut short by the depth is
  still decodable (for each lead, CyberChef reports the operations that would
  still apply to its result). It stops at 6, or earlier if the next level would
  likely exceed about 8 s; the detected depth is displayed. A manual mode is
  available.
- **Bridges.** IT-Tools tools that have a CyberChef equivalent offer "Open in
  Recipes", and every operation offers "Continue in Recipes", carrying its
  settings and its input — passed in memory, not through the address.

### Design system

A single palette, in `src/app/theme.ts`, feeds three consumers: naive-ui (theme
overrides), IT-Tools' `c-*` kit (through the overrides below) and our own CSS
(`--ct-*` variables set on `<html>`). Changing a colour there changes it
everywhere, IT-Tools' tools included.

The theme has three states — automatic, light, dark — and the automatic one
follows the system live. IT-Tools' style store remains the source their
components read; we merely drive it.

**Colour themes.** Five accents: Terminal (green, the default), Indigo, Amber,
Arctic, Magenta, each with its own slightly tinted greys, in light and dark.
Only colours change, never shapes. IT-Tools' kit computes its colours when its
modules are imported, so the colour theme is read at load time
(`cybertools:settings`) and changing it reloads the page; the light/dark toggle
stays instant.

**Neutrals.** Ten per mode, from the chassis to the faintest text: `chassis`
(rail, status bar), `background`, `surface`, `surface-raised`, `elevated`,
`border`, `border-strong`, `text`, `text-muted`, `text-faint`. The green family
(Terminal) is the one that was designed; Indigo and Graphite are derived from it
by rotating the hue only, at constant lightness and saturation, so a single ramp
is maintained. Every text/background pair is checked at 4.5:1 — the tightest is
`text-faint` on `elevated`, at 4.6:1. Check any new pair before committing it.

**Accent.** Reserved for two things: the main action, and what is alive — the
cursor, a fresh result, the active item, a pinned tool. Never decoration.

**Radii.** One tier per object size instead of a single value: `micro` 4 px
(keyboard key, checkbox, number badge), `control` 6 px (button, field, tab, list
row), `panel` 10 px (card, panel, block), `float` 14 px (palette, modal, menu),
`pill` for switches. `global.css` spreads IT-Tools' `c-*` kit over them. The old
`base` / `small` / `medium` / `large` names remain as aliases.

**Typography.** Inter for text, JetBrains Mono for data and technical labels,
both bundled through `@fontsource`: no request to a font server. The scale
stops at 20 px: 20/600 page title, 15/600 panel title, 13/400 interface base,
12/400 secondary, 12.5 mono for data, 10 mono uppercase for section labels.
13 px is the chassis' own base (`--ct-font-size-ui`); naive-ui keeps 14 px, the
size IT-Tools' 86 tools were drawn for — the tool's frame is the border between
the two. Ligatures are off in fields, code and mono labels: "==" at the end of a
base64 string must not become a single glyph. Spacing uses 4, 8, 12, 16, 24 and
32 px, nothing in between.

**The chassis** (`src/layouts/AppShell.vue`). A permanent navigation rail
(224 px: workbench, pinned tools, the ten categories with their counts; it
collapses to 48 px of icons, and does so by itself on the workbench and the
Stego Lab), a top bar (the breadcrumb written as a path, `~/encoding/to-hex`,
and the page's actions, teleported into `#ct-topbar-actions`) and a status bar.
Below 1024 px the rail becomes a drawer; below 640 px a tab bar is added at the
bottom. The document scrolls, not an inner area: rail and bars hold with
`position: sticky`. Pages declare their own width with `.page` (1120 px at most)
and tell the chassis where they are and what they measured through
`useShellCrumbs` and `useShellStatus` (`src/app/shell.ts`).

**The status bar tells the truth.** On the left, what the page knows (its
source, its last run); failing that, the session's figures — CyberChef
operations run and bytes processed, in memory only (`src/stores/session.ts`).
On the right, the requests sent to another site, counted by the browser from
its resource timeline (`src/app/network-watch.ts`, imported first by
`main.ts`), rather than a hard-coded zero. The browser also records a request
the Content Security Policy refused, with no duration and no bytes, although it
never left: the page listens to `securitypolicyviolation` too, and such a
request is counted as *blocked*, not as sent.

**Touch.** Every target on our screens is at least 44 px under
`@media (hover: none)`: each component sets it in its own style, and
`global.css` does it for the kit components we use outside the tools. The
inside of IT-Tools' tools keeps its own rendering. `build/scenarios/touch.json`
measures it.

**Identity.** Logo and favicon (`src/components/AppLogo.vue`,
`public/favicon.svg`). The author (name and links) is defined once, in
`src/app/author.ts`, for the status bar and the About page.

### Overriding an IT-Tools file

A file placed in `src/overrides/it-tools/<path>` replaces
`vendor/it-tools/src/<path>`, with nothing to declare. The
`build/vite/vendor-overrides.ts` plugin intercepts the *resolved* path, which
also catches the relative imports upstream files make between themselves.

Two guardrails:

- if the upstream file disappears or is renamed, the build **fails**: an orphan
  override would silently stop applying;
- each override declares, in a comment, the hash of the file it replaces
  (`@upstream-sha256 …`). If the original changes upstream, the build **warns**
  and gives the new hash: the copy may be missing a fix and needs a review. Line
  endings are normalised, so that a Windows clone and the Linux clone of the
  Docker build produce the same hash.

Current overrides:

| File | Why |
|---|---|
| `ui/theme/themes.ts` | shared theme of the `c-*` kit, realigned on our palette |
| `ui/c-card`, `c-input-text`, `c-select` (`*.theme.ts`) | hard-coded colours, including IT-Tools' green |
| `ui/c-table/c-table.vue` | neutral greys hard-coded in the template, visible in dark mode |
| `tools/user-agent-parser/user-agent-result-cards.vue` | `success` (green) badges used as a plain accent → `primary` |

### Design page

Under `npm run dev`, `/_design` shows the accents, the ten neutrals, the radius
tiers, the type scale and the spacing rhythm, then the naive-ui components and
IT-Tools' `c-*` kit demos rendered with our overrides. Switching the theme should
change everything at once. The page is absent from production builds, unless
`VITE_DEV_PAGES=true`.

### Verification in a real browser

```bash
npm run dev                                         # in one terminal
npm run screenshot -- build/scenarios/shell.json    # in another
```

`build/scripts/screenshot.mjs` drives headless Chrome: device emulation, forced
light or dark theme, a script run inside the page. For each page it reports
horizontal overflow and any console error or warning, and drops a screenshot into
`.screenshots/`. A scenario whose script returns `true` passed.
`build/scenarios/shell.json` covers the chassis: rail, collapse, drawer, tab
bar, status bar and its network counter, tool pages and their context rail, the
theme cycle, the language switch, 404. `build/scenarios/catalog.json` covers the
home page, search, the palette and its scopes, favourites, recents and usage
counts, redirects, categories and their filter, and the French translation.

Generators cover the tools themselves, re-reading their list from `vendor/` on
every run:

```bash
# do the 86 tools render? (--mobile, --dark, --base <url> as needed)
node build/scripts/scenario-all-tools.mjs && npm run screenshot -- .screenshots/all-tools.json

# does a sample compute correctly? (MD5, URL, bases, YAML, Monaco, QR…)
node build/scripts/scenario-functional.mjs && npm run screenshot -- build/scenarios/functional.json

# and on the CyberChef side? (on-demand modules, WebAssembly, binary and HTML output)
node build/scripts/scenario-cyberchef.mjs && npm run screenshot -- build/scenarios/cyberchef.json

# Recipes and Magic? (composition, cyberchef.org links, failing step, sharing…)
node build/scripts/scenario-recipes.mjs && npm run screenshot -- build/scenarios/recipes.json

# settings (theme, colour, language, data)
npm run screenshot -- build/scenarios/settings.json

# is every target on our screens at least 44 px on a touch screen?
node build/scripts/scenario-touch.mjs && npm run screenshot -- build/scenarios/touch.json
```

The generated files are committed, but the generators are their source: change
the generator, then regenerate — never the other way round.

For a full sweep, aim at the production build (`npm run build && npm run
preview`, then `--base http://localhost:5050`): the dev server reloads the page
when a file changes or when it discovers a dependency, which skews the results.
`screenshot.mjs` takes `--base` too, for the hand-written scenario files:

```bash
npm run screenshot -- build/scenarios/shell.json --base http://localhost:5050
```

Full-page captures (`fullPage: true`) enlarge the capture, not the window: the
rail and the bars, which are sticky, stay where the first screen left them.
Prefer viewport captures for anything meant to be looked at.

The images in `docs/screenshots/` come from `build/scenarios/docs.json`, run
against the production build: it prepares realistic local data (recent and
pinned tools, a saved recipe), then captures the home page, the workbench,
Magic, the phone layout and each colour theme in dark and light.

```bash
npm run screenshot -- build/scenarios/docs.json --base http://localhost:5050
```

Copy `docs-home`, `docs-recipes`, `docs-magic` and `docs-mobile` over their
counterparts; `themes.png` assembles the ten `docs-theme-*` captures, five rows
of dark and light side by side.

Known, harmless console warnings are described in
`build/scenarios/known-warnings.json`. The tool prints them with their
explanation; only new problems are marked with a "!".

### Type checking

`npm run typecheck` fails on any error in our code. `vue-tsc` also analyses
`vendor/it-tools` by following imports; the errors it finds there (about sixty)
are counted but do not fail the run, since they cannot be fixed without modifying
the upstream sources.

### Dependencies

CyberChef is the exception: its dependencies are installed inside
`vendor/cyberchef`, because its engine is built separately, with webpack, and the
application only consumes it as an already-bundled worker.

### Language

The interface ships in English and French (`src/locales/`); English is the
default. Code, comments and commit messages are in French — the project's working
language.
