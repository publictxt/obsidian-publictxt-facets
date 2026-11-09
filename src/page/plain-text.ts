// A page's summary: Markdown reduced to plain text, then its first words.

export const SUMMARY_WORDS = 30;

const FRONT_MATTER_RE = /^---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** The note without its front matter block. */
export function stripFrontMatter(text: string): string {
	return text.replace(FRONT_MATTER_RE, '');
}

// An ATX level-1 heading line: `# Title`.
const H1_LINE_RE = /^[ \t]{0,3}#[ \t]+(.*?)[ \t]*$/;

/**
 * The note's title heading: an ATX level-1 heading on the first content
 * line, the first non-blank line after the front matter. Null when that
 * line is anything else, so a `# heading` further down is not a title.
 * `rest` is the body after that line.
 */
export function leadingH1(text: string): { heading: string; rest: string } | null {
	const body = stripFrontMatter(text);
	const m = /^(?:[ \t]*\r?\n)*([^\r\n]*)(?:\r?\n)?/.exec(body);
	const h = m ? H1_LINE_RE.exec(m[1]!) : null;
	if (!m || !h || !h[1]) return null;
	return { heading: h[1], rest: body.slice(m[0].length) };
}

/**
 * Markdown to plain text: fences, link syntax, emphasis and structural
 * markers dropped, the words kept. The order of the replacements matters:
 * HTML before links, links before inline code and emphasis, line-start
 * markers before whitespace is collapsed. Add a test before moving one.
 */
export function plainText(md: string): string {
	let s = md.replace(/\r\n?/g, '\n');
	s = s.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*$/gm, ''); // fence lines; code stays
	s = s.replace(/<!--[\s\S]*?-->/g, ' ');
	s = s.replace(/<[A-Za-z/][^>\n]*>/g, ' '); // HTML tags and autolinks
	s = s.replace(/!?\[\[([^\]]*?)\]\]/g, (_, t: string) => t.split('|').pop() ?? ''); // wikilinks
	s = s.replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1'); // links, images
	s = s.replace(/\[([^\]\n]*)\]\[[^\]\n]*\]/g, '$1'); // reference links
	s = s.replace(/`([^`\n]*)`/g, '$1'); // inline code
	s = s.replace(/^[ \t]*#{1,6}[ \t]+/gm, ''); // heading markers
	s = s.replace(/^[ \t]*>[ \t]?/gm, ''); // blockquotes
	s = s.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, ''); // lists, tasks
	s = s.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,}|={3,})[ \t]*$/gm, ''); // rules
	s = s.replace(/^[ \t|:-]*-{2,}[ \t|:-]*$/gm, ''); // table separators
	s = s.replace(/\*{1,3}|~~/g, ''); // emphasis
	s = s.replace(/(^|\W)_{1,3}(?=\w)/g, '$1').replace(/(\w)_{1,3}(?!\w)/g, '$1'); // _emphasis_, not snake_case
	s = s.replace(/\|/g, ' ');
	return s.replace(/\s+/g, ' ').trim();
}

/** The first `n` words of a plain-text string. */
export function firstWords(text: string, n = SUMMARY_WORDS): string {
	return text.split(' ').filter(Boolean).slice(0, n).join(' ');
}

/** The body's first words: no front matter, no title heading. */
export function deriveSummary(text: string, titleFromH1: boolean): string {
	const lead = titleFromH1 ? leadingH1(text) : null;
	return firstWords(plainText(lead ? lead.rest : stripFrontMatter(text)));
}

