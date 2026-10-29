# PublicTxt Facets — working notes

An Obsidian plugin for browsing a vault by facets, sharing the concepts of
[PublicTxt-Pages](https://github.com/publictxt/publictxt-pages). Rewritten from
`obsidian-search-facets-archived`, slice by slice.

## Docs

Read before changing behaviour or names; keep them in step in the same change.

- `docs/intent.md`: why, decisions, open questions
- `docs/spec.md`: what it does, and the build order
- `docs/naming.md`: names, ids and vocabulary. Plugin id, view type and command ids are
  released (1.0.0): never rename them.

The site's rules, which the page rules follow, are in the Pages repo: `docs/SPEC.md`,
`scripts/sync_content.py`, `scripts/dates.py`, `assets/js/facets.js`, `assets/js/cards.js`.

## Layout

```txt
src/
  main.ts         plugin lifecycle: settings, view, ribbon, index build, live updates
  settings.ts     settings types, defaults, normalizeSettings()
  settings-tab.ts the settings tab; what rebuilds the index
  commands.ts     the commands (ids in docs/naming.md)
  cursor-tag.ts   the tag under the editor cursor. Pure
  page/           how a note becomes a page record. Pure: no Obsidian runtime imports
    derive.ts       which files are pages, each field's rule, derivePage()
    dates.ts        the created/updated ladder
    front-matter.ts reading YAML values
    plain-text.ts   Markdown → plain text, summary
  indexer.ts      reads the vault into page records (the Obsidian side of page/)
  page-index.ts   page records by path, sorted() with cached date keys
  sort.ts         the sort vocabulary (SORTS), normaliseSort/parseSort. Pure
  filter.ts       BrowseState (and its JSON), facet table (FACETS), chip states, all/any, rating,
                  counts. Pure
  ui/             the view and its parts (Obsidian DOM)
    view.ts         the view: BrowseState, saved state, layout, one delegated click handler
    filters.ts      the filter column
    results.ts      status line, cards in batches, Show more
    cards.ts        the page card
tests/            node:test, one file per module; helpers/fake-cache.ts stands in for MetadataCache
  view.test.ts    smoke test: the real view in happy-dom, Obsidian stubbed (helpers/obsidian-stub.ts),
                  opened through open() as Obsidian does. Extend it when the view gains behaviour
scripts/deploy.mjs
```

## Commands

```sh
npm run dev       # rebuild main.js on change
npm run build     # type-check (src and tests) and minified build
npm test          # node --test; needs Node 22.18+ (runs TypeScript directly)
npm run lint
npm run deploy [-- <vault>]   # build, copy into the test vault (../../test-vaults/txt-cpy)
```

Run test, build and lint before committing. CI runs all three on Node 24.

## Releasing

Prepare on a `release/x.y.z` branch (README, docs) and merge it. Then, on `master`:

```sh
npm version x.y.z   # package.json, manifest.json, versions.json; commits and tags x.y.z (no "v")
git push && git push --tags
```

The tag runs `release.yml`: build, test, lint, then a **draft** GitHub release with `main.js`,
`manifest.json` and `styles.css`. Publish the draft by hand. The community directory
(community.obsidian.md) reads `manifest.json` from `master` and reviews every version
automatically; fixes ship as a new patch version, never by moving a tag. Bump `minAppVersion`
first if the release needs newer APIs; `version-bump.mjs` copies it into `versions.json`.

## Conventions

- Relative imports carry `.ts` extensions, so tests can load modules that import each
  other under Node.
- No regex lookbehinds: iOS before 16.4 can't parse them, and one stops the plugin loading.
- Build DOM with `createEl`/`createDiv`, never `innerHTML`: vault text is never markup.
- Delegate events: one listener on the view, `data-*` attributes on the elements.
- Don't name view methods after Obsidian's lifecycle (`open`, `close`, `load`, `unload`,
  `onload`, …): some, like `View.open`, aren't in `obsidian.d.ts`, so TypeScript won't
  warn, and the view silently never opens. `tests/view.test.ts` catches this one.
- Every CSS rule is scoped under `.publictxt-facets`; class names follow the site's `main.css`.
- Code style: tabs, single quotes; match the file you're in.
- Lint config allows no inline disables; change `eslint.config.mts` with a reason instead.

## Working style

- One branch per slice or refactor (`feat/…`, `refactor/…`), a commit per chunk, merged
  with `--no-ff`.
- Thin vertical slices, each usable in the test vault before the next.
- Flag design tensions and gaps; don't implement around them silently. Confirm before
  departing from the spec.

## Obsidian rules that apply

- Register everything that needs cleanup with `this.register*`, so unload is clean.
- No network calls; read only the vault; never write to it.
- `isDesktopOnly` is false: no Node or Electron APIs in `src/`.
- Keep `minAppVersion` accurate: lint's `no-unsupported-api` checks it.
- Sentence case for UI text.
