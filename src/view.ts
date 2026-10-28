import { ItemView, Keymap, WorkspaceLeaf } from 'obsidian';
import type TxtFacetsPlugin from './main.ts';

export const VIEW_TYPE = 'txt-facets';

// The facets view. For now a plain list of every page, newest first; cards,
// filters and state arrive in later slices (docs/spec.md → Build order).
export class FacetsView extends ItemView {
	private plugin: TxtFacetsPlugin;

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
			this.plugin.events.on('index-changed', () => this.render()),
		);
		// One listener for every title, rather than one per row.
		this.registerDomEvent(this.contentEl, 'click', (evt) => this.onClick(evt));
		this.render();
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();
		if (!this.plugin.indexReady) {
			root.createEl('p', { text: 'Reading notes…', cls: 'txt-facets-status' });
			return;
		}
		const pages = this.plugin.index.newest();
		const n = pages.length;
		root.createEl('p', {
			text: `${n} page${n === 1 ? '' : 's'}`,
			cls: 'txt-facets-status',
		});
		const list = root.createEl('ul', { cls: 'txt-facets-list' });
		for (const page of pages) {
			const li = list.createEl('li');
			li.createEl('a', {
				text: page.title,
				cls: 'txt-facets-title',
				attr: { 'data-path': page.path },
			});
			li.createSpan({ text: page.created.slice(0, 10), cls: 'txt-facets-date' });
		}
	}

	// A title opens its note: where the setting says, or in a new tab (or
	// split) with Ctrl/Cmd held.
	private onClick(evt: MouseEvent): void {
		const link = (evt.target as HTMLElement).closest('a.txt-facets-title');
		const path = link?.getAttribute('data-path');
		const file = path ? this.app.vault.getFileByPath(path) : null;
		if (!file) return;
		evt.preventDefault();
		const { openIn } = this.plugin.settings;
		const pane = Keymap.isModEvent(evt) || (openIn === 'current' ? false : openIn);
		void this.app.workspace.getLeaf(pane).openFile(file);
	}
}
