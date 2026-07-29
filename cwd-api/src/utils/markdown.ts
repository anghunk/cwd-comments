import { marked } from 'marked';

/**
 * Parse comment Markdown with the same line-break behavior as the widget preview.
 */
export const parseMarkdown = async (content: string): Promise<string> =>
	marked.parse(content, {
		async: true,
		gfm: true,
		breaks: true,
	});
