// The vault's page records, kept by path. Pure: indexer.ts fills it from
// Obsidian, the view reads it.

import { parseTime } from './page/dates.ts';
import type { PageItem } from './page/derive.ts';

/** The plugin's event when the index's contents change (plugin.events). */
export const INDEX_CHANGED = 'index-changed';

export class PageIndex {
	private pages = new Map<string, PageItem>();
	/** `created` as a number, parsed once per put rather than on every sort. */
	private createdMs = new Map<string, number>();

	get size(): number {
		return this.pages.size;
	}

	get(path: string): PageItem | undefined {
		return this.pages.get(path);
	}

	/** Add or replace a page. */
	put(page: PageItem): void {
		this.pages.set(page.path, page);
		this.createdMs.set(page.path, parseTime(page.created));
	}

	/** Remove a page; false when there was none at `path`. */
	remove(path: string): boolean {
		this.createdMs.delete(path);
		return this.pages.delete(path);
	}

	/** Swap in a whole new set of pages. */
	replaceAll(pages: Iterable<PageItem>): void {
		this.pages.clear();
		this.createdMs.clear();
		for (const page of pages) this.put(page);
	}

	/** Every page, newest first: `created` descending, then title. */
	newest(): PageItem[] {
		const ms = (p: PageItem) => this.createdMs.get(p.path) ?? Number.NEGATIVE_INFINITY;
		return [...this.pages.values()].sort(
			(a, b) => ms(b) - ms(a) || a.title.localeCompare(b.title),
		);
	}
}
