// How a vault note becomes a page record (docs/spec.md → Pages, Page record).
// Pure functions over the file's path, stats, cached metadata and text, so
// they run, and are tested, without Obsidian.
//
// The site's versions live in publictxt-pages: scripts/sync_content.py
// (which files are pages), scripts/dates.py, and the partials
// page-collections.html, categories.html and rating.html.

import type { CachedMetadata } from 'obsidian';
import type { TxtFacetsSettings } from './settings';

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
	TxtFacetsSettings,
	'collectionFromFolder' | 'tagsFrom' | 'categories'
>;

/** Front matter as read here: values are unknown until checked. */
type FrontMatter = Record<string, unknown>;

export const SUMMARY_WORDS = 30;

// ---- which files are pages ------------------------------------------------

// The sync step's housekeeping files, at any depth.
const SKIP_NAMES = new Set(['README.md', 'LICENSE.md', 'CONTRIBUTING.md']);

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
export function isUnpublished(fm: FrontMatter | null | undefined): boolean {
	const v = fm?.publish;
	if (typeof v === 'boolean') return !v;
	if (typeof v === 'number' || typeof v === 'string') {
		return UNPUBLISHED.has(String(v).trim().toLowerCase());
	}
	return false;
}

// ---- front matter values ----------------------------------------------------

function fmString(v: unknown): string | null {
	if (typeof v === 'string') return v.trim() || null;
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return null;
}

/** A value or a list of values, as strings. Strings are not split. */
function fmValues(v: unknown): string[] {
	const items = Array.isArray(v) ? (v as unknown[]) : [v];
	return items.flatMap((x) => {
		const s = fmString(x);
		return s ? [s] : [];
	});
}

/** Like fmValues, but a string is split on commas and spaces (`tags: a, b`). */
function fmTagList(v: unknown): string[] {
	return typeof v === 'string' ? v.split(/[,\s]+/) : fmValues(v);
}

function dedupe(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

// ---- title, collections, categories, tags, rating, bookmarks -----------------

export function deriveTitle(
	fm: FrontMatter | null | undefined,
	cache: CachedMetadata | null | undefined,
	basename: string,
): { title: string; fromH1: boolean } {
	const explicit = fmString(fm?.title);
	if (explicit) return { title: explicit, fromH1: false };
	const h1 = cache?.headings?.find((h) => h.level === 1)?.heading.trim();
	if (h1) return { title: h1, fromH1: true };
	return { title: basename, fromH1: false };
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
	fm: FrontMatter | null | undefined,
	path: string,
	hasBookmark: boolean,
	fromFolder: boolean,
): string[] {
	const raw = fromFolder ? [topFolder(path) || 'page'] : [];
	raw.push(...fmValues(fm?.collections));
	if (hasBookmark) raw.push('bookmarks');
	return dedupe(raw.map((v) => v.toLowerCase()));
}

/**
 * `categories:` then `category:`, each a value or a list, matched
 * case-insensitively. With a list, values come back in the list's spelling
 * and others are dropped; with an empty list, any value counts, lower-cased.
 */
export function deriveCategories(
	fm: FrontMatter | null | undefined,
	list: string[],
): string[] {
	const raw = [...fmValues(fm?.categories), ...fmValues(fm?.category)];
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
	fm: FrontMatter | null | undefined,
	cache: CachedMetadata | null | undefined,
	from: TxtFacetsSettings['tagsFrom'],
): string[] {
	const raw: string[] = [];
	if (from !== 'inline') raw.push(...fmTagList(fm?.tags), ...fmTagList(fm?.tag));
	if (from !== 'frontmatter') raw.push(...(cache?.tags ?? []).map((t) => t.tag));
	return dedupe(raw.map(normalizeTag));
}

/** A whole number 1–5, else 0 (unrated). */
export function deriveRating(fm: FrontMatter | null | undefined): number {
	const s = fmString(fm?.rating) ?? '';
	return /^[1-5]$/.test(s) ? Number(s) : 0;
}

const URL_RE = /^https?:\/\/\S+$/i;

/** `bookmark:` / `bookmarks:`, a value or a list, http(s) URLs only. */
export function deriveBookmarks(fm: FrontMatter | null | undefined): string[] {
	const raw = [...fmValues(fm?.bookmark), ...fmValues(fm?.bookmarks)];
	return dedupe(raw.filter((u) => URL_RE.test(u)));
}

// ---- dates (dates.py without the Git rung) -----------------------------------

// A date in a file name: `20241013-title`, `title . 20240816`,
// `2024-10-13-title`. The digit guards keep longer digit runs (IDs) out.
// No lookbehinds anywhere in this file: iOS before 16.4 can't parse them,
// and one would stop the whole plugin loading there.
const NAME_DATE_RES = [
	/(?:^|\D)(\d{4})-(\d{2})-(\d{2})(?!\d)/,
	/(?:^|\D)(\d{4})(\d{2})(\d{2})(?!\d)/,
];
// A date in the folders: `blog/2023/12/17/post.md`.
const PATH_DATE_RE = /(?:^|\/)(\d{4})\/(\d{2})\/(\d{2})\//;

/** `YYYY-MM-DD` when the parts make a real date (not 2024-02-30), else null. */
function validDate(y: string, m: string, d: string): string | null {
	const dt = new Date(Number(y), Number(m) - 1, Number(d));
	const ok =
		dt.getFullYear() === Number(y) &&
		dt.getMonth() === Number(m) - 1 &&
		dt.getDate() === Number(d);
	return ok ? `${y}-${m}-${d}` : null;
}

function matchDate(re: RegExp, s: string): string | null {
	const m = re.exec(s);
	return m ? validDate(m[1]!, m[2]!, m[3]!) : null;
}

/** `YYYY-MM-DD` from the file's name, else from the folders above it. */
export function dateFromPath(path: string): string | null {
	const name = path.slice(path.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	const stem = dot > 0 ? name.slice(0, dot) : name;
	for (const re of NAME_DATE_RES) {
		const d = matchDate(re, stem);
		if (d) return d;
	}
	return matchDate(PATH_DATE_RE, path);
}

const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');

/** RFC 3339 with the local offset, to the second, as dates.py writes it. */
export function toLocalISO(d: Date): string {
	const off = -d.getTimezoneOffset();
	const sign = off >= 0 ? '+' : '-';
	return (
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
		`T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
		`${sign}${pad(Math.trunc(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
	);
}

/** Local midnight of a `YYYY-MM-DD` date, RFC 3339. */
export function dateOnlyToISO(ymd: string): string {
	const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
	return toLocalISO(new Date(y, m - 1, d));
}

/**
 * A front matter date as the string cards and sorting read. A date-only
 * value is local midnight; anything else passes through as written, parseable
 * or not: an odd `created:` is the author's to fix, not the plugin's to hide.
 */
export function normalizeDate(v: unknown): string | null {
	if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : toLocalISO(v);
	const s = fmString(v);
	if (!s) return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	return m && validDate(m[1]!, m[2]!, m[3]!) ? dateOnlyToISO(s) : s;
}

/** Sort key for a date string; unparseable dates sort as oldest. */
export function parseTime(iso: string): number {
	const t = Date.parse(iso);
	return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export function deriveDates(
	fm: FrontMatter | null | undefined,
	path: string,
	stat: { ctime: number; mtime: number },
): { created: string; updated: string } {
	const fromPath = dateFromPath(path);
	const created =
		normalizeDate(fm?.created) ??
		normalizeDate(fm?.date) ??
		(fromPath ? dateOnlyToISO(fromPath) : toLocalISO(new Date(stat.ctime)));
	let updated =
		normalizeDate(fm?.updated) ??
		normalizeDate(fm?.lastmod) ??
		toLocalISO(new Date(stat.mtime));
	const c = Date.parse(created);
	const u = Date.parse(updated);
	if (u < c) updated = created; // never earlier than created
	return { created, updated };
}

// ---- summary -------------------------------------------------------------------

const FRONT_MATTER_RE = /^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** The note without its front matter block. */
export function stripFrontMatter(text: string): string {
	return text.replace(FRONT_MATTER_RE, '');
}

/** Remove the first ATX level-1 heading line. */
export function removeFirstH1(body: string): string {
	return body.replace(/^[ \t]{0,3}#[ \t]+[^\n]*\r?\n?/m, '');
}

/**
 * Markdown to plain text: fences, link syntax, emphasis and structural
 * markers dropped, the words kept.
 */
export function plainText(md: string): string {
	let s = md.replace(/\r\n?/g, '\n');
	s = s.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*$/gm, ''); // fence lines; code stays
	s = s.replace(/<!--[\s\S]*?-->/g, ' ');
	s = s.replace(/<[A-Za-z/][^>\n]*>/g, ' '); // HTML tags and autolinks
	s = s.replace(/!?\[\[([^\]]*?)\]\]/g, (_, t: string) => t.split('|').pop() ?? ''); // wikilinks
	s = s.replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1'); // links, images
	s = s.replace(/\[([^\]\n]*)\]\[[^\]\n]*\]/g, '$1'); // reference links
	s = s.replace(/`([^`\n]*)`/g, '$1'); // inline code
	s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, ''); // heading markers
	s = s.replace(/^[ \t]*>[ \t]?/gm, ''); // blockquotes
	s = s.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, ''); // lists, tasks
	s = s.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,}|={3,})[ \t]*$/gm, ''); // rules
	s = s.replace(/^[ \t|:-]*-{2,}[ \t|:-]*$/gm, ''); // table separators
	s = s.replace(/\*{1,3}|~~/g, ''); // emphasis
	s = s.replace(/(^|\W)_{1,3}(?=\w)/g, '$1').replace(/(\w)_{1,3}(?!\w)/g, '$1'); // _emphasis_, not snake_case
	s = s.replace(/\|/g, ' ');
	return s.replace(/\s+/g, ' ').trim();
}

/** The first `n` words of a plain-text string. */
export function firstWords(text: string, n = SUMMARY_WORDS): string {
	return text.split(' ').filter(Boolean).slice(0, n).join(' ');
}

/** The body's first words: no front matter, no title heading. */
export function deriveSummary(text: string, titleFromH1: boolean): string {
	let body = stripFrontMatter(text);
	if (titleFromH1) body = removeFirstH1(body);
	return firstWords(plainText(body));
}

// ---- the whole record -----------------------------------------------------------

export function derivePage(
	file: FileInfo,
	cache: CachedMetadata | null | undefined,
	text: string,
	opts: DeriveOptions,
): PageItem {
	const fm: FrontMatter | undefined = cache?.frontmatter;
	const { title, fromH1 } = deriveTitle(fm, cache, file.basename);
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
		categories: deriveCategories(fm, opts.categories),
		tags: deriveTags(fm, cache, opts.tagsFrom),
		rating: deriveRating(fm),
		...deriveDates(fm, file.path, file.stat),
		summary: deriveSummary(text, fromH1),
		bookmarks,
	};
}
