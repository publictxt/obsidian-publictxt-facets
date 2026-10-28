// The results: a status line, then cards in batches with "Show more".

import type { PageItem } from '../page/derive.ts';
import { card } from './cards.ts';

export class Results {
	private statusEl: HTMLElement;
	private listEl: HTMLElement;
	private moreEl: HTMLElement;
	private pages: PageItem[] = [];
	private shown = 0;
	private activeTags = new Set<string>();
	private batchSize: () => number;

	/** `batchSize` is read on each batch, so a settings change applies at once. */
	constructor(parent: HTMLElement, batchSize: () => number) {
		this.batchSize = batchSize;
		this.statusEl = parent.createEl('p', { cls: 'publictxt-facets-status' });
		this.listEl = parent.createEl('ul', { cls: 'result-list' });
		this.moreEl = parent.createEl('button', { text: 'Show more', cls: 'publictxt-facets-more' });
		this.moreEl.addEventListener('click', () => this.showMore());
		this.moreEl.hide();
	}

	setStatus(text: string): void {
		this.statusEl.setText(text);
	}

	/**
	 * Replace the results; `activeTags` marks card tag chips as included.
	 * With `keepShown`, as many cards as were showing are drawn again, so an
	 * index update doesn't undo "Show more".
	 */
	show(pages: PageItem[], activeTags: Set<string>, keepShown = false): void {
		const wanted = keepShown ? Math.max(this.shown, this.batchSize()) : this.batchSize();
		this.pages = pages;
		this.activeTags = activeTags;
		this.shown = 0;
		this.listEl.empty();
		this.append(wanted);
	}

	setCompact(on: boolean): void {
		this.listEl.toggleClass('dense', on);
	}

	private showMore(): void {
		this.append(this.batchSize());
	}

	private append(count: number): void {
		const batch = this.pages.slice(this.shown, this.shown + count);
		for (const page of batch) this.listEl.appendChild(card(page, this.activeTags));
		this.shown += batch.length;
		this.moreEl.toggle(this.shown < this.pages.length);
	}
}
