import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PageItem } from '../src/page/derive.ts';
import { PageIndex } from '../src/page-index.ts';

function page(path: string, title: string, created: string, rating = 0, updated = created): PageItem {
	return {
		path,
		title,
		collections: [],
		categories: [],
		tags: [],
		rating,
		created,
		updated,
		summary: '',
		bookmarks: [],
	};
}

describe('PageIndex', () => {
	test('newest first, then by title', () => {
		const index = new PageIndex();
		index.replaceAll([
			page('a.md', 'Old', '2020-01-01T00:00:00+00:00'),
			page('b.md', 'New', '2024-01-01T00:00:00+00:00'),
			page('d.md', 'Beta', '2022-01-01T00:00:00+00:00'),
			page('c.md', 'Alpha', '2022-01-01T00:00:00+00:00'),
		]);
		assert.deepEqual(
			index.sorted('created').map((p) => p.title),
			['New', 'Alpha', 'Beta', 'Old'],
		);
	});

	test('an unparseable date sorts as oldest', () => {
		const index = new PageIndex();
		index.put(page('a.md', 'Odd', 'sometime in May'));
		index.put(page('b.md', 'Dated', '2020-01-01T00:00:00+00:00'));
		assert.deepEqual(index.sorted('created').map((p) => p.title), ['Dated', 'Odd']);
	});

	test('every sort, with ties by title', () => {
		const index = new PageIndex();
		index.replaceAll([
			page('a.md', 'Apple', '2020-01-01T00:00:00Z', 5, '2024-06-01T00:00:00Z'),
			page('b.md', 'banana', '2022-01-01T00:00:00Z', 0, '2022-01-01T00:00:00Z'),
			page('c.md', 'Cherry', '2021-01-01T00:00:00Z', 2, '2023-01-01T00:00:00Z'),
			page('d.md', 'Date', '2021-01-01T00:00:00Z', 3, '2021-01-01T00:00:00Z'),
		]);
		const order = (s: string) => index.sorted(s).map((p) => p.title);
		assert.deepEqual(order('created'), ['banana', 'Cherry', 'Date', 'Apple']);
		assert.deepEqual(order('created asc'), ['Apple', 'Cherry', 'Date', 'banana']);
		assert.deepEqual(order('title'), ['Apple', 'banana', 'Cherry', 'Date']);
		assert.deepEqual(order('title desc'), ['Date', 'Cherry', 'banana', 'Apple']);
		assert.deepEqual(order('updated'), ['Apple', 'Cherry', 'banana', 'Date']);
		// Unrated (banana) sorts as 2.5: below 3, above 2.
		assert.deepEqual(order('rating'), ['Apple', 'Date', 'banana', 'Cherry']);
		assert.deepEqual(order('rating asc'), ['Cherry', 'banana', 'Date', 'Apple']);
	});

	test('put replaces by path; remove reports what it did', () => {
		const index = new PageIndex();
		index.put(page('a.md', 'One', '2020-01-01T00:00:00+00:00'));
		index.put(page('a.md', 'Two', '2020-01-01T00:00:00+00:00'));
		assert.equal(index.size, 1);
		assert.equal(index.get('a.md')?.title, 'Two');
		assert.equal(index.remove('a.md'), true);
		assert.equal(index.remove('a.md'), false);
		assert.equal(index.size, 0);
	});

	test('replaceAll drops what was there', () => {
		const index = new PageIndex();
		index.put(page('a.md', 'A', '2020-01-01T00:00:00+00:00'));
		index.replaceAll([page('b.md', 'B', '2020-01-01T00:00:00+00:00')]);
		assert.equal(index.get('a.md'), undefined);
		assert.equal(index.size, 1);
	});
});
