import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
	dateFromPath,
	dateOnlyToISO,
	deriveDates,
	normalizeDate,
} from '../src/page/dates.ts';

const T0 = Date.UTC(2020, 0, 1, 12);
const T1 = Date.UTC(2021, 5, 1, 12);

describe('dates', () => {
	test('a date in the file name, either spelling', () => {
		assert.equal(dateFromPath('blog/20240816-title.md'), '2024-08-16');
		assert.equal(dateFromPath('blog/The Mess . 20240816.md'), '2024-08-16');
		assert.equal(dateFromPath('blog/2024-10-13-title.md'), '2024-10-13');
	});
	test('else in the folders', () => {
		assert.equal(dateFromPath('blog/2023/12/17/post.md'), '2023-12-17');
	});
	test('not impossible dates or longer digit runs', () => {
		assert.equal(dateFromPath('blog/20240230-x.md'), null);
		assert.equal(dateFromPath('wiki/isbn-9780262510875.md'), null);
	});
	test('front matter wins: created, else date; updated, else lastmod', () => {
		const d = deriveDates(
			{ date: '2024-01-02', lastmod: '2024-03-04' },
			'blog/20200101-x.md',
			{ ctime: T0, mtime: T1 },
		);
		assert.equal(d.created, dateOnlyToISO('2024-01-02'));
		assert.equal(d.updated, dateOnlyToISO('2024-03-04'));
	});
	test('else the path, else file times', () => {
		const stat = { ctime: T0, mtime: T1 };
		assert.equal(deriveDates({}, 'blog/20240816-x.md', stat).created, dateOnlyToISO('2024-08-16'));
		const d = deriveDates({}, 'wiki/x.md', stat);
		assert.equal(Date.parse(d.created), T0);
		assert.equal(Date.parse(d.updated), T1);
	});
	test('updated is never earlier than created', () => {
		const d = deriveDates({ created: '2025-01-01' }, 'w/x.md', { ctime: T0, mtime: T1 });
		assert.equal(d.updated, d.created);
	});
	test('odd values pass through for the author to see', () => {
		assert.equal(normalizeDate('sometime in May'), 'sometime in May');
		assert.equal(normalizeDate(''), null);
	});
});
