// Copy a build into a vault's plugin folder: node scripts/deploy.mjs [vault]
// Default vault: the test vault beside this repo. Reload Obsidian (or toggle
// the plugin) afterwards.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = resolve(process.argv[2] ?? join(root, '../../test-vaults/txt-cpy'));
const { id } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

if (!existsSync(join(vault, '.obsidian'))) {
	console.error(`Not a vault (no .obsidian folder): ${vault}`);
	process.exit(1);
}

const dest = join(vault, '.obsidian', 'plugins', id);
mkdirSync(dest, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	copyFileSync(join(root, file), join(dest, file));
}
console.log(`Deployed ${id} to ${dest}`);
