// Settings types and defaults (docs/spec.md → Settings). No Obsidian runtime
// imports, so derive.ts and the tests can use them under plain Node.

export type TagsFrom = 'both' | 'frontmatter' | 'inline';
export type OpenIn = 'current' | 'tab' | 'split';

export interface TxtFacetsSettings {
	/**
	 * Vault-relative folders whose notes are not pages. Dot-folders
	 * (`.trash`, `.git`, the config folder) never need listing: Obsidian
	 * doesn't index them.
	 */
	excludedFolders: string[];
	/** A page's top-level folder is one of its collections (`page` at root). */
	collectionFromFolder: boolean;
	/** Where tags come from: front matter `tags`, inline `#tags`, or both. */
	tagsFrom: TagsFrom;
	/** Allowed categories, in display spelling. Empty: any value counts. */
	categories: string[];
	/** Where a card's title opens the note. */
	openIn: OpenIn;
	/** Cards shown before, and added by, "Show more". */
	cardsPerBatch: number;
}

export const DEFAULT_SETTINGS: TxtFacetsSettings = {
	excludedFolders: [],
	collectionFromFolder: true,
	tagsFrom: 'both',
	categories: [],
	openIn: 'current',
	cardsPerBatch: 20,
};

const TAGS_FROM: readonly TagsFrom[] = ['both', 'frontmatter', 'inline'];
const OPEN_IN: readonly OpenIn[] = ['current', 'tab', 'split'];

// A list setting: an array of strings, or one string split on newlines and
// commas. Blank entries are dropped.
function stringList(v: unknown): string[] | null {
	const raw = Array.isArray(v)
		? v.filter((x): x is string => typeof x === 'string')
		: typeof v === 'string'
			? v.split(/\r?\n|,/)
			: null;
	return raw && raw.map((x) => x.trim()).filter(Boolean);
}

/**
 * Settings as read from data.json, each field checked and replaced by its
 * default when missing or malformed, so a hand-edited file can't stop the
 * plugin from loading.
 */
export function normalizeSettings(raw: unknown): TxtFacetsSettings {
	const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
		string,
		unknown
	>;
	const s: TxtFacetsSettings = {
		...DEFAULT_SETTINGS,
		excludedFolders: [...DEFAULT_SETTINGS.excludedFolders],
		categories: [...DEFAULT_SETTINGS.categories],
	};
	s.excludedFolders = stringList(r.excludedFolders) ?? s.excludedFolders;
	s.categories = stringList(r.categories) ?? s.categories;
	if (typeof r.collectionFromFolder === 'boolean') {
		s.collectionFromFolder = r.collectionFromFolder;
	}
	if (TAGS_FROM.includes(r.tagsFrom as TagsFrom)) {
		s.tagsFrom = r.tagsFrom as TagsFrom;
	}
	if (OPEN_IN.includes(r.openIn as OpenIn)) s.openIn = r.openIn as OpenIn;
	const n =
		typeof r.cardsPerBatch === 'string'
			? Number.parseInt(r.cardsPerBatch, 10)
			: r.cardsPerBatch;
	if (typeof n === 'number' && Number.isInteger(n) && n >= 1) {
		s.cardsPerBatch = n;
	}
	return s;
}
