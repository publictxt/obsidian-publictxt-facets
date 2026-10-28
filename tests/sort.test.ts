import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseSort, parseSort, SORTS } from '../src/sort.ts';

describe('sort vocabulary', () => {
	test('canonical form drops the natural direction', () => {
		assert.equal(normaliseSort('created desc'), 'created');
		assert.equal(normaliseSort('title asc'), 'title');
		assert.equal(normaliseSort('Title DESC'), 'title desc');
		assert.equal(normaliseSort('rating asc'), 'rating asc');
	});
	test('unknown or empty sorts become Newest', () => {
		assert.equal(normaliseSort(''), 'created');
		assert.equal(normaliseSort('relevance'), 'created');
		assert.equal(normaliseSort('updated sideways'), 'updated');
	});
	test('parseSort makes the direction explicit', () => {
		assert.deepEqual(parseSort('title'), { field: 'title', dir: 'asc' });
		assert.deepEqual(parseSort('updated'), { field: 'updated', dir: 'desc' });
		assert.deepEqual(parseSort('created asc'), { field: 'created', dir: 'asc' });
	});
	test('every menu value is already canonical', () => {
		for (const [value] of SORTS) assert.equal(normaliseSort(value), value);
	});
});
