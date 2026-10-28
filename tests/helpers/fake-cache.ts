// A stand-in for Obsidian's MetadataCache: front matter (a YAML subset), ATX
// headings and inline #tags with their positions, close enough to what
// getFileCache() returns for the notes the tests use.

import type { CachedMetadata, FrontMatterCache, HeadingCache, Pos, TagCache } from 'obsidian';
import type { FileInfo } from '../../src/page/derive.ts';

function unquote(s: string): string {
	const t = s.trim();
	const quoted = /^(["']).*\1$/.test(t);
	return quoted ? t.slice(1, -1) : t;
}

function scalar(s: string): unknown {
	const t = s.trim();
	if (t.startsWith('[') && t.endsWith(']')) {
		const inner = t.slice(1, -1).trim();
		return inner ? inner.split(',').map(unquote) : [];
	}
	if (/^-?\d+$/.test(t)) return Number(t);
	if (t === 'true') return true;
	if (t === 'false') return false;
	return unquote(t);
}

/** Scalars, inline lists `[a, b]` and block lists `- a`. */
export function parseFrontMatter(block: string): FrontMatterCache {
	const fm: FrontMatterCache = {};
	let listKey: string | null = null;
	for (const line of block.split('\n')) {
		const item = /^\s*-\s+(.*)$/.exec(line);
		if (item && listKey) {
			(fm[listKey] as unknown[]).push(unquote(item[1]!));
			continue;
		}
		const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (!kv) continue;
		const key = kv[1]!;
		const value = kv[2]!;
		listKey = value.trim() === '' ? key : null;
		fm[key] = listKey ? [] : scalar(value);
	}
	return fm;
}

/** The position of `text.slice(start, end)`. */
function pos(text: string, start: number, end: number): Pos {
	const loc = (offset: number) => {
		const before = text.slice(0, offset);
		const line = (before.match(/\n/g) ?? []).length;
		return { line, col: offset - (before.lastIndexOf('\n') + 1), offset };
	};
	return { start: loc(start), end: loc(end) };
}

// Obsidian's tag rule: `#`, then letters, digits, `_`, `-`, `/`, at least one
// of them not a digit.
const TAG_RE = /(?<![\w#/&])#((?=[\p{L}\p{N}_\-/]*[\p{L}_\-/])[\p{L}\p{N}_\-/]+)/gu;

export function fakeCache(text: string): CachedMetadata {
	const cache: CachedMetadata = {};
	const t = text.replace(/\r\n?/g, '\n');
	let offset = 0;
	const fm = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/.exec(t);
	if (fm) {
		cache.frontmatter = parseFrontMatter(fm[1] ?? '');
		cache.frontmatterPosition = pos(t, 0, fm[0].trimEnd().length);
		offset = fm[0].length;
	}
	const headings: HeadingCache[] = [];
	const tags: TagCache[] = [];
	let inFence = false;
	for (const line of t.slice(offset).split('\n')) {
		const start = offset;
		offset += line.length + 1;
		if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
		if (inFence || /^\s*(```|~~~)/.test(line)) continue;
		const h = /^ {0,3}(#{1,6})[ \t]+(.*?)\s*$/.exec(line);
		if (h) {
			headings.push({
				heading: h[2]!,
				level: h[1]!.length,
				position: pos(t, start, start + line.length),
			});
			continue;
		}
		const noCode = line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
		for (const m of noCode.matchAll(TAG_RE)) {
			const s = start + m.index;
			tags.push({ tag: '#' + m[1]!, position: pos(t, s, s + m[0].length) });
		}
	}
	if (headings.length) cache.headings = headings;
	if (tags.length) cache.tags = tags;
	return cache;
}

/** A FileInfo for a vault-relative path. */
export function fileInfo(path: string, stat = { ctime: 0, mtime: 0 }): FileInfo {
	const name = path.slice(path.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	return {
		path,
		name,
		basename: dot > 0 ? name.slice(0, dot) : name,
		extension: dot > 0 ? name.slice(dot + 1) : '',
		stat,
	};
}
