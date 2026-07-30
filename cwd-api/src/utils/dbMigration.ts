import { Bindings } from '../bindings';

export async function ensureSchema(env: Bindings) {
	try {
		// 1. Check and migrate page_stats
		const statsInfo = await env.CWD_DB.prepare('PRAGMA table_info(page_stats)').all();
		const statsColumns = (statsInfo.results || []) as any[];
		const hasStatsSiteId = statsColumns.some((col) => col.name === 'site_id');

		if (!hasStatsSiteId && statsColumns.length > 0) {
			console.log('Migrating page_stats table...');
			// Create new table with site_id and composite unique constraint
			await env.CWD_DB.prepare(
				`CREATE TABLE page_stats_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT, 
					site_id TEXT NOT NULL DEFAULT '', 
					post_slug TEXT NOT NULL, 
					post_title TEXT, 
					post_url TEXT, 
					pv INTEGER NOT NULL DEFAULT 0, 
					last_visit_at INTEGER, 
					created_at INTEGER NOT NULL, 
					updated_at INTEGER NOT NULL, 
					UNIQUE(site_id, post_slug)
				)`
			).run();

			// Copy data
			await env.CWD_DB.prepare(
				`INSERT INTO page_stats_new (post_slug, post_title, post_url, pv, last_visit_at, created_at, updated_at) 
				 SELECT post_slug, post_title, post_url, pv, last_visit_at, created_at, updated_at FROM page_stats`
			).run();

			// Drop old table
			await env.CWD_DB.prepare('DROP TABLE page_stats').run();

			// Rename new table
			await env.CWD_DB.prepare('ALTER TABLE page_stats_new RENAME TO page_stats').run();
			console.log('Migrated page_stats table successfully.');
		} else if (statsColumns.length === 0) {
            // Table doesn't exist, create it directly
            await env.CWD_DB.prepare(
				`CREATE TABLE IF NOT EXISTS page_stats (
					id INTEGER PRIMARY KEY AUTOINCREMENT, 
					site_id TEXT NOT NULL DEFAULT '', 
					post_slug TEXT NOT NULL, 
					post_title TEXT, 
					post_url TEXT, 
					pv INTEGER NOT NULL DEFAULT 0, 
					last_visit_at INTEGER, 
					created_at INTEGER NOT NULL, 
					updated_at INTEGER NOT NULL, 
					UNIQUE(site_id, post_slug)
				)`
			).run();
        }

		// 2. Check and migrate page_visit_daily
		const dailyInfo = await env.CWD_DB.prepare('PRAGMA table_info(page_visit_daily)').all();
		const dailyColumns = (dailyInfo.results || []) as any[];
		const hasDailySiteId = dailyColumns.some((col) => col.name === 'site_id');

		if (!hasDailySiteId && dailyColumns.length > 0) {
			console.log('Migrating page_visit_daily table...');
			await env.CWD_DB.prepare('ALTER TABLE page_visit_daily ADD COLUMN site_id TEXT NOT NULL DEFAULT ""').run();
			console.log('Migrated page_visit_daily table successfully.');
		} else if (dailyColumns.length === 0) {
            await env.CWD_DB.prepare(
                `CREATE TABLE IF NOT EXISTS page_visit_daily (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    date TEXT NOT NULL, 
                    domain TEXT, 
                    count INTEGER NOT NULL DEFAULT 0, 
                    created_at INTEGER NOT NULL, 
                    updated_at INTEGER NOT NULL,
                    site_id TEXT NOT NULL DEFAULT ''
                )`
            ).run();
        }

		// 3. Check and migrate Likes
		const likesInfo = await env.CWD_DB.prepare('PRAGMA table_info(Likes)').all();
		const likesColumns = (likesInfo.results || []) as any[];
		const hasLikesSiteId = likesColumns.some((col) => col.name === 'site_id');

		if (!hasLikesSiteId && likesColumns.length > 0) {
			console.log('Migrating Likes table...');
			await env.CWD_DB.prepare(
				`CREATE TABLE Likes_new (
					id INTEGER PRIMARY KEY AUTOINCREMENT, 
					site_id TEXT NOT NULL DEFAULT '',
					page_slug TEXT NOT NULL, 
					user_id TEXT NOT NULL, 
					created_at INTEGER NOT NULL, 
					UNIQUE(site_id, page_slug, user_id)
				)`
			).run();

			await env.CWD_DB.prepare(
				`INSERT INTO Likes_new (page_slug, user_id, created_at) 
				 SELECT page_slug, user_id, created_at FROM Likes`
			).run();

			await env.CWD_DB.prepare('DROP TABLE Likes').run();
			await env.CWD_DB.prepare('ALTER TABLE Likes_new RENAME TO Likes').run();
			console.log('Migrated Likes table successfully.');
		} else if (likesColumns.length === 0) {
			await env.CWD_DB.prepare(
				`CREATE TABLE IF NOT EXISTS Likes (
					id INTEGER PRIMARY KEY AUTOINCREMENT, 
					site_id TEXT NOT NULL DEFAULT '',
					page_slug TEXT NOT NULL, 
					user_id TEXT NOT NULL, 
					created_at INTEGER NOT NULL, 
					UNIQUE(site_id, page_slug, user_id)
				)`
			).run();
		}

		// 4. Check and migrate Comment
		const commentInfo = await env.CWD_DB.prepare('PRAGMA table_info(Comment)').all();
		const commentColumns = (commentInfo.results || []) as any[];
		const hasCommentPostUrl = commentColumns.some((col) => col.name === 'post_url');

		if (!hasCommentPostUrl && commentColumns.length > 0) {
			console.log('Migrating Comment table...');
			await env.CWD_DB.prepare('ALTER TABLE Comment ADD COLUMN post_url TEXT').run();
			console.log('Migrated Comment table successfully.');
		}

		// 5. Create Indexes
		await env.CWD_DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_stats_site_id ON page_stats(site_id)').run();
		await env.CWD_DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_visit_daily_site_id ON page_visit_daily(site_id)').run();
		await env.CWD_DB.prepare('CREATE INDEX IF NOT EXISTS idx_likes_site_id ON Likes(site_id)').run();
        // Also ensure Comment index exists (just in case)
        await env.CWD_DB.prepare('CREATE INDEX IF NOT EXISTS idx_site_id ON Comment(site_id)').run();

	} catch (e) {
		console.error('Database migration failed:', e);
		// Don't throw, to allow app to start, but log error. 
        // Or maybe we should throw? If schema is wrong, queries will fail anyway.
        // For now, log error.
	}
}
