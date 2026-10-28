// Smoke test for the view: the real src/ui/ code in a browser DOM (happy-dom),
// with Obsidian stubbed (helpers/obsidian-stub.ts). Opened through open(), as
// Obsidian does, then clicked through. Catches what unit tests can't: wiring,
// delegated clicks, and the view failing to start at all.

import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Window } from 'happy-dom';
import type { PageItem } from '../src/page/derive.ts';
import { PageIndex } from '../src/page-index.ts';
import { installDom } from './helpers/dom.ts';
import { loadFacetsView, type SmokeView, type ViewClass } from './helpers/load-view.ts';

/** 25 pages: 15 wiki, 10 blog; tags, a category and ratings spread across them. */
function fixturePages(): PageItem[] {
	return Array.from({ length: 25 }, (_, i) => ({
		path: `${i < 15 ? 'wiki' : 'blog'}/page-${String(i).padStart(2, '0')}.md`,
		title: `Page ${String(i).padStart(2, '0')}`,
		collections: [i < 15 ? 'wiki' : 'blog'],
		categories: i % 5 === 0 ? ['tech'] : [],
		tags: [i % 2 ? 'odd' : 'even', ...(i % 3 === 0 ? ['three'] : [])],
		rating: i % 6 === 0 ? 5 : i % 6 === 1 ? 3 : 0,
		created: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
		updated: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
		summary: '',
		bookmarks: [],
	}));
}

let win: Window;
let FacetsView: ViewClass;

before(async () => {
	win = installDom();
	FacetsView = await loadFacetsView();
});

/** A view opened on the fixture, with what it opened recorded. */
async function openView() {
	const opened: string[] = [];
	const index = new PageIndex();
	index.replaceAll(fixturePages());
	const app = {
		vault: { getFileByPath: (path: string) => ({ path }) },
		workspace: {
			trigger: () => undefined,
			getLeaf: (pane: unknown) => ({
				openFile: async (f: { path: string }) => {
					opened.push(`${f.path} in ${String(pane)}`);
				},
			}),
		},
	};
	const plugin = {
		index,
		indexReady: true,
		events: { on: () => ({}) },
		settings: { cardsPerBatch: 20, openIn: 'current' },
	};
	const view: SmokeView = new FacetsView({ app }, plugin);
	await view.open(document.createElement('div'));
	const root = view.contentEl;
	const $ = (sel: string) => {
		const el = root.querySelector<HTMLElement>(sel);
		if (!el) throw new Error(`no element for ${sel}`);
		return el;
	};
	const click = (sel: string, init: { ctrlKey?: boolean } = {}) =>
		$(sel).dispatchEvent(new win.MouseEvent('click', { bubbles: true, ...init }) as unknown as Event);
	const status = () => $('.publictxt-facets-status').textContent;
	const cards = () => root.querySelectorAll('.page-card').length;
	const titles = () =>
		Array.from(root.querySelectorAll<HTMLElement>('.page-card-title'))
			.slice(0, 3)
			.map((a) => a.textContent);
	const chip = (facet: string, value: string, x = false) =>
		`[data-facet="${facet}"][data-value="${value}"]${x ? '[data-x]' : ':not([data-x])'}`;
	return { view, root, $, click, status, cards, titles, chip, opened };
}

describe('the view', () => {
	test('opens through open(), as Obsidian starts it', async () => {
		const v = await openView();
		assert.equal(v.status(), '25 pages');
		assert.equal(v.cards(), 20);
		const groups = Array.from(v.root.querySelectorAll<HTMLElement>('.filter-group-label')).map(
			(l) => l.textContent,
		);
		assert.deepEqual(groups, ['Rating', 'Collection', 'Category', 'Tags']);
		assert.equal(v.view.navigation, true);
		assert.equal(v.$('.publictxt-facets-results').getAttribute('aria-live'), 'polite');
	});

	test('Show more adds the next batch', async () => {
		const v = await openView();
		v.click('.publictxt-facets-more');
		assert.equal(v.cards(), 25);
	});

	test('chips include, widen with any, and exclude', async () => {
		const v = await openView();
		v.click(v.chip('collection', 'wiki'));
		assert.equal(v.status(), '15 pages — wiki');
		v.click(v.chip('collection', 'blog'));
		assert.equal(v.status(), '25 pages — wiki or blog');
		v.click(v.chip('tag', 'odd', true));
		assert.equal(v.status(), '13 pages — wiki or blog · not #odd');
	});

	test('two tags match all, then any via the toggle', async () => {
		const v = await openView();
		v.click(v.chip('tag', 'even'));
		v.click(v.chip('tag', 'three'));
		assert.equal(v.status(), '5 pages — #even · #three');
		v.click('[data-match="tag"]');
		assert.equal(v.status(), '17 pages — #even or #three');
	});

	test('a card tag chip includes that tag', async () => {
		const v = await openView();
		v.click('.page-card [data-tag="odd"]');
		assert.equal(v.status(), '12 pages — #odd');
	});

	test('rating chips are minimums, one at a time', async () => {
		const v = await openView();
		v.click('[data-rating="3"]');
		assert.equal(v.status(), '9 pages — ★3+');
		v.click('[data-rating="5"]');
		assert.equal(v.status(), '5 pages — ★5');
	});

	test('the title filter narrows as you type', async () => {
		const v = await openView();
		const input = v.$('.publictxt-facets-title-filter') as HTMLInputElement;
		input.value = 'page 1';
		input.dispatchEvent(new win.Event('input', { bubbles: true }) as unknown as Event);
		assert.equal(v.status(), '10 pages — “page 1”');
	});

	test('the sort menu reorders the cards', async () => {
		const v = await openView();
		assert.deepEqual(v.titles(), ['Page 24', 'Page 23', 'Page 22']);
		const sort = v.$('.publictxt-facets-sort') as HTMLSelectElement;
		sort.value = 'title';
		sort.dispatchEvent(new win.Event('change', { bubbles: true }) as unknown as Event);
		assert.deepEqual(v.titles(), ['Page 00', 'Page 01', 'Page 02']);
	});

	test('Clear resets filters, rating and sort', async () => {
		const v = await openView();
		v.click(v.chip('collection', 'wiki'));
		v.click('[data-rating="5"]');
		const sort = v.$('.publictxt-facets-sort') as HTMLSelectElement;
		sort.value = 'title';
		sort.dispatchEvent(new win.Event('change', { bubbles: true }) as unknown as Event);
		v.click('.publictxt-facets-clear');
		assert.equal(v.status(), '25 pages');
		assert.equal(sort.value, 'created');
	});

	test('a title opens its note: here, Ctrl-click and middle-click in a new tab', async () => {
		const v = await openView();
		v.click('.page-card-title');
		v.click('.page-card-title', { ctrlKey: true });
		v.$('.page-card-title').dispatchEvent(
			new win.MouseEvent('auxclick', { bubbles: true, button: 1 }) as unknown as Event,
		);
		assert.deepEqual(v.opened, [
			'blog/page-24.md in false',
			'blog/page-24.md in tab',
			'blog/page-24.md in tab',
		]);
	});
});
