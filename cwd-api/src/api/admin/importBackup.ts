import { Context } from 'hono';
import { Bindings } from '../../bindings';
import { saveConfigs } from './importConfig';
import { saveStatsData } from './importStats';

const saveComments = async (env: Bindings, comments: any[]) => {
    if (!Array.isArray(comments) || comments.length === 0) {
        return;
    }

    const stmts = comments.map((comment: any) => {
        const {
            id,
            created,
            post_slug,
            post_url,
            name,
            email,
            url,
            ip_address,
            device,
            os,
            browser,
            ua,
            content_text,
            content_html,
            parent_id,
				status,
				likes,
				site_id
			} = comment;

            const fields = [
                'created', 'post_slug', 'post_url', 'name', 'email', 'url',
                'ip_address', 'device', 'os', 'browser', 'ua',
                'content_text', 'content_html', 'parent_id', 'status', 'likes', 'site_id'
            ];
            const values = [
                created || Date.now(),
                post_slug || "",
                post_url || null,
                name || "Anonymous",
                email || "",
                url || null,
                ip_address || null,
                device || null,
                os || null,
                browser || null,
                ua || null,
                content_text || "",
                content_html || "",
                parent_id || null,
                status || "approved",
                typeof likes === 'number' && Number.isFinite(likes) && likes >= 0 ? likes : 0,
                site_id || ""
            ];

        if (id !== undefined && id !== null) {
            fields.unshift('id');
            values.unshift(id);
        }

        const placeholders = fields.map(() => '?').join(', ');
        const sql = `INSERT OR REPLACE INTO Comment (${fields.join(', ')}) VALUES (${placeholders})`;
        
        return env.CWD_DB.prepare(sql).bind(...values);
    });

    // Batch execute
    const BATCH_SIZE = 50;
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
        const batch = stmts.slice(i, i + BATCH_SIZE);
        await env.CWD_DB.batch(batch);
    }
};

export const importBackup = async (c: Context<{ Bindings: Bindings }>) => {
    try {
        const body = await c.req.json();
        
        if (!body || typeof body !== 'object') {
            return c.json({ message: '数据格式错误' }, 400);
        }

        let message = '导入结果：';

        // 1. Comments
        if (Array.isArray(body.comments) && body.comments.length > 0) {
            await saveComments(c.env, body.comments);
            message += ` 评论 ${body.comments.length} 条;`;
        }

        // 2. Settings
        if (Array.isArray(body.settings) && body.settings.length > 0) {
            await saveConfigs(c.env, body.settings);
            message += ` 配置 ${body.settings.length} 条;`;
        }

        // 3. Stats
        // Pass the whole body as it expects { page_stats, ... }
        await saveStatsData(c.env, body);
        const statsCount = (body.page_stats?.length || 0) + (body.page_visit_daily?.length || 0) + (body.likes?.length || 0);
        if (statsCount > 0) {
            message += ` 统计数据 ${statsCount} 条;`;
        }

        return c.json({ message });
    } catch (e: any) {
        console.error(e);
        return c.json({ message: e.message || '全量导入失败' }, 500);
    }
};
