# Txt Facets — Spec

What the plugin does. Why in `intent.md`, names in `naming.md`. The plugin never writes to the
vault.

## Pages

A **page** is any `.md` file except:

- files under an excluded folder (setting)
- housekeeping files: `README*`, `LICENSE*`, `CONTRIBUTING*`
- files with `publish: off` / `false`, which the site hides

`_index.md` files are pages.

## Page record

| Field | Rule |
|---|---|
| `title` | front matter `title`, else the first H1, else the file name |
| `collections` | top-level folder (setting; `page` at root) ∪ front matter `collections` (value or list) ∪ `bookmarks` if there's a bookmark URL. Lower-case, deduped |
| `categories` | front matter `category` / `categories` (value or list). Must be in the settings list, unless the list is empty |
| `tags` | front matter `tags` and/or inline `#tags` (setting), via Obsidian's metadata cache. Lower-case, no `#`, deduped |
| `rating` | front matter `rating`, integer 1–5; else unrated |
| `created` | front matter `created` (or `date`), else `YYYYMMDD` / `YYYY-MM-DD` in the file name or a `/YYYY/MM/DD/` path, else file ctime |
| `updated` | front matter `updated` (or `lastmod`), else file mtime; never before `created` |
| `summary` | first 30 words of the body, without front matter or the title H1 |
| `bookmarks` | front matter `bookmark` / `bookmarks`, `http(s)` URLs only |

## Filtering

`BrowseState` is the whole view's state: `{ title, collection, category, tag, rating, sort }`.
Each chip facet holds a `FilterState`: `{ inc, exc, match }`.

- **Title filter**: title contains the text, case-insensitive.
- **Chip facets** (collection, category, tag): a chip is off, included or excluded. Click the chip
  to include or clear it; click its ✕ to exclude or clear it. A page passes a facet if:
  - it has none of the excluded values, and
  - it has all of the included values (`match: all`) or any of them (`match: any`).
- **Default match**: collection `any`, category `any`, tag `all`. The all/any toggle shows once
  two or more values are included.
- **Rating**: one chip at a time, 5…1 or unrated. A number means "at least this many stars".
- All filters combine with AND.

### Counts

- **Chip order** follows totals across all pages (count descending, then name), so chips don't
  move.
- **Chip number** is the count within the results of every *other* filter, plus:
  - for an `all` facet, its own includes
  - for an `any` facet, *not* its own includes, since picking another value adds pages
- Excluded chips show no number. Zero-count chips are dimmed, not hidden.
- **Rating chip number**: pages with at least that rating, counted without the rating filter.

## Sort

`created` (Newest, default), `created asc` (Oldest), `title` (A→Z), `title desc`, `updated`
(Recently updated), `updated asc`, `rating` (Top rated), `rating asc`. Unrated pages sort as 2.5.

## View

- One `ItemView` (`txt-facets`), reused. It opens as a tab from the ribbon or the **Open**
  command.
- **Top**: title filter, sort menu, **Compact** toggle, **Clear**.
- **Status line**: `N pages — <filters>`.
- **Filters column**: one group per facet. It goes above the results when the view is narrow.
- **Cards**: title, collections, dates, rating, summary, tag chips, bookmark ↗. Compact cards are
  one line: title, date, stars.
- **Opening**: a card's title opens the note. Ctrl/Cmd-click opens it in a new tab, and hovering
  shows Page Preview.
- **Card tag chips** include or clear that tag.
- **Batches**: 20 cards, then **Show more**.
- **Saved state**: `BrowseState` and the compact setting are saved with the workspace layout.
- **Live updates**: note create, change, rename and delete update the results, debounced.

## Commands

| id | Name |
|---|---|
| `open` | Open |
| `filter-tag-under-cursor` | Filter by tag under cursor |
| `like-this` | Show pages like this one (its collections and tags, included) |
| `clear` | Clear |

## Settings

| Setting | Default |
|---|---|
| Excluded folders | `.obsidian`, `.trash`, `.git`, `media` |
| Top-level folder as a collection | on |
| Tags from | front matter and inline |
| Categories list | empty (any value) |
| Open notes in | current tab |
| Cards per batch | 20 |

## Build order

Each slice is usable in the test vault (`test-vaults/txt-cpy`) before the next starts.

1. Scaffold: names applied, an empty view opens, a deploy script.
2. Page records (`derive.ts`, with tests), plus a plain list sorted by Newest.
3. Cards and compact mode.
4. Chip facets: include/exclude, all/any, counts. Title filter.
5. Rating and the sort menu.
6. Live updates, saved state, settings tab, commands.
