// Reading the vault into page records: the Obsidian side of derive.ts.

import type { App, TFile } from 'obsidian';
import { derivePage, isPagePath, isUnpublished, type PageItem } from './page/derive.ts';
import type { PublicTxtFacetsSettings } from './settings.ts';

/** Files read at once, before giving the UI a turn. */
const READ_BATCH = 64;

/**
 * A macrotask boundary, so input and paint get a turn. cachedRead often
 * resolves from cache through microtasks alone, which never let the UI in.
 */
const yieldToEventLoop = () =>
	new Promise<void>((resolve) => window.setTimeout(resolve, 0));

/**
 * The page record for a file, or null when it isn't a page. A file that
 * can't be read is logged and skipped, so one bad note can't stop a build.
 */
export async function pageFor(
	app: App,
	file: TFile,
	settings: PublicTxtFacetsSettings,
): Promise<PageItem | null> {
	if (!isPagePath(file, settings.excludedFolders)) return null;
	const cache = app.metadataCache.getFileCache(file);
	if (isUnpublished(cache?.frontmatter ?? {})) return null;
	try {
		const text = await app.vault.cachedRead(file);
		return derivePage(file, cache, text, settings);
	} catch (err) {
		console.error(`PublicTxt Facets: could not read ${file.path}`, err);
		return null;
	}
}

/**
 * Every page in the vault, read in batches. `isCurrent` is checked after
 * each batch: once it's false a newer build has started, and this one stops
 * and returns null.
 */
export async function readAllPages(
	app: App,
	settings: PublicTxtFacetsSettings,
	isCurrent: () => boolean = () => true,
): Promise<PageItem[] | null> {
	const files = app.vault.getMarkdownFiles();
	const pages: PageItem[] = [];
	for (let i = 0; i < files.length; i += READ_BATCH) {
		const batch = files.slice(i, i + READ_BATCH);
		const read = await Promise.all(batch.map((f) => pageFor(app, f, settings)));
		if (!isCurrent()) return null;
		for (const page of read) if (page) pages.push(page);
		if (i + READ_BATCH < files.length) await yieldToEventLoop();
	}
	return isCurrent() ? pages : null;
}
