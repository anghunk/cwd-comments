import { Hono } from 'hono';
import { Bindings } from './bindings';
import { customCors } from './utils/cors';
import { adminAuth } from './utils/auth';
import { isValidEmail, loadEmailNotificationSettings, saveEmailNotificationSettings } from './utils/email';
import { loadFeatureSettings } from './utils/featureSettings';
import packageJson from '../../package.json';

import { getComments } from './api/public/getComments';
import { postComment } from './api/public/postComment';
import { verifyAdminKey } from './api/public/verifyAdminKey';
import { adminLogin } from './api/admin/login';
import { deleteComment } from './api/admin/deleteComment';
import { listComments } from './api/admin/listComments';
import { exportComments } from './api/admin/exportComments';
import { importComments } from './api/admin/importComments';
import { exportConfig } from './api/admin/exportConfig';
import { importConfig } from './api/admin/importConfig';
import { exportStats } from './api/admin/exportStats';
import { importStats } from './api/admin/importStats';
import { exportBackup } from './api/admin/exportBackup';
import { importBackup } from './api/admin/importBackup';
import { updateStatus } from './api/admin/updateStatus';
import { updateComment } from './api/admin/updateComment';
import { getAdminEmail } from './api/admin/getAdminEmail';
import { setAdminEmail } from './api/admin/setAdminEmail';
import { testEmail } from './api/admin/testEmail';
import { getStats } from './api/admin/getStats';
import { getSites } from './api/admin/getDomains';
import { trackVisit } from './api/public/trackVisit';
import { getPagePv } from './api/public/getPagePv';
import { getVisitOverview, getVisitPages } from './api/admin/visitAnalytics';
import { getLikeStatus, likePage } from './api/public/like';
import { likeComment } from './api/public/likeComment';
import { listLikes } from './api/admin/listLikes';
import { getLikeStats } from './api/admin/likeStats';
import { getFeatureSettings, updateFeatureSettings } from './api/admin/featureSettings';
import { getTelegramSettings, updateTelegramSettings, setupTelegramWebhook, testTelegramMessage } from './api/admin/telegramSettings';
import { getS3Settings, updateS3Settings } from './api/admin/s3Settings';
import { triggerS3Backup, listS3Backups, deleteS3BackupHandler, downloadS3BackupHandler } from './api/admin/triggerS3Backup';
import { telegramWebhook } from './api/telegram/webhook';
import { ensureSchema } from './utils/dbMigration';

const app = new Hono<{ Bindings: Bindings }>();
const VERSION = `${packageJson.version}`;

let MIGRATION_CHECKED = false;

const COMMENT_ADMIN_EMAIL_KEY = 'comment_admin_email';
const COMMENT_ADMIN_BADGE_KEY = 'comment_admin_badge';
const COMMENT_AVATAR_PREFIX_KEY = 'comment_avatar_prefix';
const COMMENT_ADMIN_ENABLED_KEY = 'comment_admin_enabled';
const COMMENT_ALLOWED_DOMAINS_KEY = 'comment_allowed_domains';
const COMMENT_ADMIN_KEY_HASH_KEY = 'comment_admin_key_hash';
const COMMENT_REQUIRE_REVIEW_KEY = 'comment_require_review';
const COMMENT_BLOCKED_IPS_KEY = 'comment_blocked_ips';
const COMMENT_BLOCKED_EMAILS_KEY = 'comment_blocked_emails';
const ADMIN_DISPLAY_CONFIG_KEY = 'admin_display_config';

type AdminDisplaySettings = {
	layoutTitle: string;
};

async function loadCommentSettings(env: Bindings) {
	await env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
	const keys = [
		COMMENT_ADMIN_EMAIL_KEY,
		COMMENT_ADMIN_BADGE_KEY,
		COMMENT_AVATAR_PREFIX_KEY,
		COMMENT_ADMIN_ENABLED_KEY,
		COMMENT_ALLOWED_DOMAINS_KEY,
		COMMENT_ADMIN_KEY_HASH_KEY,
		COMMENT_REQUIRE_REVIEW_KEY,
		COMMENT_BLOCKED_IPS_KEY,
		COMMENT_BLOCKED_EMAILS_KEY,
	];
	const { results } = await env.CWD_DB.prepare('SELECT key, value FROM Settings WHERE key IN (?, ?, ?, ?, ?, ?, ?, ?, ?)')
		.bind(...keys)
		.all<{ key: string; value: string }>();

	const map = new Map<string, string>();
	for (const row of results) {
		if (row && row.key) {
			map.set(row.key, row.value);
		}
	}

	const enabledRaw = map.get(COMMENT_ADMIN_ENABLED_KEY) ?? null;
	const adminEnabled = enabledRaw === '1';

	const requireReviewRaw = map.get(COMMENT_REQUIRE_REVIEW_KEY) ?? null;
	const requireReview = requireReviewRaw === '1';

	const blockedIpsRaw = map.get(COMMENT_BLOCKED_IPS_KEY) ?? '';
	const blockedIps = blockedIpsRaw
		? blockedIpsRaw
				.split(',')
				.map((d) => d.trim())
				.filter(Boolean)
		: [];

	const blockedEmailsRaw = map.get(COMMENT_BLOCKED_EMAILS_KEY) ?? '';
	const blockedEmails = blockedEmailsRaw
		? blockedEmailsRaw
				.split(',')
				.map((d) => d.trim())
				.filter(Boolean)
		: [];

	// 解析允许的域名列表
	const allowedDomainsRaw = map.get(COMMENT_ALLOWED_DOMAINS_KEY) ?? '';
	const allowedDomains = allowedDomainsRaw
		? allowedDomainsRaw
				.split(',')
				.map((d) => d.trim())
				.filter(Boolean)
		: [];

	return {
		adminEmail: map.get(COMMENT_ADMIN_EMAIL_KEY) ?? null,
		adminBadge: map.get(COMMENT_ADMIN_BADGE_KEY) ?? null,
		avatarPrefix: map.get(COMMENT_AVATAR_PREFIX_KEY) ?? null,
		adminEnabled,
		allowedDomains,
		requireReview,
		blockedIps,
		blockedEmails,
		adminKey: map.get(COMMENT_ADMIN_KEY_HASH_KEY) ?? null,
		adminKeySet: !!map.get(COMMENT_ADMIN_KEY_HASH_KEY),
	};
}

async function loadAdminDisplaySettings(env: Bindings): Promise<AdminDisplaySettings> {
	await env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
	const row = await env.CWD_DB.prepare('SELECT value FROM Settings WHERE key = ?')
		.bind(ADMIN_DISPLAY_CONFIG_KEY)
		.first<{ value: string }>();

	const defaults: AdminDisplaySettings = {
		layoutTitle: 'CWD 评论系统',
	};

	if (!row || !row.value) {
		return defaults;
	}

	try {
		const parsed = JSON.parse(row.value) as Partial<AdminDisplaySettings>;
		const result: AdminDisplaySettings = {
			layoutTitle: typeof parsed.layoutTitle === 'string' && parsed.layoutTitle ? parsed.layoutTitle : defaults.layoutTitle,
		};
		return result;
	} catch {
		return defaults;
	}
}

async function saveAdminDisplaySettings(env: Bindings, settings: Partial<AdminDisplaySettings>) {
	await env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();

	const current = await loadAdminDisplaySettings(env);
	const next: AdminDisplaySettings = {
		layoutTitle: settings.layoutTitle !== undefined ? settings.layoutTitle : current.layoutTitle,
	};

	const value = JSON.stringify(next);
	await env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(ADMIN_DISPLAY_CONFIG_KEY, value).run();
}

async function saveCommentSettings(
	env: Bindings,
	settings: {
		adminEmail?: string;
		adminBadge?: string;
		avatarPrefix?: string;
		adminEnabled?: boolean;
		allowedDomains?: string[];
		adminKey?: string;
		requireReview?: boolean;
		blockedIps?: string[];
		blockedEmails?: string[];
	}
) {
	await env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();

	let adminKeyValue: string | undefined;
	if (settings.adminKey !== undefined) {
		adminKeyValue = settings.adminKey;
	}

	const entries: { key: string; value: string | null | undefined }[] = [
		{ key: COMMENT_ADMIN_EMAIL_KEY, value: settings.adminEmail },
		{ key: COMMENT_ADMIN_BADGE_KEY, value: settings.adminBadge },
		{ key: COMMENT_AVATAR_PREFIX_KEY, value: settings.avatarPrefix },
		{
			key: COMMENT_ADMIN_ENABLED_KEY,
			value: typeof settings.adminEnabled === 'boolean' ? (settings.adminEnabled ? '1' : '0') : undefined,
		},
		{
			key: COMMENT_ALLOWED_DOMAINS_KEY,
			value: settings.allowedDomains ? settings.allowedDomains.join(',') : undefined,
		},
		{
			key: COMMENT_ADMIN_KEY_HASH_KEY,
			value: adminKeyValue,
		},
		{
			key: COMMENT_REQUIRE_REVIEW_KEY,
			value: typeof settings.requireReview === 'boolean' ? (settings.requireReview ? '1' : '0') : undefined,
		},
		{
			key: COMMENT_BLOCKED_IPS_KEY,
			value: settings.blockedIps ? settings.blockedIps.join(',') : undefined,
		},
		{
			key: COMMENT_BLOCKED_EMAILS_KEY,
			value: settings.blockedEmails ? settings.blockedEmails.join(',') : undefined,
		},
	];

	for (const entry of entries) {
		if (entry.value !== undefined) {
			const value = entry.value === null ? '' : entry.value;
			const trimmed = typeof value === 'string' ? value.trim() : value;
			if (trimmed) {
				await env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(entry.key, trimmed).run();
			} else {
				await env.CWD_DB.prepare('DELETE FROM Settings WHERE key = ?').bind(entry.key).run();
			}
		}
	}
}

app.use('*', async (c, next) => {
	if (!MIGRATION_CHECKED) {
		await ensureSchema(c.env);
		MIGRATION_CHECKED = true;
	}
	console.log('Request:start', {
		method: c.req.method,
		path: c.req.path,
		url: c.req.url,
		hasDb: !!c.env.CWD_DB,
		hasAuthKv: !!c.env.CWD_AUTH_KV,
	});
	const res = await next();
	console.log('Request:end', {
		method: c.req.method,
		path: c.req.path,
	});
	return res;
});

app.use('/api/*', async (c, next) => {
	const corsMiddleware = customCors();
	return corsMiddleware(c, next);
});
app.use('/admin/*', async (c, next) => {
	const corsMiddleware = customCors();
	return corsMiddleware(c, next);
});

app.get('/', (c) => {
	c.header('Access-Control-Allow-Origin', '*');
	return c.json({ version: VERSION, data: '成功部署 CWD 评论系统 API！文档地址 https://cwd.js.org' });
});

app.get('/api/comments', getComments);
app.post('/api/comments', postComment);
app.post('/api/verify-admin', verifyAdminKey);
app.post('/api/analytics/visit', trackVisit);
app.get('/api/analytics/pv', getPagePv);
app.get('/api/like', getLikeStatus);
app.post('/api/like', likePage);
app.post('/api/comments/like', likeComment);
app.delete('/api/comments/like', likeComment);
app.post('/api/telegram/webhook', telegramWebhook);
app.get('/api/config/comments', async (c) => {
	try {
		const settings = await loadCommentSettings(c.env);
		const featureSettings = await loadFeatureSettings(c.env);
		const { adminKey, adminKeySet, blockedIps, blockedEmails, ...publicSettings } = settings as any;
		const turnstileSiteKey = c.env.TURNSTILE_SECRET_KEY?.trim() ? c.env.TURNSTILE_SITE_KEY?.trim() || '' : '';

		return c.json({ ...publicSettings, ...featureSettings, turnstileSiteKey });
	} catch (e: any) {
		return c.json({ message: e.message || '加载评论配置失败' }, 500);
	}
});

app.post('/admin/login', adminLogin);
app.use('/admin/*', adminAuth);
app.delete('/admin/comments/delete', deleteComment);
app.get('/admin/comments/list', listComments);
app.get('/admin/comments/export', exportComments);
app.post('/admin/comments/import', importComments);
app.get('/admin/export/config', exportConfig);
app.post('/admin/import/config', importConfig);
app.get('/admin/export/stats', exportStats);
app.post('/admin/import/stats', importStats);
app.get('/admin/stats/comments', getStats);
app.get('/admin/export/backup', exportBackup);
app.post('/admin/import/backup', importBackup);
app.put('/admin/comments/status', updateStatus);
app.put('/admin/comments/update', updateComment);
app.get('/admin/analytics/overview', getVisitOverview);
app.get('/admin/analytics/pages', getVisitPages);
app.get('/admin/stats/sites', getSites);
app.get('/admin/likes/list', listLikes);
app.get('/admin/likes/stats', getLikeStats);
app.get('/admin/settings/features', getFeatureSettings);
app.put('/admin/settings/features', updateFeatureSettings);
app.get('/admin/settings/email', getAdminEmail);
app.put('/admin/settings/email', setAdminEmail);
app.get('/admin/settings/email-notify', async (c) => {
	try {
		const settings = await loadEmailNotificationSettings(c.env);
		return c.json(settings);
	} catch (e: any) {
		return c.json({ message: e.message || '加载邮件通知配置失败' }, 500);
	}
});
app.put('/admin/settings/email-notify', async (c) => {
	try {
		const body = await c.req.json();
		const globalEnabled = typeof body.globalEnabled === 'boolean' ? body.globalEnabled : undefined;
		const smtp = body.smtp && typeof body.smtp === 'object' ? body.smtp : undefined;
		const templates = body.templates && typeof body.templates === 'object' ? body.templates : undefined;

		await saveEmailNotificationSettings(c.env, {
			globalEnabled,
			smtp,
			templates,
		});

		return c.json({ message: '保存成功' });
	} catch (e: any) {
		return c.json({ message: e.message || '保存失败' }, 500);
	}
});

app.post('/admin/settings/email-test', testEmail);

app.get('/admin/settings/telegram', getTelegramSettings);
app.put('/admin/settings/telegram', updateTelegramSettings);
app.post('/admin/settings/telegram/setup', setupTelegramWebhook);
app.post('/admin/settings/telegram/test', testTelegramMessage);

app.get('/admin/settings/s3', getS3Settings);
app.put('/admin/settings/s3', updateS3Settings);
app.post('/admin/backup/s3', triggerS3Backup);
app.get('/admin/backup/s3/list', listS3Backups);
app.delete('/admin/backup/s3', deleteS3BackupHandler);
app.get('/admin/backup/s3/download', downloadS3BackupHandler);

app.get('/admin/settings/admin-display', async (c) => {
	try {
		const settings = await loadAdminDisplaySettings(c.env);
		return c.json(settings);
	} catch (e: any) {
		return c.json({ message: e.message || '加载显示配置失败' }, 500);
	}
});

app.put('/admin/settings/admin-display', async (c) => {
	try {
		const body = await c.req.json();
		const layoutTitle = typeof body.layoutTitle === 'string' ? body.layoutTitle : undefined;

		await saveAdminDisplaySettings(c.env, {
			layoutTitle,
		});

		return c.json({ message: '保存成功' });
	} catch (e: any) {
		return c.json({ message: e.message || '保存失败' }, 500);
	}
});

app.get('/admin/settings/comments', async (c) => {
	try {
		const settings = await loadCommentSettings(c.env);
		return c.json(settings);
	} catch (e: any) {
		return c.json({ message: e.message || '加载评论配置失败' }, 500);
	}
});
app.put('/admin/settings/comments', async (c) => {
	try {
		const body = await c.req.json();
		const rawAdminEmail = typeof body.adminEmail === 'string' ? body.adminEmail : '';
		const rawAdminBadge = typeof body.adminBadge === 'string' ? body.adminBadge : '';
		const rawAvatarPrefix = typeof body.avatarPrefix === 'string' ? body.avatarPrefix : '';
		const rawAdminEnabled = body.adminEnabled;
		const rawAllowedDomains = Array.isArray(body.allowedDomains) ? body.allowedDomains : [];
		const rawAdminKey = typeof body.adminKey === 'string' ? body.adminKey : undefined;
		const rawRequireReview = body.requireReview;
		const rawBlockedIps = Array.isArray(body.blockedIps) ? body.blockedIps : [];
		const rawBlockedEmails = Array.isArray(body.blockedEmails) ? body.blockedEmails : [];

		const adminEmail = rawAdminEmail.trim();
		const adminBadge = rawAdminBadge.trim();
		const avatarPrefix = rawAvatarPrefix.trim();
		const adminEnabled = typeof rawAdminEnabled === 'boolean' ? rawAdminEnabled : rawAdminEnabled === '1' || rawAdminEnabled === 1;
		const allowedDomains = rawAllowedDomains.map((d: any) => (typeof d === 'string' ? d.trim() : '')).filter(Boolean);
		const adminKey = rawAdminKey; // Can be undefined or empty string
		const requireReview = typeof rawRequireReview === 'boolean' ? rawRequireReview : rawRequireReview === '1' || rawRequireReview === 1;
		const blockedIps = rawBlockedIps.map((d: any) => (typeof d === 'string' ? d.trim() : '')).filter(Boolean);
		const blockedEmails = rawBlockedEmails.map((d: any) => (typeof d === 'string' ? d.trim() : '')).filter(Boolean);

		if (adminEmail && !isValidEmail(adminEmail)) {
			return c.json({ message: '邮箱格式不正确' }, 400);
		}

		await saveCommentSettings(c.env, {
			adminEmail,
			adminBadge,
			avatarPrefix,
			adminEnabled,
			allowedDomains,
			adminKey,
			requireReview,
			blockedIps,
			blockedEmails,
		});

		return c.json({ message: '保存成功' });
	} catch (e: any) {
		return c.json({ message: e.message || '保存失败' }, 500);
	}
});

app.post('/admin/comments/block-ip', async (c) => {
	try {
		const body = await c.req.json();
		const rawIp = typeof body.ip === 'string' ? body.ip : '';
		const ip = rawIp.trim();

		if (!ip) {
			return c.json({ message: 'IP 地址不能为空' }, 400);
		}

		await c.env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();

		const row = await c.env.CWD_DB.prepare('SELECT value FROM Settings WHERE key = ?')
			.bind(COMMENT_BLOCKED_IPS_KEY)
			.first<{ value: string }>();

		const existing = row?.value || '';
		const list = existing
			? existing
					.split(',')
					.map((d) => d.trim())
					.filter(Boolean)
			: [];

		if (!list.includes(ip)) {
			list.push(ip);
			const joined = list.join(',');
			await c.env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(COMMENT_BLOCKED_IPS_KEY, joined).run();
		}

		return c.json({ message: '已加入 IP 黑名单' });
	} catch (e: any) {
		return c.json({ message: e.message || '操作失败' }, 500);
	}
});

app.post('/admin/comments/block-email', async (c) => {
	try {
		const body = await c.req.json();
		const rawEmail = typeof body.email === 'string' ? body.email : '';
		const email = rawEmail.trim();

		if (!email) {
			return c.json({ message: '邮箱不能为空' }, 400);
		}

		if (!isValidEmail(email)) {
			return c.json({ message: '邮箱格式不正确' }, 400);
		}

		await c.env.CWD_DB.prepare('CREATE TABLE IF NOT EXISTS Settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();

		const row = await c.env.CWD_DB.prepare('SELECT value FROM Settings WHERE key = ?')
			.bind(COMMENT_BLOCKED_EMAILS_KEY)
			.first<{ value: string }>();

		const existing = row?.value || '';
		const list = existing
			? existing
					.split(',')
					.map((d) => d.trim())
					.filter(Boolean)
			: [];

		if (!list.includes(email)) {
			list.push(email);
			const joined = list.join(',');
			await c.env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)').bind(COMMENT_BLOCKED_EMAILS_KEY, joined).run();
		}

		return c.json({ message: '已加入邮箱黑名单' });
	} catch (e: any) {
		return c.json({ message: e.message || '操作失败' }, 500);
	}
});

export default app;
