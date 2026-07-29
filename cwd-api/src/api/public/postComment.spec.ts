import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/email', () => ({
	sendCommentNotification: vi.fn(),
	sendCommentReplyNotification: vi.fn(),
	isValidEmail: () => true,
	getAdminNotifyEmail: vi.fn(),
	loadEmailNotificationSettings: vi.fn(),
}));

vi.mock('../../utils/telegram', () => ({
	loadTelegramSettings: vi.fn(),
	sendTelegramMessage: vi.fn(),
}));

import { postComment } from './postComment';

describe('postComment Turnstile ordering', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('rejects a recent IP before calling Siteverify', async () => {
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);

		const first = vi.fn().mockResolvedValue({ created: Date.now() });
		const bind = vi.fn().mockReturnValue({ first });
		const prepare = vi.fn().mockReturnValue({ bind });
		const json = vi.fn((body, status) => ({ body, status }));
		const context = {
			req: {
				json: vi.fn().mockResolvedValue({
					post_slug: '/post',
					content: 'hello',
					name: 'Reader',
					email: 'reader@example.com',
					turnstileToken: 'token',
				}),
				header: (name: string) => (name === 'cf-connecting-ip' ? '203.0.113.10' : undefined),
			},
			env: {
				TURNSTILE_SECRET_KEY: 'secret',
				CWD_DB: { prepare },
			},
			json,
		} as any;

		await postComment(context);

		expect(json).toHaveBeenCalledWith(
			{ message: '评论频繁，等10s后再试', turnstileConsumed: false },
			429
		);
		expect(fetcher).not.toHaveBeenCalled();
		expect(prepare).toHaveBeenCalledTimes(1);
	});
});
