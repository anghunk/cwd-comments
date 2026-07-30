import { describe, expect, it, vi } from 'vitest';
import { importBackup } from './importBackup';
import { importComments } from './importComments';

function createMockContext(body: unknown) {
	const statements: Array<{ sql: string; args: unknown[] }> = [];
	const db = {
		prepare(sql: string) {
			return {
				bind(...args: unknown[]) {
					const statement = { sql, args };
					statements.push(statement);
					return statement;
				},
				async run() {
					return { success: true };
				},
			};
		},
		batch: vi.fn().mockResolvedValue([]),
	};
	const context = {
		req: { json: vi.fn().mockResolvedValue(body) },
		env: { CWD_DB: db },
		json: vi.fn((payload, status) => ({ payload, status })),
	} as any;

	return { context, statements };
}

function findCommentInsert(statements: Array<{ sql: string; args: unknown[] }>) {
	return statements.find((statement) => statement.sql.startsWith('INSERT OR REPLACE INTO Comment'));
}

const comment = {
	id: 42,
	created: 1_700_000_000_000,
	post_slug: '/post/',
	post_url: 'https://example.com/post/',
	name: 'Reader',
	email: 'reader@example.com',
	content_text: 'Hello',
	content_html: '<p>Hello</p>',
};

describe('comment post_url imports', () => {
	it.each([
		['comment import', importComments, [comment]],
		['backup import', importBackup, { comments: [comment] }],
	])('preserves post_url through %s', async (_name, handler, body) => {
		const { context, statements } = createMockContext(body);

		await handler(context);

		const insert = findCommentInsert(statements);
		expect(insert?.sql).toContain('post_url');
		expect(insert?.args[3]).toBe(comment.post_url);
	});

	it('keeps old backups without post_url compatible', async () => {
		const { post_url: _postUrl, ...legacyComment } = comment;
		const { context, statements } = createMockContext({ comments: [legacyComment] });

		await importBackup(context);

		expect(findCommentInsert(statements)?.args[3]).toBeNull();
	});
});
