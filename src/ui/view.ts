import { debounce, ItemView, Keymap, WorkspaceLeaf } from 'obsidian';
import {
	chipCounts,
	clearBrowseState,
	countValues,
	describe,
	emptyBrowseState,
	FACETS,
	filterPages,
	press,
	sortedKeys,
	toggleInclude,
	type FacetKey,
} from '../filter.ts';
import type TxtFacetsPlugin from '../main.ts';
import { INDEX_CHANGED } from '../page-index.ts';
import { renderFilters } from './filters.ts';
import { Results } from './results.ts';

export const VIEW_TYPE = 'txt-facets';

/** Below this width the filters move above the results. */
const NARROW_PX = 640;
const TYPING_MS = 200;

// The facets view: owns the browse state, lays out the bar, results and
// filter column, and handles every click through data-* attributes.
// Saved state, rating and sort arrive in later slices (docs/spec.md).
export class FacetsView extends ItemView {
	private plugin: TxtFacetsPlugin;
	private state = emptyBrowseState();
	/** One line per card. Not saved yet: that's the saved-state slice. */
	private compact = false;
	/** Facets showing every chip, not just the first CHIP_LIMIT. */
	private expanded = new Set<FacetKey>();
	/** Chip order per facet, from totals across all pages. */
	private order = {} as Record<FacetKey, string[]>;

	private titleEl!: HTMLInputElement;
	private filtersEl!: HTMLElement;
	private results!: Results;

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
		this.build();
		this.registerEvent(this.plugin.events.on(INDEX_CHANGED, () => this.onIndexChanged()));
		// One click and one hover listener serve every card and chip.
		this.registerDomEvent(this.contentEl, 'click', (evt) => this.onClick(evt));
		this.registerDomEvent(this.contentEl, 'mouseover', (evt) => this.onHover(evt));
		// The view's width, not the window's, decides the layout in a pane.
		const observer = new ResizeObserver(() => {
			this.contentEl.toggleClass('is-narrow', this.contentEl.clientWidth < NARROW_PX);
		});
		observer.observe(this.contentEl);
		this.register(() => observer.disconnect());
		if (this.plugin.indexReady) this.onIndexChanged();
	}

	/** The parts that stay put: the bar, the results and the filter column. */
	private build(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass('txt-facets');

		const bar = root.createDiv({ cls: 'txt-facets-bar' });
		this.titleEl = bar.createEl('input', {
			type: 'search',
			cls: 'txt-facets-title-filter',
			attr: { placeholder: 'Filter by title', 'aria-label': 'Filter by title' },
		});
		const typed = debounce(() => {
			this.state.title = this.titleEl.value;
			this.run();
		}, TYPING_MS, true);
		this.titleEl.addEventListener('input', typed);

		const compact = bar.createEl('button', { text: 'Compact', cls: 'txt-facets-compact' });
		compact.setAttribute('aria-pressed', 'false');
		compact.addEventListener('click', () => {
			this.compact = !this.compact;
			compact.setAttribute('aria-pressed', String(this.compact));
			this.results.setCompact(this.compact);
		});
		bar.createEl('button', { text: 'Clear', cls: 'txt-facets-clear' })
			.addEventListener('click', () => this.clear());

		const layout = root.createDiv({ cls: 'txt-facets-layout' });
		this.results = new Results(layout.createDiv({ cls: 'txt-facets-results' }), () =>
			this.plugin.settings.cardsPerBatch,
		);
		this.filtersEl = layout.createDiv({ cls: 'txt-facets-filters' });
		this.results.setStatus('Reading notes…');
	}

	clear(): void {
		clearBrowseState(this.state);
		this.titleEl.value = '';
		this.run();
		this.titleEl.focus();
	}

	private onIndexChanged(): void {
		const totals = countValues(this.plugin.index.newest());
		for (const d of FACETS) this.order[d.key] = sortedKeys(totals[d.key]);
		this.run();
	}

	/** Filter, count and draw: after every change to the state or the index. */
	private run(): void {
		if (!this.plugin.indexReady) return;
		const pages = this.plugin.index.newest();
		const shown = filterPages(pages, this.state);
		const counts = chipCounts(pages, this.state, shown);
		renderFilters(this.filtersEl, this.state, this.order, counts, this.expanded);
		const n = shown.length;
		const parts = describe(this.state);
		this.results.setStatus(
			`${n} page${n === 1 ? '' : 's'}` + (parts.length ? ` — ${parts.join(' · ')}` : ''),
		);
		this.results.show(shown, this.state.facets.tag.inc);
	}

	private onClick(evt: MouseEvent): void {
		const el = (evt.target as HTMLElement).closest<HTMLElement>(
			'[data-path], [data-tag], [data-facet], [data-match], [data-more]',
		);
		if (!el) return;
		const { path, tag, facet, value, match, more } = el.dataset;
		if (path !== undefined) return this.openNote(path, evt);
		if (tag !== undefined) toggleInclude(this.state.facets.tag, tag);
		else if (facet && value !== undefined) {
			press(this.state.facets[facet as FacetKey], value, el.dataset.x !== undefined);
		} else if (match) {
			const f = this.state.facets[match as FacetKey];
			f.match = f.match === 'all' ? 'any' : 'all';
		} else if (more) {
			const key = more as FacetKey;
			if (!this.expanded.delete(key)) this.expanded.add(key);
		}
		this.run();
	}

	// A title opens its note: where the setting says, or in a new tab (or
	// split) with Ctrl/Cmd held. Bookmark chips are real links and open in
	// the browser on their own.
	private openNote(path: string, evt: MouseEvent): void {
		const file = this.app.vault.getFileByPath(path);
		if (!file) return;
		evt.preventDefault();
		const { openIn } = this.plugin.settings;
		const pane = Keymap.isModEvent(evt) || (openIn === 'current' ? false : openIn);
		void this.app.workspace.getLeaf(pane).openFile(file);
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
