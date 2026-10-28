// The slice of Obsidian's runtime that the view uses, for the view smoke test.
// The bundled view imports this in place of 'obsidian' (load-view.ts).
//
// The one thing it must do as Obsidian does: a leaf starts a view by calling
// open(containerEl), which runs onOpen. A view method named `open` silently
// replaced that once; this stub is what lets the test catch it.

export class Component {
	private cleanups: (() => void)[] = [];

	register(cb: () => void): void {
		this.cleanups.push(cb);
	}

	registerEvent(_ref: unknown): void {}

	registerDomEvent(el: HTMLElement, type: string, cb: (evt: Event) => void): void {
		el.addEventListener(type, cb);
		this.register(() => el.removeEventListener(type, cb));
	}
}

export class ItemView extends Component {
	app: unknown;
	contentEl: HTMLElement;
	navigation = false;

	constructor(leaf: { app: unknown }) {
		super();
		this.app = leaf.app;
		this.contentEl = document.createElement('div');
	}

	async onOpen(): Promise<void> {}

	async onClose(): Promise<void> {}

	async open(_containerEl: HTMLElement): Promise<void> {
		await this.onOpen();
	}
}

export const Keymap = {
	isModEvent: (evt: MouseEvent): 'tab' | false => (evt.ctrlKey || evt.metaKey ? 'tab' : false),
};

/** Runs at once: the test doesn't wait for typing pauses. */
export function debounce<T extends unknown[]>(cb: (...args: T) => void) {
	const run = (...args: T) => cb(...args);
	run.cancel = () => run;
	run.run = () => undefined;
	return run;
}

export class Events {
	on(): object {
		return {};
	}

	trigger(): void {}
}
