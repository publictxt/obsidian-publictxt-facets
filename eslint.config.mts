import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'scripts',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			// The plugin's name is a proper noun, not a sentence.
			'obsidianmd/ui/sentence-case': [
				'warn',
				{ enforceCamelCaseLower: true, ignoreRegex: ['^PublicTxt Facets$'] },
			],
		},
	},
	{
		// Tests run under Node, not in Obsidian; node:test's describe/test
		// promises are handled by the runner, and their strings aren't UI.
		// The view smoke test's helpers stand in for Obsidian itself
		// (globals, element helpers, DOM creation, loading the bundled view),
		// so the plugin-code rules about those don't apply.
		files: ['tests/**/*.ts'],
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'obsidianmd/ui/sentence-case': 'off',
			'obsidianmd/no-global-this': 'off',
			'obsidianmd/no-static-styles-assignment': 'off',
			'obsidianmd/prefer-create-el': 'off',
			'no-unsanitized/method': 'off',
		},
	},
);
