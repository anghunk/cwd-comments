import { describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from './turnstile';

describe('verifyTurnstileToken', () => {
	it('allows comments when Turnstile is not configured', async () => {
		const fetcher = vi.fn();

		await expect(verifyTurnstileToken({}, undefined, undefined, fetcher as typeof fetch)).resolves.toEqual({
			configured: false,
			success: true,
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('rejects a missing token without calling Siteverify', async () => {
		const fetcher = vi.fn();

		await expect(
			verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' }, '', '203.0.113.10', fetcher as typeof fetch)
		).resolves.toMatchObject({ configured: true, success: false, reason: 'missing-token' });
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('accepts a valid token for the expected action and hostname', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					success: true,
					hostname: 'example.com',
					action: 'comment',
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		);

		await expect(
			verifyTurnstileToken(
				{ TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_ALLOWED_HOSTNAMES: 'example.com, comments.example.com' },
				'token',
				'203.0.113.10',
				fetcher as typeof fetch
			)
		).resolves.toEqual({ configured: true, success: true });

		const request = fetcher.mock.calls[0];
		expect(request[0]).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		expect(String(request[1]?.body)).toContain('remoteip=203.0.113.10');
	});

	it('returns Siteverify error codes for an invalid token', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 })
		);

		await expect(
			verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' }, 'invalid-token', undefined, fetcher as typeof fetch)
		).resolves.toEqual({
			configured: true,
			success: false,
			reason: 'invalid-token',
			errorCodes: ['invalid-input-response'],
		});
	});

	it('fails closed when Siteverify is unavailable', async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error('network error'));

		await expect(
			verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' }, 'token', undefined, fetcher as typeof fetch)
		).resolves.toMatchObject({ success: false, reason: 'service-unavailable' });
	});

	it('rejects tokens issued for another action or hostname', async () => {
		const actionFetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: 'example.com', action: 'login' }), { status: 200 }));
		const hostnameFetcher = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ success: true, hostname: 'evil.example', action: 'comment' }), { status: 200 }));

		await expect(
			verifyTurnstileToken({ TURNSTILE_SECRET_KEY: 'secret' }, 'token', undefined, actionFetcher as typeof fetch)
		).resolves.toMatchObject({ success: false, reason: 'action-mismatch' });
		await expect(
			verifyTurnstileToken(
				{ TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_ALLOWED_HOSTNAMES: 'example.com' },
				'token',
				undefined,
				hostnameFetcher as typeof fetch
			)
		).resolves.toMatchObject({ success: false, reason: 'hostname-mismatch' });
	});
});
