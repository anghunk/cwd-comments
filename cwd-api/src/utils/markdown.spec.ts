import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
	it('renders a single newline as a line break', async () => {
		await expect(parseMarkdown('first line\nsecond line')).resolves.toBe('<p>first line<br>second line</p>\n');
	});
});
