import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiClient } from './api.js';

test('submitComment exposes whether Turnstile was consumed', async (t) => {
	const originalFetch = globalThis.fetch;
	t.after(() => {
		globalThis.fetch = originalFetch;
	});

	globalThis.fetch = async () =>
		new Response(
			JSON.stringify({
				message: '评论频繁，等10s后再试',
				turnstileConsumed: false,
			}),
			{ status: 429, statusText: 'Too Many Requests' }
		);

	const api = createApiClient({
		apiBaseUrl: 'https://comments.example.com',
		postSlug: '/post',
	});

	await assert.rejects(
		api.submitComment({
			name: 'Reader',
			email: 'reader@example.com',
			content: 'hello',
			turnstileToken: 'token',
		}),
		(error) => {
			assert.equal(error.status, 429);
			assert.equal(error.turnstileConsumed, false);
			return true;
		}
	);
});
