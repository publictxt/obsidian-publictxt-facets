// A browser DOM for tests (happy-dom), plus the element helpers Obsidian adds
// to HTMLElement (createEl, empty, toggleClass, …), close enough for the view.

import { Window } from 'happy-dom';

interface ElInfo {
	cls?: string | string[];
	text?: string;
	href?: string;
	type?: string;
	value?: string;
	attr?: Record<string, string | number | boolean>;
}

export function installDom(): Window {
	const win = new Window();
	const g = globalThis as Record<string, unknown>;
	g.window = win;
	g.document = win.document;
	g.HTMLElement = win.HTMLElement;
	g.ResizeObserver = class {
		observe(): void {}
		disconnect(): void {}
	};

	const make = (tag: string, o: ElInfo = {}, parent?: HTMLElement): HTMLElement => {
		const el = win.document.createElement(tag) as unknown as HTMLElement;
		if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls;
		if (o.text !== undefined) el.textContent = o.text;
		if (o.href) el.setAttribute('href', o.href);
		if (o.type) el.setAttribute('type', o.type);
		if (o.value !== undefined) (el as HTMLInputElement).value = o.value;
		for (const [k, v] of Object.entries(o.attr ?? {})) el.setAttribute(k, String(v));
		parent?.appendChild(el);
		return el;
	};

	const proto = win.HTMLElement.prototype as unknown as Record<string, unknown>;
	Object.assign(proto, {
		createEl(this: HTMLElement, tag: string, o?: ElInfo) {
			return make(tag, o, this);
		},
		createDiv(this: HTMLElement, o?: ElInfo) {
			return make('div', o, this);
		},
		createSpan(this: HTMLElement, o?: ElInfo) {
			return make('span', o, this);
		},
		empty(this: HTMLElement) {
			this.replaceChildren();
		},
		addClass(this: HTMLElement, cls: string) {
			this.classList.add(cls);
		},
		toggleClass(this: HTMLElement, cls: string, on: boolean) {
			this.classList.toggle(cls, on);
		},
		setText(this: HTMLElement, text: string) {
			this.textContent = text;
		},
		hide(this: HTMLElement) {
			this.style.display = 'none';
		},
		toggle(this: HTMLElement, on: boolean) {
			this.style.display = on ? '' : 'none';
		},
	});
	g.createEl = (tag: string, o?: ElInfo) => make(tag, o);
	return win;
}
