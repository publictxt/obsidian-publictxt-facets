// A page's created and updated dates (docs/spec.md → Page record): the
// site's scripts/dates.py ladder, without its Git rung.

import { fmString, type FrontMatter } from './front-matter.ts';

// A date in a file name: `20241013-title`, `title . 20240816`,
// `2024-10-13-title`. The digit guards keep longer digit runs (IDs) out.
// No lookbehinds in this plugin's regexes: iOS before 16.4 can't parse them,
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

