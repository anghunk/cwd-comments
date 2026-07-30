import { Bindings } from '../bindings';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const EXPECTED_ACTION = 'comment';

type TurnstileSiteverifyResponse = {
	success?: boolean;
	hostname?: string;
	action?: string;
	'error-codes'?: string[];
};

export type TurnstileVerificationResult = {
	configured: boolean;
	success: boolean;
	reason?: 'missing-token' | 'invalid-token' | 'hostname-mismatch' | 'action-mismatch' | 'service-unavailable';
	errorCodes?: string[];
};

function parseAllowedHostnames(raw: string | undefined): string[] {
	return (raw || '')
		.split(',')
		.map((hostname) => hostname.trim().toLowerCase())
		.filter(Boolean);
}

/**
 * Verifies a single-use Turnstile token before accepting a comment.
 */
export async function verifyTurnstileToken(
	env: Pick<Bindings, 'TURNSTILE_SECRET_KEY' | 'TURNSTILE_ALLOWED_HOSTNAMES'>,
	token: unknown,
	remoteIp?: string,
	fetcher: typeof fetch = fetch
): Promise<TurnstileVerificationResult> {
	const secret = env.TURNSTILE_SECRET_KEY?.trim();
	if (!secret) {
		return { configured: false, success: true };
	}

	if (typeof token !== 'string' || !token.trim()) {
		return { configured: true, success: false, reason: 'missing-token' };
	}
	if (token.length > 2048) {
		return { configured: true, success: false, reason: 'invalid-token' };
	}

	const body = new URLSearchParams({
		secret,
		response: token.trim(),
	});
	if (remoteIp) {
		body.set('remoteip', remoteIp);
	}

	let response: Response;
	try {
		response = await fetcher(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		});
	} catch {
		return { configured: true, success: false, reason: 'service-unavailable' };
	}

	if (!response.ok) {
		return { configured: true, success: false, reason: 'service-unavailable' };
	}

	let result: TurnstileSiteverifyResponse;
	try {
		result = (await response.json()) as TurnstileSiteverifyResponse;
	} catch {
		return { configured: true, success: false, reason: 'service-unavailable' };
	}

	if (!result.success) {
		return {
			configured: true,
			success: false,
			reason: 'invalid-token',
			errorCodes: Array.isArray(result['error-codes']) ? result['error-codes'] : [],
		};
	}

	if (result.action !== EXPECTED_ACTION) {
		return { configured: true, success: false, reason: 'action-mismatch' };
	}

	const allowedHostnames = parseAllowedHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES);
	if (allowedHostnames.length > 0) {
		const hostname = result.hostname?.trim().toLowerCase() || '';
		if (!allowedHostnames.includes(hostname)) {
			return { configured: true, success: false, reason: 'hostname-mismatch' };
		}
	}

	return { configured: true, success: true };
}
