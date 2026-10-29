import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/settings.ts';

describe('normalizeSettings', () => {
	test('nothing saved yet gives the defaults', () => {
		assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
		assert.deepEqual(normalizeSettings('junk'), DEFAULT_SETTINGS);
	});

	test('valid values are kept', () => {
		const s = normalizeSettings({
			excludedFolders: ['settings/Templates'],
			collectionFromFolder: false,
			tagsFrom: 'frontmatter',
			useCategories: false,
			categories: ['Tech', 'Science'],
			useRatings: false,
			openIn: 'tab',
			cardsPerBatch: 50,
		});
		assert.equal(s.useCategories, false);
		assert.equal(s.useRatings, false);
		assert.deepEqual(s.excludedFolders, ['settings/Templates']);
		assert.equal(s.collectionFromFolder, false);
		assert.equal(s.tagsFrom, 'frontmatter');
		assert.deepEqual(s.categories, ['Tech', 'Science']);
		assert.equal(s.openIn, 'tab');
		assert.equal(s.cardsPerBatch, 50);
	});

	test('malformed values fall back to their defaults', () => {
		const s = normalizeSettings({
			collectionFromFolder: 'yes',
			useRatings: 1,
			tagsFrom: 'everywhere',
			openIn: 'popup',
			cardsPerBatch: 0,
		});
		assert.equal(s.collectionFromFolder, true);
		assert.equal(s.useRatings, true);
		assert.equal(s.tagsFrom, 'both');
		assert.equal(s.openIn, 'current');
		assert.equal(s.cardsPerBatch, 20);
	});

	test('list settings accept one string: folders by line, categories by line or comma', () => {
		const s = normalizeSettings({
			excludedFolders: 'media\n settings/Templates \nA, B\n',
			categories: 'Tech, Science\nArt',
		});
		assert.deepEqual(s.excludedFolders, ['media', 'settings/Templates', 'A, B']);
		assert.deepEqual(s.categories, ['Tech', 'Science', 'Art']);
	});

	test('defaults are copied, not shared', () => {
		normalizeSettings(null).excludedFolders.push('x');
		assert.deepEqual(normalizeSettings(null).excludedFolders, []);
	});
});
