# Txt Facets

An Obsidian plugin for browsing a vault by facets: collection, category, tag and rating chips
with live counts, a sort menu and page cards. It shares the concepts of
[PublicTxt-Pages](https://github.com/publictxt/publictxt-pages)' browse lists and search, and
works in any vault.

Early development; the view is empty for now. Design notes are in `docs/`: `intent.md` (why),
`spec.md` (what), and `naming.md` (names and vocabulary).

## Development

```sh
npm install
npm run dev               # rebuild main.js on change
npm run build             # type-check and minified build
npm run lint
npm run deploy [-- <vault>]   # build and copy into <vault>/.obsidian/plugins/txt-facets/
```

`deploy` defaults to the test vault at `../../test-vaults/txt-cpy`.

## License

GPL-3.0. See `LICENSE`.
