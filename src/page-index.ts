// The vault's page records, kept by path. Pure: indexer.ts fills it from
// Obsidian, the view reads it.

import { parseTime } from './page/dates.ts';
import type { PageItem } from './page/derive.ts';
import { parseSort, UNRATED_SORT, type Sort } from './sort.ts';

/** The plugin's event when the index's contents change (plugin.events). */
export const INDEX_CHANGED = 'index-changed';

/** Dates as numbers, parsed once per put rather than on every sort. */
interface DateKeys {
	created: number;
	updated: number;
}

const compare = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);
const byTitle = (a: PageItem, b: PageItem) => a.title.localeCompare(b.title);
const ratingKey = (p: PageItem) => p.rating || UNRATED_SORT;

export class PageIndex {
	private pages = new Map<string, PageItem>();
	private dates = new Map<string, DateKeys>();

	get size(): number {
		return this.pages.size;
	}

	get(path: string): PageItem | undefined {
		return this.pages.get(path);
	}

	/** Add or replace a page. */
	put(page: PageItem): void {
		this.pages.set(page.path, page);
		this.dates.set(page.path, {
			created: parseTime(page.created),
			updated: parseTime(page.updated),
		});
	}

	/** Remove a page; false when there was none at `path`. */
	remove(path: string): boolean {
		this.dates.delete(path);
		return this.pages.delete(path);
	}

	/** Swap in a whole new set of pages. */
	replaceAll(pages: Iterable<PageItem>): void {
		this.pages.clear();
		this.dates.clear();
		for (const page of pages) this.put(page);
	}

	/** Every page, in no particular order. */
	all(): PageItem[] {
		return [...this.pages.values()];
	}

	/**
	 * Every page in `sort` order. Ties go to title A→Z (to path, when sorting
	 * by title), so the order is stable. Unparseable dates sort as oldest.
	 */
	sorted(sort: Sort): PageItem[] {
		const { field, dir } = parseSort(sort);
		const sign = dir === 'asc' ? 1 : -1;
		const date = (p: PageItem, f: 'created' | 'updated') =>
			this.dates.get(p.path)?.[f] ?? Number.NEGATIVE_INFINITY;
		const primary =
			field === 'title'
				? byTitle
				: field === 'rating'
					? (a: PageItem, b: PageItem) => compare(ratingKey(a), ratingKey(b))
					: (a: PageItem, b: PageItem) => compare(date(a, field), date(b, field));
		const tie = field === 'title' ? (a: PageItem, b: PageItem) => a.path.localeCompare(b.path) : byTitle;
		return this.all().sort((a, b) => sign * primary(a, b) || tie(a, b));
	}
}
