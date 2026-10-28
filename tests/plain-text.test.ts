import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { plainText } from '../src/page/plain-text.ts';

describe('plainText', () => {
	test('plain text: links, emphasis and markers dropped, words kept', () => {
		assert.equal(
			plainText('## Head\n- **bold** [link](u) and [[Page|alias]]\n> quote `code`'),
			'Head bold link and alias quote code',
		);
		assert.equal(plainText('_em_ and __strong__ in snake_case'), 'em and strong in snake_case');
	});
});
