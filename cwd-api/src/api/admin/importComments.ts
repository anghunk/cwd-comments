import { Context } from 'hono';
import { Bindings } from '../../bindings';

export const importComments = async (c: Context<{ Bindings: Bindings }>) => {
	try {
		const body = await c.req.json();
		const rawComments = Array.isArray(body) ? body : [body];

		if (rawComments.length === 0) {
			return c.json({ message: '导入数据为空' }, 400);
		}

        // 映射 Twikoo / Artalk / Valine 数据结构到 CWD 结构
		const comments = rawComments.map((item: any) => {
			// Valine/LeanCloud 特征检测
			const isValine =
				item.objectId !== undefined &&
				item.insertedAt !== undefined &&
				item.nick !== undefined;
			// Twikoo 特征检测
			const isTwikoo =
				item.href !== undefined || item.comment !== undefined;
			// Artalk 特征检测 (page_key 是 Artalk 特有的)
			const isArtalk = item.page_key !== undefined && item.content !== undefined;

			if (isValine) {
				// Valine/LeanCloud 映射逻辑
				// 处理时间: insertedAt 是嵌套对象 { __type: "Date", iso: "ISO字符串" }
				let created = Date.now();
				if (item.insertedAt && item.insertedAt.iso) {
					created = new Date(item.insertedAt.iso).getTime();
				} else if (item.createdAt) {
					created = new Date(item.createdAt).getTime();
				}

				return {
					created, // >>> insertedAt.iso 转为时间戳
					post_slug: item.url || '', // >>> url
					post_url: item.url || '', // >>> url
					name: item.nick || 'Anonymous', // >>> nick
					email: item.mail || '', // >>> mail
					url: item.link || null, // >>> link
					ip_address: item.ip || null, // >>> ip
					device: null, // >>> 保持空
					os: null, // >>> 保持空
					browser: null, // >>> 保持空
					ua: item.ua || null, // >>> ua
					content_text: item.comment || '', // >>> comment
					content_html: item.comment || '', // >>> comment
					parent_id: null, // >>> 保持 null
					status: 'approved', // >>> 保持 "approved"
					site_id: item.site_id
				};
			}

			if (isArtalk) {
				// Artalk 映射逻辑
				// 处理 ID: Artalk ID 通常是数字
				let id = undefined;
				if (typeof item.id === 'number') {
					id = item.id;
				} else if (typeof item.id === 'string' && /^\d+$/.test(item.id)) {
					id = parseInt(item.id, 10);
				}

				// 处理时间
				let created = Date.now();
				if (item.created_at) {
					created = new Date(item.created_at).getTime();
				}

				return {
					id, // >>> id
					created, // >>> created_at 转为时间戳
					post_slug: item.page_key || '', // >>> page_key
					name: item.nick || 'Anonymous', // >>> nick
					email: item.email || '', // >>> email
					url: item.link || null, // >>> link
					ip_address: item.ip || null, // >>> ip
					device: null, // >>> 保持空
					os: null, // >>> 保持空
					browser: null, // >>> 保持空
					ua: item.ua || null, // >>> ua
					content_text: item.content || '', // >>> content
					content_html: item.content || '', // >>> content
					parent_id: null, // >>> 保持 null
					status: 'approved', // >>> 保持 "approved"
					site_id: item.site_id
				};
			}

			if (isTwikoo) {
				// 处理 ID: 如果 _id 是数字则保留，否则丢弃（让数据库自增）
                // Twikoo 的 _id 通常是 ObjectId 字符串，无法直接存入 INTEGER PRIMARY KEY
                // 除非 _id 恰好是数字
                let id = undefined;
                if (typeof item._id === 'number') {
                    id = item._id;
                } else if (typeof item._id === 'string' && /^\d+$/.test(item._id)) {
                    id = parseInt(item._id, 10);
                }

                // 处理时间
                let created = Date.now();
                if (item.created) {
                    // 支持时间戳或 ISO 字符串
                    created = new Date(item.created).getTime();
                }

                return {
                    id, // 可能为 undefined
                    created, // >>> created
                    post_slug: item.href || "", // >>> href
                    name: item.nick || "Anonymous", // >>> nick
                    email: item.mail || "", // >>> mail
                    url: item.link || null, // >>> link
                    ip_address: item.ip || null, // >>> ip
                    device: null, // >>> 保持空
                    os: null, // >>> 保持空
                    browser: null, // >>> 保持空
                    ua: item.ua || null, // >>> ua
                    content_text: item.comment || "", // >>> comment
                    content_html: item.comment || "", // >>> comment
                    parent_id: null, // >>> 保持 null
                    status: "approved", // >>> approved
                    site_id: item.site_id
                };
            }
            
            // 否则假设已经是 CWD 格式
            return item;
        });

        // 按 ID 升序排序，防止因外键约束导致插入失败（子评论先于父评论插入）
        // 对于 Twikoo 导入，id 可能不存在，或者被重置。
        // 如果 parent_id 全部为 null，则排序其实不重要（没有依赖）。
        comments.sort((a: any, b: any) => {
            const idA = a.id || 0;
            const idB = b.id || 0;
            return idA - idB;
        });

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
            
            return c.env.CWD_DB.prepare(sql).bind(...values);
		});

        // 批量执行，每批 50 条
        const BATCH_SIZE = 50;
        for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
            const batch = stmts.slice(i, i + BATCH_SIZE);
            await c.env.CWD_DB.batch(batch);
        }

		return c.json({ message: `成功导入 ${comments.length} 条评论` });
	} catch (e: any) {
        console.error(e);
		return c.json({ message: e.message || '导入失败' }, 500);
	}
};
