// The sort vocabulary (docs/spec.md → Sort): a port of publictxt-pages'
// assets/js/sorts.js. A sort is "<field>[ asc|desc]"; the canonical form
// leaves out the field's natural direction (title A→Z, everything else
// newest or highest first).

export type SortField = 'created' | 'updated' | 'title' | 'rating';
export type Sort = string;

/** The menu, in order: value, label. */
export const SORTS: readonly (readonly [Sort, string])[] = [
	['created', 'Newest'],
	['created asc', 'Oldest'],
	['title', 'Title A→Z'],
	['title desc', 'Title Z→A'],
	['rating', 'Top rated'],
	['rating asc', 'Lowest rated'],
	['updated', 'Recently updated'],
	['updated asc', 'Least recently updated'],
];

export const DEFAULT_SORT: Sort = 'created';

const FIELDS: readonly SortField[] = ['created', 'updated', 'title', 'rating'];

/** Where unrated pages sort: mid-scale, as on the site. */
export const UNRATED_SORT = 2.5;

/** Any spelling of a sort, in canonical form; unknown fields become Newest. */
export function normaliseSort(s: string): Sort {
	const [rawField = '', rawDir] = String(s || '').trim().toLowerCase().split(/\s+/);
	const field = FIELDS.includes(rawField as SortField) ? (rawField as SortField) : 'created';
	const natural = field === 'title' ? 'asc' : 'desc';
	const dir = rawDir === 'asc' || rawDir === 'desc' ? rawDir : natural;
	return dir === natural ? field : `${field} ${dir}`;
}

/** A sort's field and explicit direction. */
export function parseSort(s: Sort): { field: SortField; dir: 'asc' | 'desc' } {
	const [field, dir] = normaliseSort(s).split(' ') as [SortField, ('asc' | 'desc')?];
	return { field, dir: dir ?? (field === 'title' ? 'asc' : 'desc') };
}
