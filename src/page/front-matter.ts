// Reading front matter values. YAML hands over strings, numbers, booleans,
// dates and lists; these readers take only what a rule can use.

/** Front matter as read here: values are unknown until checked. */
export type FrontMatter = Record<string, unknown>;

export function fmString(v: unknown): string | null {
	if (typeof v === 'string') return v.trim() || null;
	if (typeof v === 'number' && Number.isFinite(v)) return String(v);
	return null;
}

/** A value or a list of values, as strings. Strings are not split. */
export function fmValues(v: unknown): string[] {
	const items = Array.isArray(v) ? (v as unknown[]) : [v];
	return items.flatMap((x) => {
		const s = fmString(x);
		return s ? [s] : [];
	});
}

/** Like fmValues, but a string is split on commas and spaces (`tags: a, b`). */
export function fmTagList(v: unknown): string[] {
	return typeof v === 'string' ? v.split(/[,\s]+/) : fmValues(v);
}

