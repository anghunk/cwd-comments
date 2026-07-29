const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileScriptPromise = null;

function waitForTurnstile(timeoutMs = 10000) {
	return new Promise((resolve, reject) => {
		const startedAt = Date.now();
		const timer = window.setInterval(() => {
			if (window.turnstile && typeof window.turnstile.render === 'function') {
				window.clearInterval(timer);
				resolve(window.turnstile);
				return;
			}
			if (Date.now() - startedAt >= timeoutMs) {
				window.clearInterval(timer);
				reject(new Error('Turnstile script timed out'));
			}
		}, 50);
	});
}

function loadTurnstileScript() {
	if (window.turnstile && typeof window.turnstile.render === 'function') {
		return Promise.resolve(window.turnstile);
	}
	if (turnstileScriptPromise) {
		return turnstileScriptPromise;
	}

	turnstileScriptPromise = new Promise((resolve, reject) => {
		let script = document.querySelector('script[data-cwd-turnstile]');
		if (!script) {
			script = document.createElement('script');
			script.src = TURNSTILE_SCRIPT_URL;
			script.async = true;
			script.defer = true;
			script.dataset.cwdTurnstile = 'true';
			document.head.appendChild(script);
		}

		const resolveWhenReady = () => {
			waitForTurnstile().then(resolve).catch(reject);
		};
		script.addEventListener('load', resolveWhenReady, { once: true });
		script.addEventListener('error', () => reject(new Error('Failed to load Turnstile script')), { once: true });

		if (window.turnstile) {
			resolveWhenReady();
		}
	}).catch((error) => {
		turnstileScriptPromise = null;
		throw error;
	});

	return turnstileScriptPromise;
}

/**
 * Explicitly renders a Cloudflare Turnstile challenge inside the widget Shadow DOM.
 */
export class TurnstileWidget {
	constructor(container, options = {}) {
		this.container = container;
		this.options = options;
		this.widgetId = null;
		this.token = '';
		this.destroyed = false;
	}

	async render() {
		if (!this.container || !this.options.siteKey || this.destroyed) {
			return;
		}

		try {
			const turnstile = await loadTurnstileScript();
			if (this.destroyed || !this.container.isConnected) {
				return;
			}
			this.widgetId = turnstile.render(this.container, {
				sitekey: this.options.siteKey,
				theme: this.options.theme === 'dark' ? 'dark' : 'light',
				size: 'flexible',
				action: 'comment',
				callback: (token) => this.setToken(token),
				'expired-callback': () => this.setToken(''),
				'timeout-callback': () => this.setToken(''),
				'error-callback': () => this.setToken(''),
			});
		} catch {
			if (!this.destroyed && this.container) {
				this.container.textContent = this.options.errorText || '';
				this.container.classList.add('cwd-turnstile-error');
			}
		}
	}

	setToken(token) {
		this.token = typeof token === 'string' ? token : '';
		if (this.options.onTokenChange) {
			this.options.onTokenChange(this.token);
		}
	}

	getToken() {
		return this.token;
	}

	reset() {
		this.setToken('');
		if (this.widgetId !== null && window.turnstile && typeof window.turnstile.reset === 'function') {
			window.turnstile.reset(this.widgetId);
		}
	}

	destroy() {
		this.destroyed = true;
		this.setToken('');
		if (this.widgetId !== null && window.turnstile && typeof window.turnstile.remove === 'function') {
			window.turnstile.remove(this.widgetId);
		}
		this.widgetId = null;
	}
}
