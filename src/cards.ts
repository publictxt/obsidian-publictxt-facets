// The page card: a port of publictxt-pages' assets/js/cards.js and its date
// and bookmark partials. Built with DOM calls, not an HTML string, so no text
// from the vault is ever parsed as markup. Tag chips are plain labels until
// the facets slice makes them filters.

import type { PageItem } from './page/derive.ts';

/** Tag chips shown per card, as on the site. */
export const CARD_TAGS = 6;

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2 Jan 2006", the site's one date form; '' when unparseable. */
export function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * The dates a card shows (date-labels.html): `updated` only when it is more
 * than a day after `created`, since an edit on the day of writing is not an
 * update.
 */
export function dateLabels(page: Pick<PageItem, 'created' | 'updated'>): {
	created: string;
	updated: string;
} {
	const created = formatDate(page.created);
	const later = Date.parse(page.updated) - Date.parse(page.created) > DAY_MS;
	return { created, updated: created && later ? formatDate(page.updated) : '' };
}

/** ★★★★☆ for a rating 1–5; '' when unrated. */
export function stars(rating: number): string {
	return rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '';
}

/** "↗ example.org/page": scheme, `www.` and trailing slash dropped. */
export function bookmarkLabel(url: string): string {
	return '↗ ' + url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

/**
 * A page card. The title carries the page's path in `data-path`; the view
 * opens the note and shows hover previews from it.
 */
export function card(page: PageItem): HTMLLIElement {
	const li = createEl('li', { cls: 'page-card' });

	const head = li.createDiv({ cls: 'page-card-head' });
	head.createEl('a', {
		cls: 'page-card-title',
		text: page.title,
		attr: { 'data-path': page.path },
	});
	if (page.collections.length) {
		const row = head.createSpan({ cls: 'page-card-collections' });
		for (const c of page.collections) row.createSpan({ cls: 'chip chip-collection', text: c });
	}

	const dates = li.createSpan({ cls: 'page-card-dates' });
	const { created, updated } = dateLabels(page);
	if (created) {
		dates.createEl('time', { cls: 'muted', text: created, attr: { datetime: page.created } });
	}
	if (updated) {
		const span = dates.createSpan({ cls: 'muted', text: ' · updated ' });
		span.createEl('time', { text: updated, attr: { datetime: page.updated } });
	}
	if (page.rating) {
		dates.createSpan({
			cls: 'rating',
			text: stars(page.rating),
			attr: { role: 'img', 'aria-label': `Rated ${page.rating} of 5` },
		});
	}

	if (page.bookmarks.length) {
		const row = li.createDiv({ cls: 'chip-row bookmark-links' });
		for (const url of page.bookmarks) {
			row.createEl('a', {
				cls: 'chip chip-link',
				href: url,
				text: bookmarkLabel(url),
				attr: { rel: 'noopener external', target: '_blank' },
			});
		}
	}

	if (page.summary) li.createEl('p', { cls: 'page-card-summary', text: page.summary });

	const tags = page.tags.slice(0, CARD_TAGS);
	if (tags.length) {
		const row = li.createDiv({ cls: 'chip-row' });
		for (const t of tags) row.createSpan({ cls: 'chip', text: '#' + t });
	}
	return li;
}
