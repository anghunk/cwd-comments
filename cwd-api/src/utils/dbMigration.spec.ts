import { describe, expect, it, vi } from 'vitest';
import { ensureSchema } from './dbMigration';

function createMockEnv(commentColumns: Array<{ name: string }>) {
	const executedSql: string[] = [];
	const prepare = vi.fn((sql: string) => ({
		async all() {
			if (sql === 'PRAGMA table_info(Comment)') {
				return { results: commentColumns };
			}
			return { results: [{ name: 'site_id' }] };
		},
		async run() {
			executedSql.push(sql);
			return { success: true };
		},
	}));

	return {
		env: { CWD_DB: { prepare } } as any,
		executedSql,
	};
}

describe('ensureSchema Comment.post_url migration', () => {
	it('adds post_url to an existing Comment table when it is missing', async () => {
		const { env, executedSql } = createMockEnv([{ name: 'id' }, { name: 'post_slug' }]);

		await ensureSchema(env);

		expect(executedSql).toContain('ALTER TABLE Comment ADD COLUMN post_url TEXT');
	});

	it('does not alter Comment when post_url already exists', async () => {
		const { env, executedSql } = createMockEnv([{ name: 'id' }, { name: 'post_url' }]);

		await ensureSchema(env);

		expect(executedSql).not.toContain('ALTER TABLE Comment ADD COLUMN post_url TEXT');
	});
});
