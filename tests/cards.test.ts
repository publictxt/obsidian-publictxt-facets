import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkLabel, dateLabels, formatDate, stars } from '../src/cards.ts';
import { dateOnlyToISO } from '../src/derive.ts';

describe('card text', () => {
	test('dates read "2 Jan 2006"', () => {
		assert.equal(formatDate(dateOnlyToISO('2006-01-02')), '2 Jan 2006');
		assert.equal(formatDate('sometime in May'), '');
	});

	test('updated shows only when over a day after created', () => {
		const created = dateOnlyToISO('2024-03-01');
		assert.deepEqual(dateLabels({ created, updated: created }), {
			created: '1 Mar 2024',
			updated: '',
		});
		assert.equal(
			dateLabels({ created, updated: '2024-03-01T23:00:00' }).updated,
			'',
		);
		assert.equal(
			dateLabels({ created, updated: dateOnlyToISO('2024-03-05') }).updated,
			'5 Mar 2024',
		);
	});

	test('no updated label without a created one', () => {
		assert.deepEqual(dateLabels({ created: '??', updated: dateOnlyToISO('2024-03-05') }), {
			created: '',
			updated: '',
		});
	});

	test('stars for 1–5, nothing when unrated', () => {
		assert.equal(stars(4), '★★★★☆');
		assert.equal(stars(5), '★★★★★');
		assert.equal(stars(0), '');
	});

	test('bookmark labels drop the scheme, www. and trailing slash', () => {
		assert.equal(bookmarkLabel('https://www.example.org/thing/'), '↗ example.org/thing');
		assert.equal(bookmarkLabel('http://example.org'), '↗ example.org');
	});
});
