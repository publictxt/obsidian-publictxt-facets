// The settings tab (docs/spec.md → Settings), declared rather than drawn, so
// Obsidian renders it and its settings show up in settings search. Settings
// that change which notes are pages, or what a page record holds, rebuild
// the index.

import { debounce, PluginSettingTab, type App, type SettingDefinitionItem } from 'obsidian';
import type PublicTxtFacetsPlugin from './main.ts';
import { normalizeSettings, type PublicTxtFacetsSettings } from './settings.ts';

type Key = keyof PublicTxtFacetsSettings;

/** A pause in typing before a text setting rebuilds the index. */
const TYPING_MS = 600;

/** Rebuild at once: a toggle or a dropdown. */
const REBUILD_NOW: readonly Key[] = ['collectionFromFolder', 'tagsFrom', 'useCategories', 'useRatings'];
/** Rebuild once typing pauses: the text areas. */
const REBUILD_SOON: readonly Key[] = ['excludedFolders', 'categories'];

export class PublicTxtFacetsSettingTab extends PluginSettingTab {
	plugin: PublicTxtFacetsPlugin;
	private rebuildSoon: () => void;

	constructor(app: App, plugin: PublicTxtFacetsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		// Beside the tab's name in the settings sidebar and in settings search.
		this.icon = 'list-filter';
		this.rebuildSoon = debounce(() => void plugin.buildIndex(), TYPING_MS, true);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Excluded folders',
				desc: 'One folder per line. Notes inside them are not pages.',
				control: { type: 'textarea', key: 'excludedFolders', rows: 4 },
			},
			{
				name: 'Top-level folder as a collection',
				desc: 'A page belongs to the collection named after its top-level folder (page at the root).',
				control: { type: 'toggle', key: 'collectionFromFolder' },
			},
			{
				name: 'Tags from',
				desc: 'Front matter tags, inline #tags, or both.',
				control: {
					type: 'dropdown',
					key: 'tagsFrom',
					options: {
						both: 'Front matter and inline',
						frontmatter: 'Front matter only',
						inline: 'Inline only',
					},
				},
			},
			{
				name: 'Use categories',
				desc: 'Filter by front matter category. Off: no category facet.',
				control: { type: 'toggle', key: 'useCategories' },
			},
			{
				name: 'Categories',
				desc: 'One per line, or separated by commas. Only these count, in this spelling. Empty: any value counts.',
				control: { type: 'textarea', key: 'categories', rows: 4 },
				visible: () => this.plugin.settings.useCategories,
			},
			{
				name: 'Use ratings',
				desc: 'Filter and sort by front matter rating, and show stars on cards. Off: no ratings.',
				control: { type: 'toggle', key: 'useRatings' },
			},
			{
				name: 'Open notes in',
				desc: "Where a card's title opens the note. With the modifier key held, it opens a new tab.",
				control: {
					type: 'dropdown',
					key: 'openIn',
					options: { current: 'Current tab', tab: 'New tab', split: 'Split' },
				},
			},
			{
				name: 'Cards per batch',
				desc: 'Cards shown at first, and added each time you show more.',
				control: {
					type: 'number',
					key: 'cardsPerBatch',
					min: 1,
					step: 1,
					validate: (n) => (Number.isInteger(n) && n >= 1 ? undefined : 'A whole number, 1 or more.'),
				},
			},
		];
	}

	/** The lists show as text, one entry per line. */
	getControlValue(key: string): unknown {
		const v = this.plugin.settings[key as Key];
		return Array.isArray(v) ? v.join('\n') : v;
	}

	/** Every change goes through normalizeSettings, as data.json does. */
	async setControlValue(key: string, value: unknown): Promise<void> {
		const { plugin } = this;
		plugin.settings = normalizeSettings({ ...plugin.settings, [key]: value });
		await plugin.saveSettings();
		// The categories list shows only while categories are used.
		if (key === 'useCategories') this.refreshDomState();
		if (REBUILD_NOW.includes(key as Key)) void plugin.buildIndex();
		if (REBUILD_SOON.includes(key as Key)) this.rebuildSoon();
	}
}
