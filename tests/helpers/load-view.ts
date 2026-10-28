// Bundle src/ui/view.ts with 'obsidian' swapped for the stub, and load it.

import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** What the smoke test reaches on a view. */
export interface SmokeView {
	contentEl: HTMLElement;
	navigation: boolean;
	open(containerEl: HTMLElement): Promise<void>;
	getState(): Record<string, unknown>;
	setState(state: unknown, result: unknown): Promise<void>;
	filterBy(inc: Record<string, string[]>): void;
	clear(): void;
}

export type ViewClass = new (leaf: { app: unknown }, plugin: unknown) => SmokeView;

export async function loadFacetsView(): Promise<ViewClass> {
	const root = fileURLToPath(new URL('../../', import.meta.url));
	const outfile = join(mkdtempSync(join(tmpdir(), 'publictxt-facets-')), 'view.mjs');
	await build({
		entryPoints: [join(root, 'src/ui/view.ts')],
		bundle: true,
		format: 'esm',
		platform: 'node',
		outfile,
		alias: { obsidian: join(root, 'tests/helpers/obsidian-stub.ts') },
		logLevel: 'warning',
	});
	const mod = (await import(pathToFileURL(outfile).href)) as { FacetsView: ViewClass };
	return mod.FacetsView;
}
