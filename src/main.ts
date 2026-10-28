import { Plugin, WorkspaceLeaf } from 'obsidian';
import { normalizeSettings, TxtFacetsSettings } from './settings.ts';
import { FacetsView, VIEW_TYPE } from './view.ts';

export default class TxtFacetsPlugin extends Plugin {
	settings!: TxtFacetsSettings;

	async onload() {
		this.settings = normalizeSettings(await this.loadData());

		this.registerView(VIEW_TYPE, (leaf) => new FacetsView(leaf));

		this.addRibbonIcon('list-filter', 'Open facets', () => {
			void this.openView();
		});
		this.addCommand({
			id: 'open',
			name: 'Open',
			callback: () => void this.openView(),
		});
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
