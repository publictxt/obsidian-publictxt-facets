// How a vault note becomes a page record (docs/spec.md → Pages, Page record):
// which files are pages, and each field's rule. Dates are in dates.ts, the
// summary in plain-text.ts.
//
// Everything in src/page/ is pure: no Obsidian runtime imports, so it runs,
// and is tested, under plain Node. The site's versions live in
// publictxt-pages: scripts/sync_content.py (which files are pages), and the
// partials page-collections.html, categories.html and rating.html.

import type { CachedMetadata } from 'obsidian';
import type { TagsFrom, PublicTxtFacetsSettings } from '../settings.ts';
import { deriveDates } from './dates.ts';
import { fmString, fmTagList, fmValues, type FrontMatter } from './front-matter.ts';
import { deriveSummary } from './plain-text.ts';

export interface PageItem {
	path: string;
	title: string;
	collections: string[];
	categories: string[];
	tags: string[];
	/** 1–5; 0 is unrated. */
	rating: number;
	created: string;
	updated: string;
	summary: string;
	bookmarks: string[];
}

/** The parts of a TFile the rules read. */
export interface FileInfo {
	path: string;
	name: string;
	basename: string;
	extension: string;
	stat: { ctime: number; mtime: number };
}

export type DeriveOptions = Pick<
	PublicTxtFacetsSettings,
	'collectionFromFolder' | 'tagsFrom' | 'useCategories' | 'categories' | 'useRatings'
>;

// ---- which files are pages ------------------------------------------------

// The sync step's housekeeping files, at any depth.
const SKIP_NAMES = new Set(['README.md', 'LICENSE.md', 'CONTRIBUTING.md']);

/** A folder's index page (Hugo's section page). */
const INDEX_NAME = '_index.md';

// `publish:` values that keep a page off the site. YAML may hand these over
// as a boolean or a number.
const UNPUBLISHED = new Set(['off', 'false', 'no', '0']);

/** Trim a folder setting to a clean vault-relative path. */
export function normalizeFolder(raw: string): string {
	return raw
		.trim()
		.replace(/\\/g, '/')
		.replace(/^(?:\.\/)+/, '')
		.replace(/^\/+|\/+$/g, '');
}

/** True when `path` is, or is inside, one of the excluded folders. */
export function isExcluded(path: string, excludedFolders: string[]): boolean {
	return excludedFolders.some((raw) => {
		const folder = normalizeFolder(raw);
		return folder !== '' && (path === folder || path.startsWith(folder + '/'));
	});
}

/** Path rules: Markdown, not housekeeping, not in an excluded folder. */
export function isPagePath(
	file: Pick<FileInfo, 'path' | 'name' | 'extension'>,
	excludedFolders: string[],
): boolean {
	return (
		file.extension.toLowerCase() === 'md' &&
		!SKIP_NAMES.has(file.name) &&
		!isExcluded(file.path, excludedFolders)
	);
}

/** Front matter rule: `publish: off` (or false, no, 0) hides a page. */
export function isUnpublished(fm: FrontMatter): boolean {
	const v = fm.publish;
	if (typeof v === 'boolean') return !v;
	if (typeof v === 'number' || typeof v === 'string') {
		return UNPUBLISHED.has(String(v).trim().toLowerCase());
	}
	return false;
}

function dedupe(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

// ---- title, collections, categories, tags, rating, bookmarks -----------------

/**
 * The title when there's no `title:` and no H1, as the site's sync step
 * makes it: the file name with `-` and `_` as spaces; a folder index takes
 * its folder's name, with `-` as spaces. The root index has no folder, so
 * it falls back to its file name ("index").
 */
export function fallbackTitle(file: Pick<FileInfo, 'path' | 'name' | 'basename'>): string {
	const fromName = file.basename.replace(/[-_]/g, ' ').trim();
	if (file.name !== INDEX_NAME) return fromName;
	const parts = file.path.split('/');
	const folder = parts.length > 1 ? parts[parts.length - 2] : '';
	return folder ? folder.replace(/-/g, ' ') : fromName;
}

export function deriveTitle(
	fm: FrontMatter,
	cache: CachedMetadata | null | undefined,
	file: Pick<FileInfo, 'path' | 'name' | 'basename'>,
): { title: string; fromH1: boolean } {
	const explicit = fmString(fm.title);
	if (explicit) return { title: explicit, fromH1: false };
	const h1 = cache?.headings?.find((h) => h.level === 1)?.heading.trim();
	if (h1) return { title: h1, fromH1: true };
	return { title: fallbackTitle(file), fromH1: false };
}

/** The top-level folder, `''` at the vault root. */
export function topFolder(path: string): string {
	const i = path.indexOf('/');
	return i === -1 ? '' : path.slice(0, i);
}

/**
 * Top-level folder (`page` at root, when the setting is on), each
 * `collections:` value, and `bookmarks` for a page with a bookmark URL.
 * Lower-case, deduped.
 */
export function deriveCollections(
	fm: FrontMatter,
	path: string,
	hasBookmark: boolean,
	fromFolder: boolean,
): string[] {
	const raw = fromFolder ? [topFolder(path) || 'page'] : [];
	raw.push(...fmValues(fm.collections));
	if (hasBookmark) raw.push('bookmarks');
	return dedupe(raw.map((v) => v.toLowerCase()));
}

/**
 * `categories:` then `category:`, each a value or a list, matched
 * case-insensitively. With a list, values come back in the list's spelling
 * and others are dropped; with an empty list, any value counts, lower-cased.
 */
export function deriveCategories(
	fm: FrontMatter,
	list: string[],
): string[] {
	const raw = [...fmValues(fm.categories), ...fmValues(fm.category)];
	return dedupe(
		raw.map((v) => {
			const lower = v.toLowerCase();
			if (!list.length) return lower;
			return list.find((c) => c.toLowerCase() === lower) ?? '';
		}),
	);
}

export function normalizeTag(raw: string): string {
	return raw.trim().replace(/^#+/, '').toLowerCase();
}

/**
 * Front matter `tags` (and `tag`, which Obsidian also reads), then inline
 * `#tags` from the metadata cache, as the setting allows. Lower-case, no
 * `#`, deduped in first-appearance order. Nested tags stay whole (`a/b`).
 */
export function deriveTags(
	fm: FrontMatter,
	cache: CachedMetadata | null | undefined,
	from: TagsFrom,
): string[] {
	const raw: string[] = [];
	if (from !== 'inline') raw.push(...fmTagList(fm.tags), ...fmTagList(fm.tag));
	if (from !== 'frontmatter') raw.push(...(cache?.tags ?? []).map((t) => t.tag));
	return dedupe(raw.map(normalizeTag));
}

/** A whole number 1–5, else 0 (unrated). */
export function deriveRating(fm: FrontMatter): number {
	const s = fmString(fm.rating) ?? '';
	return /^[1-5]$/.test(s) ? Number(s) : 0;
}

const URL_RE = /^https?:\/\/\S+$/i;

/** `bookmark:` / `bookmarks:`, a value or a list, http(s) URLs only. */
export function deriveBookmarks(fm: FrontMatter): string[] {
	const raw = [...fmValues(fm.bookmark), ...fmValues(fm.bookmarks)];
	return dedupe(raw.filter((u) => URL_RE.test(u)));
}

// ---- the whole record -----------------------------------------------------------

export function derivePage(
	file: FileInfo,
	cache: CachedMetadata | null | undefined,
	text: string,
	opts: DeriveOptions,
): PageItem {
	const fm: FrontMatter = cache?.frontmatter ?? {};
	const { title, fromH1 } = deriveTitle(fm, cache, file);
	const bookmarks = deriveBookmarks(fm);
	return {
		path: file.path,
		title,
		collections: deriveCollections(
			fm,
			file.path,
			bookmarks.length > 0,
			opts.collectionFromFolder,
		),
		categories: opts.useCategories ? deriveCategories(fm, opts.categories) : [],
		tags: deriveTags(fm, cache, opts.tagsFrom),
		rating: opts.useRatings ? deriveRating(fm) : 0,
		...deriveDates(fm, file.path, file.stat),
		summary: deriveSummary(text, fromH1),
		bookmarks,
	};
}
