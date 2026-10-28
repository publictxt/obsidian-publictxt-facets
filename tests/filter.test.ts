import { describe as suite, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PageItem } from '../src/page/derive.ts';
import {
	chipCounts,
	chipState,
	clearBrowseState,
	describe,
	emptyBrowseState,
	filterPages,
	press,
	ratingChoices,
	ratingCounts,
	ratingLabel,
	sortedKeys,
	toggleInclude,
	type FilterState,
} from '../src/filter.ts';

function page(
	title: string,
	collections: string[],
	tags: string[] = [],
	categories: string[] = [],
	rating = 0,
): PageItem {
	return {
		path: title + '.md',
		title,
		collections,
		categories,
		tags,
		rating,
		created: '',
		updated: '',
		summary: '',
		bookmarks: [],
	};
}

const PAGES = [
	page('Brain science', ['wiki'], ['brain', 'science'], ['science']),
	page('Mind and brain', ['wiki'], ['brain', 'mind']),
	page('A journal entry', ['blog'], ['journal', 'mind']),
	page('Bookmarked brain', ['wiki', 'bookmarks'], ['brain']),
];
const titles = (pages: PageItem[]) => pages.map((p) => p.title);
const filter = (): FilterState => ({ inc: new Set(), exc: new Set(), match: 'all' });

suite('chip presses', () => {
	test('body: off → include → off', () => {
		const f = filter();
		press(f, 'a');
		assert.equal(chipState(f, 'a'), 'include');
		press(f, 'a');
		assert.equal(chipState(f, 'a'), '');
	});
	test('✕: off → exclude → off, and include → exclude directly', () => {
		const f = filter();
		press(f, 'a', true);
		assert.equal(chipState(f, 'a'), 'exclude');
		press(f, 'a', true);
		assert.equal(chipState(f, 'a'), '');
		press(f, 'a');
		press(f, 'a', true);
		assert.equal(chipState(f, 'a'), 'exclude');
	});
	test('body on an excluded chip clears it, not includes it', () => {
		const f = filter();
		press(f, 'a', true);
		press(f, 'a');
		assert.equal(chipState(f, 'a'), '');
	});
	test('a card tag only includes or clears', () => {
		const f = filter();
		press(f, 'a', true);
		toggleInclude(f, 'a');
		assert.equal(chipState(f, 'a'), 'include');
		toggleInclude(f, 'a');
		assert.equal(chipState(f, 'a'), '');
	});
});

suite('filterPages', () => {
	test('nothing set: every page', () => {
		assert.equal(filterPages(PAGES, emptyBrowseState()).length, 4);
	});
	test('tags match all by default', () => {
		const s = emptyBrowseState();
		s.facets.tag.inc = new Set(['brain', 'mind']);
		assert.deepEqual(titles(filterPages(PAGES, s)), ['Mind and brain']);
	});
	test('any widens', () => {
		const s = emptyBrowseState();
		s.facets.tag.inc = new Set(['science', 'journal']);
		s.facets.tag.match = 'any';
		assert.deepEqual(titles(filterPages(PAGES, s)), ['Brain science', 'A journal entry']);
	});
	test('excludes remove pages, whatever the mode', () => {
		const s = emptyBrowseState();
		s.facets.collection.exc = new Set(['bookmarks']);
		s.facets.tag.inc = new Set(['brain']);
		assert.deepEqual(titles(filterPages(PAGES, s)), ['Brain science', 'Mind and brain']);
	});
	test('facets combine with AND', () => {
		const s = emptyBrowseState();
		s.facets.collection.inc = new Set(['wiki']);
		s.facets.category.inc = new Set(['science']);
		assert.deepEqual(titles(filterPages(PAGES, s)), ['Brain science']);
	});
	test('title filter: contains, case-insensitive', () => {
		const s = emptyBrowseState();
		s.title = '  BRAIN ';
		assert.deepEqual(titles(filterPages(PAGES, s)), [
			'Brain science',
			'Mind and brain',
			'Bookmarked brain',
		]);
	});
});

suite('chip counts', () => {
	test('an all facet counts within the results', () => {
		const s = emptyBrowseState();
		s.facets.tag.inc = new Set(['brain']);
		const counts = chipCounts(PAGES, s, filterPages(PAGES, s));
		assert.equal(counts.tag.get('brain'), 3);
		assert.equal(counts.tag.get('mind'), 1);
		assert.equal(counts.tag.get('journal'), undefined);
	});
	test('an any facet counts without its own includes', () => {
		const s = emptyBrowseState();
		s.facets.collection.inc = new Set(['blog']);
		const counts = chipCounts(PAGES, s, filterPages(PAGES, s));
		// Picking wiki would add its 3 pages, so it shows 3, not 0.
		assert.equal(counts.collection.get('wiki'), 3);
		assert.equal(counts.collection.get('blog'), 1);
		// Other facets still count the results: the one blog page.
		assert.equal(counts.tag.get('mind'), 1);
		assert.equal(counts.tag.get('brain'), undefined);
	});
	test('an any facet still applies its own excludes to its counts', () => {
		const s = emptyBrowseState();
		s.facets.collection.inc = new Set(['wiki']);
		s.facets.collection.exc = new Set(['bookmarks']);
		const counts = chipCounts(PAGES, s, filterPages(PAGES, s));
		assert.equal(counts.collection.get('wiki'), 2);
	});
	test('chip order: count descending, then name', () => {
		const m = new Map([['b', 1], ['a', 1], ['c', 5]]);
		assert.deepEqual(sortedKeys(m), ['c', 'a', 'b']);
	});
});

suite('rating', () => {
	const RATED = [
		page('Five', ['wiki'], [], [], 5),
		page('Four', ['wiki'], [], [], 4),
		page('Two', ['blog'], [], [], 2),
		page('None', ['blog']),
	];
	test('a number is a minimum; unrated is exact', () => {
		const s = emptyBrowseState();
		s.rating = '4';
		assert.deepEqual(titles(filterPages(RATED, s)), ['Five', 'Four']);
		s.rating = 'unrated';
		assert.deepEqual(titles(filterPages(RATED, s)), ['None']);
	});
	test('chips offer the ratings present, best first, then unrated', () => {
		assert.deepEqual(ratingChoices(RATED), ['5', '4', '2', 'unrated']);
		assert.deepEqual(ratingChoices(PAGES), []);
	});
	test('chip counts are cumulative, and counted without the rating filter', () => {
		const s = emptyBrowseState();
		s.rating = '5';
		s.facets.collection.inc = new Set(['wiki']);
		const counts = ratingCounts(filterPages(RATED, s, 'rating'));
		assert.equal(counts.get('5'), 1);
		assert.equal(counts.get('4'), 2);
		assert.equal(counts.get('1'), 2);
		assert.equal(counts.get('unrated'), 0);
	});
	test('labels as on the site', () => {
		assert.equal(ratingLabel('5'), '★5');
		assert.equal(ratingLabel('3'), '★3+');
		assert.equal(ratingLabel('unrated'), 'Unrated');
	});
});

suite('status line', () => {
	test('title, includes joined by mode, excludes', () => {
		const s = emptyBrowseState();
		s.title = 'net';
		s.facets.collection.inc = new Set(['wiki', 'blog']);
		s.facets.tag.inc = new Set(['a', 'b']);
		s.facets.tag.exc = new Set(['c']);
		s.rating = '4';
		assert.deepEqual(describe(s), ['“net”', 'wiki or blog', '#a · #b', 'not #c', '★4+']);
	});
	test('clear resets everything, match modes included', () => {
		const s = emptyBrowseState();
		s.title = 'x';
		s.facets.tag.match = 'any';
		s.facets.tag.inc.add('a');
		s.rating = '3';
		s.sort = 'title';
		clearBrowseState(s);
		assert.deepEqual(s, emptyBrowseState());
	});
});
