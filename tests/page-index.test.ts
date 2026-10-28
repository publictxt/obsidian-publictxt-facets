import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PageItem } from '../src/derive.ts';
import { PageIndex } from '../src/page-index.ts';

function page(path: string, title: string, created: string): PageItem {
	return {
		path,
		title,
		collections: [],
		categories: [],
		tags: [],
		rating: 0,
		created,
		updated: created,
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
			index.newest().map((p) => p.title),
			['New', 'Alpha', 'Beta', 'Old'],
		);
	});

	test('an unparseable date sorts as oldest', () => {
		const index = new PageIndex();
		index.put(page('a.md', 'Odd', 'sometime in May'));
		index.put(page('b.md', 'Dated', '2020-01-01T00:00:00+00:00'));
		assert.deepEqual(index.newest().map((p) => p.title), ['Dated', 'Odd']);
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
