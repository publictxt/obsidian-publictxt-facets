import { debounce, ItemView, Keymap, WorkspaceLeaf, type Debouncer, type PaneType } from 'obsidian';
import {
	chipCounts,
	clearBrowseState,
	countValues,
	describe,
	emptyBrowseState,
	FACETS,
	filterPages,
	press,
	ratingChoices,
	ratingCounts,
	sortedKeys,
	toggleInclude,
	type FacetKey,
	type RatingFilter,
} from '../filter.ts';
import type PublicTxtFacetsPlugin from '../main.ts';
import { INDEX_CHANGED } from '../page-index.ts';
import { renderFilters } from './filters.ts';
import { SORTS } from '../sort.ts';
import { Results } from './results.ts';

export const VIEW_TYPE = 'publictxt-facets';

/** Below this width the filters move above the results. */
const NARROW_PX = 640;
const TYPING_MS = 200;

// The facets view: owns the browse state, lays out the bar, results and
// filter column, and handles every click through data-* attributes.
// Saved state arrives in a later slice (docs/spec.md).
export class FacetsView extends ItemView {
	private plugin: PublicTxtFacetsPlugin;
	private state = emptyBrowseState();
	/** One line per card. Not saved yet: that's the saved-state slice. */
	private compact = false;
	/** Facets showing every chip, not just the first CHIP_LIMIT. */
	private expanded = new Set<FacetKey>();
	/** Chip order per facet, from totals across all pages. */
	private order = {} as Record<FacetKey, string[]>;
	/** Rating chips to offer, from the ratings any page has. */
	private ratings: RatingFilter[] = [];

	private titleEl!: HTMLInputElement;
	private sortEl!: HTMLSelectElement;
	/** The title filter's pending run, cancelled when the view closes. */
	private typed: Debouncer<[], void> | null = null;
	private filtersEl!: HTMLElement;
	private results!: Results;

	constructor(leaf: WorkspaceLeaf, plugin: PublicTxtFacetsPlugin) {
		super(leaf);
		this.plugin = plugin;
		// Opening a note from here joins the tab's back/forward history.
		this.navigation = true;
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'PublicTxt Facets';
	}

	getIcon(): string {
		return 'list-filter';
	}

	async onOpen(): Promise<void> {
		this.build();
		this.registerEvent(this.plugin.events.on(INDEX_CHANGED, () => this.onIndexChanged()));
		// One click and one hover listener serve every card and chip.
		this.registerDomEvent(this.contentEl, 'click', (evt) => this.onClick(evt));
		this.registerDomEvent(this.contentEl, 'mouseover', (evt) => this.onHover(evt));
		this.registerDomEvent(this.contentEl, 'auxclick', (evt) => this.onAuxClick(evt));
		// The view's width, not the window's, decides the layout in a pane.
		const observer = new ResizeObserver(() => {
			this.contentEl.toggleClass('is-narrow', this.contentEl.clientWidth < NARROW_PX);
		});
		observer.observe(this.contentEl);
		this.register(() => observer.disconnect());
		if (this.plugin.indexReady) this.onIndexChanged();
		if (!this.state.title) this.titleEl.focus();
	}

	async onClose(): Promise<void> {
		this.typed?.cancel();
	}

	/** The parts that stay put: the bar, the results and the filter column. */
	private build(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass('publictxt-facets');

		const bar = root.createDiv({ cls: 'publictxt-facets-bar' });
		this.titleEl = bar.createEl('input', {
			type: 'search',
			cls: 'publictxt-facets-title-filter',
			attr: { placeholder: 'Filter by title', 'aria-label': 'Filter by title' },
		});
		const typed = (this.typed = debounce(() => {
			this.state.title = this.titleEl.value;
			this.run();
		}, TYPING_MS, true));
		this.titleEl.addEventListener('input', () => typed());

		this.sortEl = bar.createEl('select', {
			cls: 'dropdown publictxt-facets-sort',
			attr: { 'aria-label': 'Sort' },
		});
		for (const [value, label] of SORTS) this.sortEl.createEl('option', { value, text: label });
		this.sortEl.value = this.state.sort;
		this.sortEl.addEventListener('change', () => {
			this.state.sort = this.sortEl.value;
			this.run();
		});

		const compact = bar.createEl('button', { text: 'Compact', cls: 'publictxt-facets-compact' });
		compact.setAttribute('aria-pressed', 'false');
		compact.addEventListener('click', () => {
			this.compact = !this.compact;
			compact.setAttribute('aria-pressed', String(this.compact));
			this.results.setCompact(this.compact);
		});
		bar.createEl('button', { text: 'Clear', cls: 'publictxt-facets-clear' })
			.addEventListener('click', () => this.clear());

		const layout = root.createDiv({ cls: 'publictxt-facets-layout' });
		// aria-live: screen readers announce the new count after each change.
		const resultsEl = layout.createDiv({
			cls: 'publictxt-facets-results',
			attr: { 'aria-live': 'polite' },
		});
		this.results = new Results(resultsEl, () => this.plugin.settings.cardsPerBatch);
		this.filtersEl = layout.createDiv({ cls: 'publictxt-facets-filters' });
		this.results.setStatus('Reading notes…');
	}

	clear(): void {
		clearBrowseState(this.state);
		this.titleEl.value = '';
		this.sortEl.value = this.state.sort;
		this.run();
		this.titleEl.focus();
	}

	private onIndexChanged(): void {
		const all = this.plugin.index.all();
		const totals = countValues(all);
		for (const d of FACETS) this.order[d.key] = sortedKeys(totals[d.key]);
		this.ratings = ratingChoices(all);
		this.run();
	}

	/** Filter, count and draw: after every change to the state or the index. */
	private run(): void {
		if (!this.plugin.indexReady) return;
		const pages = this.plugin.index.sorted(this.state.sort);
		const shown = filterPages(pages, this.state);
		renderFilters(this.filtersEl, {
			state: this.state,
			order: this.order,
			counts: chipCounts(pages, this.state, shown),
			expanded: this.expanded,
			ratings: this.ratings,
			ratingCounts: ratingCounts(filterPages(pages, this.state, 'rating')),
		});
		const n = shown.length;
		const parts = describe(this.state);
		this.results.setStatus(
			`${n} page${n === 1 ? '' : 's'}` + (parts.length ? ` — ${parts.join(' · ')}` : ''),
		);
		this.results.show(shown, this.state.facets.tag.inc);
	}

	private onClick(evt: MouseEvent): void {
		const el = (evt.target as HTMLElement).closest<HTMLElement>(
			'[data-path], [data-tag], [data-facet], [data-match], [data-more], [data-rating]',
		);
		if (!el) return;
		const { path, tag, facet, value, match, more, rating } = el.dataset;
		if (path !== undefined) {
			evt.preventDefault();
			return this.openNote(path, Keymap.isModEvent(evt) || this.defaultPane());
		}
		if (tag !== undefined) toggleInclude(this.state.facets.tag, tag);
		else if (facet && value !== undefined) {
			press(this.state.facets[facet as FacetKey], value, el.dataset.x !== undefined);
		} else if (match) {
			const f = this.state.facets[match as FacetKey];
			f.match = f.match === 'all' ? 'any' : 'all';
		} else if (more) {
			const key = more as FacetKey;
			if (!this.expanded.delete(key)) this.expanded.add(key);
		} else if (rating !== undefined) {
			this.state.rating = this.state.rating === rating ? '' : (rating as RatingFilter);
		}
		this.run();
	}

	// Middle-click on a title opens a new tab, as a link would in a browser.
	private onAuxClick(evt: MouseEvent): void {
		if (evt.button !== 1) return;
		const path = (evt.target as HTMLElement).closest<HTMLElement>('a.page-card-title')?.dataset
			.path;
		if (!path) return;
		evt.preventDefault();
		this.openNote(path, 'tab');
	}

	/** Where a plain click opens a note, from the openIn setting. */
	private defaultPane(): PaneType | false {
		const { openIn } = this.plugin.settings;
		return openIn === 'current' ? false : openIn;
	}

	// A title opens its note: where the setting says, or in a new tab (or
	// split) with Ctrl/Cmd held. Opened by file, not link text, so `#`, `^`
	// and `|` in a name aren't read as link syntax. Bookmark chips are real
	// links and open in the browser on their own.
	private openNote(path: string, pane: PaneType | boolean): void {
		const file = this.app.vault.getFileByPath(path);
		if (file) void this.app.workspace.getLeaf(pane).openFile(file);
	}

	// Page Preview on a title, as for any internal link.
	private onHover(evt: MouseEvent): void {
		const link = (evt.target as HTMLElement).closest<HTMLElement>('a.page-card-title');
		const path = link?.dataset.path;
		if (!link || !path) return;
		this.app.workspace.trigger('hover-link', {
			event: evt,
			source: VIEW_TYPE,
			hoverParent: this,
			targetEl: link,
			linktext: path,
			sourcePath: '',
		});
	}
}
