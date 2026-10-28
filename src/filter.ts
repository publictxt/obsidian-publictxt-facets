// Filtering pages by facets and title (docs/spec.md → Filtering). Pure, and
// a port of publictxt-pages' assets/js/facets.js: the same chip states,
// match modes and counting rules.

import type { PageItem } from './page/derive.ts';

export type FacetKey = 'collection' | 'category' | 'tag';
export type Match = 'all' | 'any';
export type ChipState = 'include' | 'exclude' | '';

/** What each chip facet reads and shows. One table, so a new facet is one row. */
export interface FacetDef {
	key: FacetKey;
	label: string;
	/** The PageItem field holding the page's values. */
	field: 'collections' | 'categories' | 'tags';
	/** Shown before each value: `#` for tags. */
	prefix: string;
	/** Match mode a facet starts in, and returns to on Clear. */
	match: Match;
}

export const FACETS: readonly FacetDef[] = [
	{ key: 'collection', label: 'Collection', field: 'collections', prefix: '', match: 'any' },
	{ key: 'category', label: 'Category', field: 'categories', prefix: '', match: 'any' },
	{ key: 'tag', label: 'Tags', field: 'tags', prefix: '#', match: 'all' },
];

/** One chip facet's state: included values, excluded values, match mode. */
export interface FilterState {
	inc: Set<string>;
	exc: Set<string>;
	match: Match;
}

/** Everything that decides which pages show. Rating and sort come later. */
export interface BrowseState {
	title: string;
	facets: Record<FacetKey, FilterState>;
}

export function emptyBrowseState(): BrowseState {
	const facets = {} as Record<FacetKey, FilterState>;
	for (const d of FACETS) facets[d.key] = { inc: new Set(), exc: new Set(), match: d.match };
	return { title: '', facets };
}

export function clearBrowseState(state: BrowseState): void {
	Object.assign(state, emptyBrowseState());
}

export function chipState(f: FilterState, value: string): ChipState {
	return f.inc.has(value) ? 'include' : f.exc.has(value) ? 'exclude' : '';
}

/**
 * A chip press. The body: set → off, off → included. The ✕: excluded → off,
 * else excluded. Never passes through the opposite state on the way to off.
 */
export function press(f: FilterState, value: string, x = false): void {
	const was = chipState(f, value);
	const next: ChipState = x ? (was === 'exclude' ? '' : 'exclude') : was ? '' : 'include';
	f.inc.delete(value);
	f.exc.delete(value);
	if (next === 'include') f.inc.add(value);
	if (next === 'exclude') f.exc.add(value);
}

/** A card's tag chip: include or clear, never exclude. */
export function toggleInclude(f: FilterState, value: string): void {
	f.exc.delete(value);
	if (f.inc.has(value)) f.inc.delete(value);
	else f.inc.add(value);
}

/**
 * An `any` facet with includes *adds* pages as more values are picked, so its
 * chips count without its own includes. An `all` facet's picks narrow, so
 * its chips count the results.
 */
export function addsPages(f: FilterState): boolean {
	return f.match === 'any' && f.inc.size > 0;
}

/** Whether a page's values pass a facet; `ownIncludes` false for addsPages counts. */
export function matches(f: FilterState, values: string[], ownIncludes = true): boolean {
	if (values.some((v) => f.exc.has(v))) return false;
	if (!ownIncludes || f.inc.size === 0) return true;
	return f.match === 'any'
		? values.some((v) => f.inc.has(v))
		: [...f.inc].every((v) => values.includes(v));
}

/**
 * Pages passing the title filter and every facet. `skipIncludesOf` leaves one
 * facet's includes out, for its addsPages counts.
 */
export function filterPages(
	pages: PageItem[],
	state: BrowseState,
	skipIncludesOf?: FacetKey,
): PageItem[] {
	const q = state.title.trim().toLowerCase();
	return pages.filter(
		(p) =>
			(!q || p.title.toLowerCase().includes(q)) &&
			FACETS.every((d) => matches(state.facets[d.key], p[d.field], d.key !== skipIncludesOf)),
	);
}

export type Counts = Record<FacetKey, Map<string, number>>;

/** How many of `pages` carry each value, per facet. */
export function countValues(pages: PageItem[]): Counts {
	const counts = {} as Counts;
	for (const d of FACETS) {
		const m = new Map<string, number>();
		for (const p of pages) for (const v of p[d.field]) m.set(v, (m.get(v) ?? 0) + 1);
		counts[d.key] = m;
	}
	return counts;
}

/**
 * Chip counts for the current state: from the results, except an addsPages
 * facet, which counts from the pages its own includes would let through.
 */
export function chipCounts(pages: PageItem[], state: BrowseState, results: PageItem[]): Counts {
	const fromResults = countValues(results);
	for (const d of FACETS) {
		if (addsPages(state.facets[d.key])) {
			fromResults[d.key] = countValues(filterPages(pages, state, d.key))[d.key];
		}
	}
	return fromResults;
}

/** Chip order: count descending, then name, so chips don't jump around. */
export function sortedKeys(counts: Map<string, number>): string[] {
	return [...counts.keys()].sort(
		(a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b),
	);
}

/** The status line's filter parts: "“net”", "#a · #b", "#a or #b", "not #c". */
export function describe(state: BrowseState): string[] {
	const out: string[] = [];
	if (state.title.trim()) out.push(`“${state.title.trim()}”`);
	for (const d of FACETS) {
		const f = state.facets[d.key];
		const inc = [...f.inc].map((v) => d.prefix + v).join(f.match === 'any' ? ' or ' : ' · ');
		if (inc) out.push(inc);
		for (const v of f.exc) out.push('not ' + d.prefix + v);
	}
	return out;
}
