import { ItemView, Keymap, WorkspaceLeaf } from 'obsidian';
import { card } from './cards.ts';
import type { PageItem } from '../page/derive.ts';
import type TxtFacetsPlugin from '../main.ts';
import { INDEX_CHANGED } from '../page-index.ts';

export const VIEW_TYPE = 'txt-facets';

// The facets view. For now every page as a card, newest first, in batches;
// filters and saved state arrive in later slices (docs/spec.md → Build order).
export class FacetsView extends ItemView {
	private plugin: TxtFacetsPlugin;
	/** The current results, and how many of them have cards. */
	private pages: PageItem[] = [];
	private shown = 0;
	/** One line per card. Not saved yet: that's the saved-state slice. */
	private compact = false;
	private listEl: HTMLElement | null = null;
	private moreEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TxtFacetsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Txt Facets';
	}

	getIcon(): string {
		return 'list-filter';
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('txt-facets');
		this.registerEvent(
			this.plugin.events.on(INDEX_CHANGED, () => this.render()),
		);
		// One click and one hover listener serve every card.
		this.registerDomEvent(this.contentEl, 'click', (evt) => this.onClick(evt));
		this.registerDomEvent(this.contentEl, 'mouseover', (evt) => this.onHover(evt));
		this.render();
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		this.listEl = this.moreEl = null;
		if (!this.plugin.indexReady) {
			root.createEl('p', { text: 'Reading notes…', cls: 'muted' });
			return;
		}
		this.pages = this.plugin.index.newest();
		this.shown = 0;

		const bar = root.createDiv({ cls: 'txt-facets-bar' });
		const n = this.pages.length;
		bar.createSpan({ text: `${n} page${n === 1 ? '' : 's'}`, cls: 'muted' });
		const toggle = bar.createEl('button', { text: 'Compact', cls: 'txt-facets-compact' });
		toggle.setAttribute('aria-pressed', String(this.compact));
		toggle.addEventListener('click', () => {
			this.compact = !this.compact;
			toggle.setAttribute('aria-pressed', String(this.compact));
			this.listEl?.toggleClass('dense', this.compact);
		});

		this.listEl = root.createEl('ul', { cls: 'result-list' });
		this.listEl.toggleClass('dense', this.compact);
		this.moreEl = root.createEl('button', { text: 'Show more', cls: 'txt-facets-more' });
		this.moreEl.addEventListener('click', () => this.showMore());
		this.showMore();
	}

	/** Cards for the next batch of results. */
	private showMore(): void {
		const batch = this.pages.slice(this.shown, this.shown + this.plugin.settings.cardsPerBatch);
		for (const page of batch) this.listEl?.appendChild(card(page));
		this.shown += batch.length;
		this.moreEl?.toggle(this.shown < this.pages.length);
	}

	/** The path on a card title under the event, if any. */
	private titlePath(evt: MouseEvent): { link: HTMLElement; path: string } | null {
		const link = (evt.target as HTMLElement).closest<HTMLElement>('a.page-card-title');
		const path = link?.getAttribute('data-path');
		return link && path ? { link, path } : null;
	}

	// A title opens its note: where the setting says, or in a new tab (or
	// split) with Ctrl/Cmd held. Bookmark chips are real links and open in
	// the browser on their own.
	private onClick(evt: MouseEvent): void {
		const hit = this.titlePath(evt);
		const file = hit ? this.app.vault.getFileByPath(hit.path) : null;
		if (!file) return;
		evt.preventDefault();
		const { openIn } = this.plugin.settings;
		const pane = Keymap.isModEvent(evt) || (openIn === 'current' ? false : openIn);
		void this.app.workspace.getLeaf(pane).openFile(file);
	}

	// Page Preview on a title, as for any internal link.
	private onHover(evt: MouseEvent): void {
		const hit = this.titlePath(evt);
		if (!hit) return;
		this.app.workspace.trigger('hover-link', {
			event: evt,
			source: VIEW_TYPE,
			hoverParent: this,
			targetEl: hit.link,
			linktext: hit.path,
			sourcePath: '',
		});
	}
}
