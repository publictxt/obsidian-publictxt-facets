// The filter column: the rating chips, then a group per chip facet with
// counts, ✕ to exclude and the all/any toggle (publictxt-pages' facets.js
// ratingChips, filterChip and matchToggle). Drawn whole on every change; the
// view handles clicks through the data-* attributes set here.

import {
	chipState,
	FACETS,
	ratingLabel,
	UNRATED,
	type BrowseState,
	type Counts,
	type FacetDef,
	type FacetKey,
	type FilterState,
	type RatingFilter,
} from '../filter.ts';

/** Rating chips in the order they're offered. */
const RATING_ORDER: readonly RatingFilter[] = ['5', '4', '3', '2', '1', UNRATED];

/** Chips per facet before "+N more", as on the site's lists. */
export const CHIP_LIMIT = 20;

/** What the filter column draws from. */
export interface FilterColumn {
	state: BrowseState;
	/** Chip order per facet, from totals across all pages. */
	order: Record<FacetKey, string[]>;
	counts: Counts;
	/** Facets showing every chip. */
	expanded: Set<FacetKey>;
	/** Rating chips to offer; none hides the group. */
	ratings: RatingFilter[];
	ratingCounts: Map<RatingFilter, number>;
}

export function renderFilters(el: HTMLElement, col: FilterColumn): void {
	const { state, order, counts, expanded } = col;
	el.empty();
	renderRating(el, col);
	for (const d of FACETS) {
		const f = state.facets[d.key];
		// A set value no page carries (gone since it was set, or set from a
		// note that isn't a page) still gets a chip, so it can be cleared.
		const known = new Set(order[d.key]);
		const missing = [...f.inc, ...f.exc].filter((v) => !known.has(v));
		const names = [...order[d.key], ...missing];
		if (!names.length) continue; // no values at all, e.g. categories unused
		const group = el.createDiv({ cls: 'filter-group' });

		const head = group.createDiv({ cls: 'filter-group-head' });
		head.createSpan({ cls: 'filter-group-label', text: d.label });
		// The mode only matters once two values are included.
		if (f.inc.size >= 2) {
			const other = f.match === 'all' ? 'any' : 'all';
			head.createEl('button', {
				cls: 'match-toggle',
				text: `match ${f.match}`,
				attr: {
					'data-match': d.key,
					title: `Pages with ${f.match} of the selected; click for ${other}`,
				},
			});
		}

		const row = group.createDiv({ cls: 'chip-row' });
		const open = expanded.has(d.key);
		const shown = open ? names : names.filter((n, i) => i < CHIP_LIMIT || chipState(f, n));
		for (const n of shown) filterChip(row, d, f, n, counts[d.key].get(n) ?? 0);
		if (open && names.length > CHIP_LIMIT) {
			moreChip(row, d.key, 'Show fewer');
		} else if (shown.length < names.length) {
			moreChip(row, d.key, `+${names.length - shown.length} more`);
		}
	}
}

// One rating chip at a time; pressing the set one clears it.
function renderRating(el: HTMLElement, col: FilterColumn): void {
	// The set rating shows even when no page has it, so it can be cleared.
	const ratings = RATING_ORDER.filter((r) => col.ratings.includes(r) || r === col.state.rating);
	if (!ratings.length) return;
	const group = el.createDiv({ cls: 'filter-group' });
	group.createDiv({ cls: 'filter-group-head' }).createSpan({
		cls: 'filter-group-label',
		text: 'Rating',
	});
	const row = group.createDiv({ cls: 'chip-row' });
	for (const r of ratings) {
		const on = col.state.rating === r;
		const count = col.ratingCounts.get(r) ?? 0;
		const cls = ['chip', 'filter-chip'];
		if (on) cls.push('active');
		if (count === 0 && !on) cls.push('empty');
		const b = row.createEl('button', {
			cls,
			text: ratingLabel(r),
			attr: {
				'data-rating': r,
				'aria-pressed': String(on),
				title: on ? 'Click to clear' : `Click to show ${ratingLabel(r)}`,
			},
		});
		b.createSpan({ cls: 'count', text: String(count) });
	}
}

// A chip: a body button (include / clear) and a ✕ button (exclude / clear)
// inside one pill. Excluded chips drop the count, which would always be 0.
function filterChip(
	row: HTMLElement,
	d: FacetDef,
	f: FilterState,
	value: string,
	count: number,
): void {
	const on = chipState(f, value);
	const label = d.prefix + value;
	const cls = ['chip', 'filter-chip'];
	if (on === 'include') cls.push('active');
	if (on === 'exclude') cls.push('excluded');
	if (count === 0 && on !== 'exclude') cls.push('empty');
	const wrap = row.createSpan({ cls });
	const target = { 'data-facet': d.key, 'data-value': value };

	const body = wrap.createEl('button', {
		cls: 'chip-body',
		text: label,
		attr: {
			...target,
			'aria-pressed': String(on === 'include'),
			title: on ? 'Click to clear' : 'Click to include; ✕ to exclude',
		},
	});
	if (on === 'exclude') body.setAttribute('aria-label', 'not ' + label);
	else body.createSpan({ cls: 'count', text: String(count) });

	wrap.createEl('button', {
		cls: 'chip-x',
		text: '✕',
		attr: {
			...target,
			'data-x': '',
			'aria-pressed': String(on === 'exclude'),
			'aria-label': (on === 'exclude' ? 'Stop excluding ' : 'Exclude ') + label,
		},
	});
}

function moreChip(row: HTMLElement, key: FacetKey, text: string): void {
	row.createEl('button', { cls: 'chip filter-chip more', text, attr: { 'data-more': key } });
}
