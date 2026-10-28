// The commands (docs/naming.md → Commands; the ids are stable). Those that
// start from a note open or focus the view and replace its browse state,
// keeping the sort.

import { tagAtCursor } from './cursor-tag.ts';
import type { FacetKey } from './filter.ts';
import type PublicTxtFacetsPlugin from './main.ts';
import { FacetsView, VIEW_TYPE } from './ui/view.ts';

async function filterFrom(
	plugin: PublicTxtFacetsPlugin,
	inc: Partial<Record<FacetKey, string[]>>,
): Promise<void> {
	(await plugin.openView())?.filterBy(inc);
}

export function registerCommands(plugin: PublicTxtFacetsPlugin): void {
	const { app } = plugin;

	plugin.addCommand({
		id: 'open',
		name: 'Open',
		callback: () => void plugin.openView(),
	});

	plugin.addCommand({
		id: 'filter-tag-under-cursor',
		name: 'Filter by this tag',
		editorCheckCallback: (checking, editor, ctx) => {
			if (!ctx.file) return false;
			const cursor = editor.getCursor();
			const tag = tagAtCursor(
				app.metadataCache.getFileCache(ctx.file),
				{ line: cursor.line, ch: cursor.ch, offset: editor.posToOffset(cursor) },
				(n) => editor.getLine(n),
			);
			if (!tag) return false;
			if (!checking) void filterFrom(plugin, { tag: [tag] });
			return true;
		},
	});

	// Offered only for a page: a note that's excluded or `publish: off`
	// isn't in the index. Its tags match all, as the tag facet does.
	plugin.addCommand({
		id: 'like-this',
		name: 'Show pages like this one',
		checkCallback: (checking) => {
			const file = app.workspace.getActiveFile();
			const page = file && plugin.index.get(file.path);
			if (!page) return false;
			if (!checking) void filterFrom(plugin, { collection: page.collections, tag: page.tags });
			return true;
		},
	});

	plugin.addCommand({
		id: 'clear',
		name: 'Clear',
		checkCallback: (checking) => {
			const view = app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
			if (!(view instanceof FacetsView)) return false;
			if (!checking) view.clear();
			return true;
		},
	});
}
