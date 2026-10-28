// A stand-in for Obsidian's MetadataCache: front matter (a YAML subset), ATX
// headings and inline #tags, close enough to what getFileCache() returns for
// the notes the tests use.

import type { CachedMetadata, FrontMatterCache, HeadingCache, TagCache } from 'obsidian';
import type { FileInfo } from '../../src/derive.ts';

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

const NO_POS = {
	start: { line: 0, col: 0, offset: 0 },
	end: { line: 0, col: 0, offset: 0 },
};

// Obsidian's tag rule: `#`, then letters, digits, `_`, `-`, `/`, at least one
// of them not a digit.
const TAG_RE = /(?<![\w#/&])#((?=[\p{L}\p{N}_\-/]*[\p{L}_\-/])[\p{L}\p{N}_\-/]+)/gu;

export function fakeCache(text: string): CachedMetadata {
	const cache: CachedMetadata = {};
	let body = text.replace(/\r\n?/g, '\n');
	const fm = /^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/.exec(body);
	if (fm) {
		cache.frontmatter = parseFrontMatter(fm[1] ?? '');
		body = body.slice(fm[0].length);
	}
	const headings: HeadingCache[] = [];
	const tags: TagCache[] = [];
	let inFence = false;
	for (const line of body.split('\n')) {
		if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
		if (inFence || /^\s*(```|~~~)/.test(line)) continue;
		const h = /^ {0,3}(#{1,6})[ \t]+(.*?)\s*$/.exec(line);
		if (h) {
			headings.push({ heading: h[2]!, level: h[1]!.length, position: NO_POS });
			continue;
		}
		const noCode = line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
		for (const m of noCode.matchAll(TAG_RE)) {
			tags.push({ tag: '#' + m[1]!, position: NO_POS });
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
