import { Events, Plugin, TFolder, WorkspaceLeaf, type TAbstractFile } from 'obsidian';
import { pageFor, readAllPages } from './indexer.ts';
import { INDEX_CHANGED, PageIndex } from './page-index.ts';
import { PublicTxtFacetsSettingTab } from './settings-tab.ts';
import { normalizeSettings, type PublicTxtFacetsSettings } from './settings.ts';
import { FacetsView, VIEW_TYPE } from './ui/view.ts';

/** A note is re-read once its events have been quiet this long. */
const UPDATE_MS = 300;
/** The view is told once per burst of updates, this long after the last. */
const TOTALS_MS = 100;

export default class PublicTxtFacetsPlugin extends Plugin {
	settings!: PublicTxtFacetsSettings;
	index = new PageIndex();
	indexReady = false;
	/** Triggers INDEX_CHANGED whenever the index's contents change. */
	events = new Events();

	/** Pending re-reads, by path. */
	private pending = new Map<string, number>();
	private totalsTimer: number | null = null;
	/** Bumped by each build, so an overtaken build stops and stays quiet. */
	private buildGen = 0;
	private building = false;
	/**
	 * Paths changed while a build was reading. The build swaps in reads that
	 * may predate the change, so these are read again after it.
	 */
	private touched = new Set<string>();

	async onload() {
		this.settings = normalizeSettings(await this.loadData());

		this.registerView(VIEW_TYPE, (leaf) => new FacetsView(leaf, this));
		// Lists the view under Settings → Page preview; previews need Ctrl/Cmd.
		this.registerHoverLinkSource(VIEW_TYPE, {
			display: 'PublicTxt Facets',
			defaultMod: true,
		});
		this.addSettingTab(new PublicTxtFacetsSettingTab(this.app, this));

		this.addRibbonIcon('list-filter', 'Open facets', () => {
			void this.openView();
		});
		this.addCommand({
			id: 'open',
			name: 'Open',
			callback: () => void this.openView(),
		});

		this.register(() => {
			for (const timer of this.pending.values()) window.clearTimeout(timer);
			if (this.totalsTimer !== null) window.clearTimeout(this.totalsTimer);
		});

		// After layout, so the vault's files and metadata cache are loaded
		// and startup isn't held up.
		this.app.workspace.onLayoutReady(() => {
			void this.buildIndex();
			// "changed" also covers new notes, once Obsidian has parsed them.
			this.registerEvent(
				this.app.metadataCache.on('changed', (file) => this.scheduleUpdate(file.path)),
			);
			this.registerEvent(this.app.vault.on('delete', (file) => this.onDeleted(file)));
			this.registerEvent(
				this.app.vault.on('rename', (file, oldPath) => this.onRenamed(file, oldPath)),
			);
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Read every page and swap them in at once, so the old index stays on
	 * screen until the new one is whole. A newer build (two quick settings
	 * changes) overtakes this one, which then stops without touching the index.
	 */
	async buildIndex(): Promise<void> {
		const gen = ++this.buildGen;
		this.building = true;
		const pages = await readAllPages(this.app, this.settings, () => gen === this.buildGen);
		if (!pages) return;
		// A note deleted or moved after it was read is gone from its path.
		this.index.replaceAll(pages.filter((p) => this.app.vault.getFileByPath(p.path)));
		this.building = false;
		this.indexReady = true;
		for (const path of this.touched) this.scheduleUpdate(path);
		this.touched.clear();
		this.events.trigger(INDEX_CHANGED);
	}

	// ---- live updates: each path debounced, then re-read or dropped ----

	private scheduleUpdate(path: string): void {
		const timer = this.pending.get(path);
		if (timer !== undefined) window.clearTimeout(timer);
		this.pending.set(
			path,
			window.setTimeout(() => {
				this.pending.delete(path);
				void this.refreshPath(path);
			}, UPDATE_MS),
		);
	}

	/**
	 * Re-read the page at `path`, or drop it when the path no longer holds
	 * one: deleted, moved, excluded or `publish: off`.
	 */
	private async refreshPath(path: string): Promise<void> {
		if (this.building) {
			this.touched.add(path);
			return;
		}
		const gen = this.buildGen;
		const file = this.app.vault.getFileByPath(path);
		const page = file ? await pageFor(this.app, file, this.settings) : null;
		if (gen !== this.buildGen) {
			this.touched.add(path);
			return;
		}
		// The note may have been deleted or moved while it was read.
		const still = page && page.path === path && this.app.vault.getFileByPath(path) === file;
		if (still) this.index.put(page);
		else if (!this.index.remove(path)) return;
		this.scheduleTotals();
	}

	/** Every indexed path under a folder. */
	private pathsUnder(folder: string): string[] {
		return this.index
			.all()
			.map((p) => p.path)
			.filter((p) => p.startsWith(folder + '/'));
	}

	private onDeleted(file: TAbstractFile): void {
		if (file instanceof TFolder) {
			for (const path of this.pathsUnder(file.path)) this.scheduleUpdate(path);
		} else {
			this.scheduleUpdate(file.path);
		}
	}

	private onRenamed(file: TAbstractFile, oldPath: string): void {
		if (file instanceof TFolder) {
			for (const path of this.pathsUnder(oldPath)) this.scheduleUpdate(path);
			for (const f of this.app.vault.getMarkdownFiles()) {
				if (f.path.startsWith(file.path + '/')) this.scheduleUpdate(f.path);
			}
		} else {
			this.scheduleUpdate(oldPath);
			this.scheduleUpdate(file.path);
		}
	}

	private scheduleTotals(): void {
		if (this.totalsTimer !== null) window.clearTimeout(this.totalsTimer);
		this.totalsTimer = window.setTimeout(() => {
			this.totalsTimer = null;
			this.events.trigger(INDEX_CHANGED);
		}, TOTALS_MS);
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
