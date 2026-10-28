# Txt Facets — Naming

The names this repo uses, once, so code, docs and UI agree. The archived repo
(`obsidian-search-facets-archived`, shipped as `publictxt-search` 0.1.0) used other names; the
mapping is at the end so ported code can be renamed mechanically.

## Plugin identity

| Thing | Name | Notes |
|---|---|---|
| Repo | `obsidian-txt-facets` | |
| Plugin `id` (`manifest.json`) | `txt-facets` | Stable forever once released. Must match the vault folder `.obsidian/plugins/txt-facets/`. Obsidian rejects ids containing `obsidian`. |
| Display `name` | Txt Facets | Shown in **Settings → Community plugins** and as the prefix of every command. |
| `package.json` `name` | `txt-facets` | Same as the id; the package is private. |
| View type | `txt-facets` | `VIEW_TYPE` in code. Also the hover-link source id. |
| View display text | Txt Facets | Tab title. |
| CSS root class | `.txt-facets` | Every rule in `styles.css` is scoped under it. |

## Commands

Obsidian shows commands as `<plugin name>: <command name>`, so command names don't repeat the
plugin name. (The archive's "Open PublicTxt search" showed up as
"PublicTxt Search: Open PublicTxt search".)

| id | Name in palette |
|---|---|
| `open` | Txt Facets: Open |
| `filter-tag-under-cursor` | Txt Facets: Filter by tag under cursor |
| `like-this` | Txt Facets: Show pages like this one |
| `clear` | Txt Facets: Clear |

Command ids are stable API, like the plugin id: once released, don't rename them.

## Code identifiers

| Archive | Here | Why |
|---|---|---|
| `PublicTxtSearchPlugin` | `TxtFacetsPlugin` | plugin name |
| `PublicTxtSearchSettings` | `TxtFacetsSettings` | plugin name |
| `PublicTxtSearchSettingTab` | `TxtFacetsSettingTab` | plugin name |
| `SearchView` | `FacetsView` | facets are the point; "search" alone undersells filter-only browsing |
| `VIEW_TYPE = "publictxt-search"` | `VIEW_TYPE = "txt-facets"` | |
| `.publictxt-search` | `.txt-facets` | CSS scope |
| `SearchState` | `BrowseState` | the whole view's state; there's no search to start with |
| (per-facet `{ inc, exc, match }`) | `FilterState` | one chip facet's state |

Unchanged: `PageItem`, `PageIndex`, `derive*`, `card`, `excerpt`. They name
concepts, not the product.

## Vocabulary

Words that mean one thing in this repo. They follow the [PublicTxt-Pages](https://github.com/publictxt/publictxt-pages) site's vocabulary,
because that is the model the plugin reproduces.

| Term | Meaning |
|---|---|
| **page** | A Markdown note that the plugin indexes. Not every `.md` file is one: notes in excluded folders and repo housekeeping files (`README*`, `LICENSE*`, …) aren't pages. |
| **page record** | The derived data for one page: `PageItem` (title, collections, section, categories, tags, rating, dates, summary, bookmarks). |
| **derive / derivation** | Working out a page record from the file, its front matter and Obsidian's metadata cache, following fixed rules. The rules live in `derive.ts`. |
| **collection** | What kind of page it is. Several per page: its top-level folder (an option; `page` at root), each `collections:` value, and `bookmarks` if it has a bookmark URL. Lower-case. Replaces the archive's **type**. |
| **section** | A page's top-level folder (`""` at root). Informational. |
| **category** | A broad subject (`category:` / `categories:`). Limited to the settings list, or any value when the list is empty. |
| **tag** | Lowercased, no `#`. Front matter tags, inline `#hashtags`, or both (setting), as one set. |
| **rating** | Front matter `rating:` 1–5, or unrated. Filtered as a minimum; sorted with unrated as 2.5. |
| **facet** | A dimension you filter by: collection, category, tag, rating. The first three are **chip facets**. |
| **chip** | A clickable facet value with its count. Zero-count chips are dimmed, not hidden. |
| **chip state** | `include`, `exclude` or off (`""`). The site's words; "selected" means included. |
| **match** | How a facet combines its included values: `all` (AND) or `any` (OR). Excludes always remove pages. |
| **totals** | Counts across the whole index. They set chip *order*, so chips don't jump around. |
| **counts** | Counts within the current result set. They set the number shown on each chip. |
| **sort order** | How results are ordered: `created`, `updated`, `title` or `rating`, each ascending or descending. Spelled as on the site (`"created"`, `"title desc"`); a field's natural direction is left out. Default `created` (Newest). |
| **browse state** | `BrowseState`: the title filter, each facet's includes, excludes and match mode, the rating minimum, and the sort order: everything needed to reproduce a view. Saved with the workspace. |
| **card** | One result: title, collections, dates, summary, rating, tag chips, bookmark chips. |
| **compact** | A card shown as one line: title, date, stars. A view-wide toggle. |
| **summary** | The first 30 words of a page's body. |
| **batch** | The number of cards shown before **Show more** (default 20). |
| **title filter** | The text box: keeps pages whose title contains its text, case-insensitive. Part of the search state. |
| **query / excerpt** | Reserved for text search, which isn't built (`intent.md` → *Open questions*). |
| **the site** | PublicTxt-Pages' browse lists and `/search/` page, whose concepts this plugin shares. |
| **the archive** | `obsidian-search-facets-archived`, the first implementation. |
