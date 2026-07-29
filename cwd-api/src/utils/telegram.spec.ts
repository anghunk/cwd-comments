import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendTelegramMessage, setTelegramWebhook } from './telegram';

describe('Telegram API responses', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns a successful response envelope', async () => {
		const payload = { ok: true, result: { message_id: 1 } };
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)));

		await expect(sendTelegramMessage('token', 'chat', 'hello')).resolves.toEqual(payload);
	});

	it('returns an error response envelope', async () => {
		const payload = { ok: false, error_code: 400, description: 'Bad Request' };
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload, { status: 400 })));

		await expect(setTelegramWebhook('token', 'https://example.com/webhook')).resolves.toEqual(payload);
	});
});
