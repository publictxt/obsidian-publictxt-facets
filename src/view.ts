import { ItemView } from 'obsidian';

export const VIEW_TYPE = 'txt-facets';

// The facets view. Empty for now: filters, cards and state arrive in later
// slices (docs/spec.md → Build order).
export class FacetsView extends ItemView {
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
		const root = this.contentEl;
		root.empty();
		root.addClass('txt-facets');
		root.createEl('p', { text: 'No pages yet.', cls: 'txt-facets-empty' });
	}
}
