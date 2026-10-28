// The settings tab (docs/spec.md → Settings). Settings that change which
// notes are pages, or what a page record holds, rebuild the index.

import { debounce, PluginSettingTab, Setting, type App } from 'obsidian';
import type PublicTxtFacetsPlugin from './main.ts';
import type { OpenIn, TagsFrom } from './settings.ts';

/** A pause in typing before a text setting rebuilds the index. */
const TYPING_MS = 600;

const TAGS_FROM_LABELS: Record<TagsFrom, string> = {
	both: 'Front matter and inline',
	frontmatter: 'Front matter only',
	inline: 'Inline only',
};

const OPEN_IN_LABELS: Record<OpenIn, string> = {
	current: 'Current tab',
	tab: 'New tab',
	split: 'Split',
};

/** One entry per line; blank lines dropped. */
const lines = (value: string) =>
	value
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter(Boolean);

export class PublicTxtFacetsSettingTab extends PluginSettingTab {
	plugin: PublicTxtFacetsPlugin;

	constructor(app: App, plugin: PublicTxtFacetsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl, plugin } = this;
		const { settings } = plugin;
		containerEl.empty();

		// Text areas rebuild once typing pauses, not on every keystroke.
		const rebuildSoon = debounce(() => void plugin.buildIndex(), TYPING_MS, true);
		const save = async (rebuild: 'now' | 'soon' | 'no') => {
			await plugin.saveSettings();
			if (rebuild === 'now') void plugin.buildIndex();
			if (rebuild === 'soon') rebuildSoon();
		};

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('One folder per line. Notes inside them are not pages.')
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text.setValue(settings.excludedFolders.join('\n')).onChange(async (value) => {
					settings.excludedFolders = lines(value);
					await save('soon');
				});
			});

		new Setting(containerEl)
			.setName('Top-level folder as a collection')
			.setDesc('A page belongs to the collection named after its top-level folder (page at the root).')
			.addToggle((toggle) =>
				toggle.setValue(settings.collectionFromFolder).onChange(async (value) => {
					settings.collectionFromFolder = value;
					await save('now');
				}),
			);

		new Setting(containerEl)
			.setName('Tags from')
			.setDesc('Front matter tags, inline #tags, or both.')
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(TAGS_FROM_LABELS)) {
					dropdown.addOption(value, label);
				}
				dropdown.setValue(settings.tagsFrom).onChange(async (value) => {
					settings.tagsFrom = value as TagsFrom;
					await save('now');
				});
			});

		new Setting(containerEl)
			.setName('Categories')
			.setDesc(
				'One per line, or separated by commas. Only these count, in this spelling. Empty: any value counts.',
			)
			.addTextArea((text) => {
				text.inputEl.rows = 4;
				text.setValue(settings.categories.join('\n')).onChange(async (value) => {
					settings.categories = lines(value.replace(/,/g, '\n'));
					await save('soon');
				});
			});

		new Setting(containerEl)
			.setName('Open notes in')
			.setDesc("Where a card's title opens the note. With the modifier key held, it opens a new tab.")
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(OPEN_IN_LABELS)) {
					dropdown.addOption(value, label);
				}
				dropdown.setValue(settings.openIn).onChange(async (value) => {
					settings.openIn = value as OpenIn;
					await save('no');
				});
			});

		new Setting(containerEl)
			.setName('Cards per batch')
			.setDesc('Cards shown at first, and added each time you show more.')
			.addText((text) => {
				text.inputEl.type = 'number';
				text.inputEl.min = '1';
				text.setValue(String(settings.cardsPerBatch)).onChange(async (value) => {
					const n = Number.parseInt(value, 10);
					if (!Number.isInteger(n) || n < 1) return;
					settings.cardsPerBatch = n;
					await save('no');
				});
			});
	}
}
