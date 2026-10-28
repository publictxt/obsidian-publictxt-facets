import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCache, fileInfo } from './helpers/fake-cache.ts';
import {
	derivePage,
	isPagePath,
	isUnpublished,
	type DeriveOptions,
} from '../src/page/derive.ts';

const OPTS: DeriveOptions = {
	collectionFromFolder: true,
	tagsFrom: 'both',
	categories: [],
};
const T0 = Date.UTC(2020, 0, 1, 12);
const T1 = Date.UTC(2021, 5, 1, 12);

function derive(path: string, text: string, opts: Partial<DeriveOptions> = {}) {
	const stat = { ctime: T0, mtime: T1 };
	return derivePage(fileInfo(path, stat), fakeCache(text), text, { ...OPTS, ...opts });
}

const note = (fm: string, body = 'Some text.') => `---\n${fm}\n---\n${body}\n`;

describe('which files are pages', () => {
	const page = (path: string, excluded: string[] = []) =>
		isPagePath(fileInfo(path), excluded);

	test('Markdown files are pages, folder indexes included', () => {
		assert.equal(page('wiki/_index.md'), true);
		assert.equal(page('About.md'), true);
	});
	test('other files are not', () => {
		assert.equal(page('media/pic.png'), false);
	});
	test('housekeeping files are skipped by exact name, at any depth', () => {
		assert.equal(page('README.md'), false);
		assert.equal(page('wiki/LICENSE.md'), false);
		assert.equal(page('CONTRIBUTING.md'), false);
		assert.equal(page('wiki/README-notes.md'), true);
	});
	test('excluded folders match on folder boundaries', () => {
		assert.equal(page('settings/Templates/t.md', ['settings/Templates']), false);
		assert.equal(page('settings/other.md', ['settings/Templates']), true);
		assert.equal(page('media-notes/x.md', ['media']), true);
		assert.equal(page('wiki/x.md', [' ./wiki/ ']), false);
		assert.equal(page('wiki/x.md', ['']), true);
	});
	test('publish: off and its spellings hide a page', () => {
		for (const v of [false, 0, 'off', 'No', 'false']) {
			assert.equal(isUnpublished({ publish: v }), true, String(v));
		}
		assert.equal(isUnpublished({ publish: true }), false);
		assert.equal(isUnpublished({}), false);
		assert.equal(isUnpublished(undefined), false);
	});
});

describe('title', () => {
	test('front matter title wins, and the H1 stays in the summary', () => {
		const p = derive('wiki/a.md', note('title: Set', '# Heading\nBody.'));
		assert.equal(p.title, 'Set');
		assert.equal(p.summary, 'Heading Body.');
	});
	test('else the first H1, removed from the summary', () => {
		const p = derive('wiki/a.md', '# Heading\nBody.\n');
		assert.equal(p.title, 'Heading');
		assert.equal(p.summary, 'Body.');
	});
	test('else the file name', () => {
		assert.equal(derive('wiki/My note.md', 'Body.').title, 'My note');
	});
});

describe('collections', () => {
	test('top-level folder, or page at the root', () => {
		assert.deepEqual(derive('blog/2024/x.md', 'x').collections, ['blog']);
		assert.deepEqual(derive('About.md', 'x').collections, ['page']);
	});
	test('plus collections: values, lower-cased and deduped', () => {
		const p = derive('posts/x.md', note('collections: [Blog, posts]'));
		assert.deepEqual(p.collections, ['posts', 'blog']);
		assert.deepEqual(
			derive('posts/x.md', note('collections: Notes')).collections,
			['posts', 'notes'],
		);
	});
	test('plus bookmarks for a page with a bookmark URL', () => {
		const p = derive('wiki/x.md', note('bookmark: https://example.org/'));
		assert.deepEqual(p.collections, ['wiki', 'bookmarks']);
		assert.deepEqual(p.bookmarks, ['https://example.org/']);
	});
	test('a bookmark that is not a URL adds nothing', () => {
		const p = derive('wiki/x.md', note('bookmark: example.org'));
		assert.deepEqual(p.collections, ['wiki']);
		assert.deepEqual(p.bookmarks, []);
	});
	test('the folder can be left out by setting', () => {
		const opts = { collectionFromFolder: false };
		assert.deepEqual(derive('blog/x.md', 'x', opts).collections, []);
		assert.deepEqual(
			derive('blog/x.md', note('collections: posts'), opts).collections,
			['posts'],
		);
	});
});

describe('categories', () => {
	const fm = note('category: tech\ncategories: [Science, Nonsense]');
	test('any value counts with no list, lower-cased', () => {
		assert.deepEqual(derive('w/x.md', fm).categories, ['science', 'nonsense', 'tech']);
	});
	test('a list filters, matching case-insensitively, in its spelling', () => {
		const p = derive('w/x.md', fm, { categories: ['Tech', 'Science'] });
		assert.deepEqual(p.categories, ['Science', 'Tech']);
	});
});

describe('tags', () => {
	const text = note('tags: [Brain, "#mind"]', 'About #philosophy and #brain, #a/b.');
	test('front matter and inline, lower-cased, no #, deduped', () => {
		assert.deepEqual(derive('w/x.md', text).tags, ['brain', 'mind', 'philosophy', 'a/b']);
	});
	test('front matter only', () => {
		assert.deepEqual(derive('w/x.md', text, { tagsFrom: 'frontmatter' }).tags, ['brain', 'mind']);
	});
	test('inline only', () => {
		assert.deepEqual(derive('w/x.md', text, { tagsFrom: 'inline' }).tags, [
			'philosophy',
			'brain',
			'a/b',
		]);
	});
	test('a tags string splits on commas and spaces; tag: counts too', () => {
		assert.deepEqual(derive('w/x.md', note('tags: a, b c')).tags, ['a', 'b', 'c']);
		assert.deepEqual(derive('w/x.md', note('tag: legacy')).tags, ['legacy']);
	});
	test('tags in code are not tags', () => {
		const p = derive('w/x.md', 'Use `#notatag` here.\n```\n#nor\n```\n');
		assert.deepEqual(p.tags, []);
	});
});

describe('rating', () => {
	const rating = (v: string) => derive('w/x.md', note(`rating: ${v}`)).rating;
	test('a whole number 1–5', () => {
		assert.equal(rating('4'), 4);
		assert.equal(rating('"5"'), 5);
	});
	test('anything else is unrated', () => {
		for (const v of ['0', '6', '3.5', 'great']) assert.equal(rating(v), 0, v);
		assert.equal(derive('w/x.md', 'x').rating, 0);
	});
});

describe('summary', () => {
	test('the first 30 words, without front matter', () => {
		const words = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
		const p = derive('w/x.md', note('title: T', words));
		assert.equal(p.summary.split(' ').length, 30);
		assert.ok(p.summary.startsWith('w0 w1'));
	});
});
