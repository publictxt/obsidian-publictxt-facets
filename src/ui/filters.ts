// The filter column: a group per chip facet, with counts, ✕ to exclude and
// the all/any toggle (publictxt-pages' facets.js filterChip and matchToggle).
// Drawn whole on every change; the view handles clicks through the data-*
// attributes set here.

import {
	chipState,
	FACETS,
	type BrowseState,
	type Counts,
	type FacetDef,
	type FacetKey,
	type FilterState,
} from '../filter.ts';

/** Chips per facet before "+N more", as on the site's lists. */
export const CHIP_LIMIT = 20;

export function renderFilters(
	el: HTMLElement,
	state: BrowseState,
	order: Record<FacetKey, string[]>,
	counts: Counts,
	expanded: Set<FacetKey>,
): void {
	el.empty();
	for (const d of FACETS) {
		const names = order[d.key];
		if (!names.length) continue; // no values at all, e.g. categories unused
		const f = state.facets[d.key];
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
