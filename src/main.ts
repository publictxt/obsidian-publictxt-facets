import { Events, Plugin, WorkspaceLeaf } from 'obsidian';
import { readAllPages } from './indexer.ts';
import { INDEX_CHANGED, PageIndex } from './page-index.ts';
import { normalizeSettings, type TxtFacetsSettings } from './settings.ts';
import { FacetsView, VIEW_TYPE } from './ui/view.ts';

export default class TxtFacetsPlugin extends Plugin {
	settings!: TxtFacetsSettings;
	index = new PageIndex();
	indexReady = false;
	/** Triggers INDEX_CHANGED whenever the index's contents change. */
	events = new Events();

	async onload() {
		this.settings = normalizeSettings(await this.loadData());

		this.registerView(VIEW_TYPE, (leaf) => new FacetsView(leaf, this));
		// Lists the view under Settings → Page preview; previews need Ctrl/Cmd.
		this.registerHoverLinkSource(VIEW_TYPE, {
			display: 'Txt Facets',
			defaultMod: true,
		});

		this.addRibbonIcon('list-filter', 'Open facets', () => {
			void this.openView();
		});
		this.addCommand({
			id: 'open',
			name: 'Open',
			callback: () => void this.openView(),
		});

		// After layout, so the vault's files and metadata cache are loaded
		// and startup isn't held up.
		this.app.workspace.onLayoutReady(() => void this.buildIndex());
	}

	async buildIndex(): Promise<void> {
		this.index.replaceAll(await readAllPages(this.app, this.settings));
		this.indexReady = true;
		this.events.trigger(INDEX_CHANGED);
	}

	// One view, reused: focus an open one, else open it in a new tab.
	async openView(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null =
			workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
	}
}
