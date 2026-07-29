/**
 * API 请求封装
 */

/**
 * 创建 API 客户端
 * @param {Object} config - 配置对象
 * @param {string} config.apiBaseUrl - API 基础地址
 * @param {string} config.postSlug - 文章标识符
 * @param {string} config.postTitle - 文章标题（可选）
 * @param {string} config.postUrl - 文章 URL（可选）
	 * @returns {Object}
 */
export function createApiClient(config) {
	const baseUrl = config.apiBaseUrl.replace(/\/$/, '');

	function getLikeUserId() {
		try {
			const storageKey = 'cwd_like_uid';
			let token = localStorage.getItem(storageKey);
			if (!token) {
				if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
					token = crypto.randomUUID();
				} else {
					token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
				}
				localStorage.setItem(storageKey, token);
			}
			return token;
		} catch (e) {
			return 'anonymous';
		}
	}

	/**
	 * 获取评论列表
	 * @param {number} page - 页码
	 * @param {number} limit - 每页数量
	 * @returns {Promise<Object>}
	 */
	async function fetchComments(page = 1, limit = 20) {
		const params = new URLSearchParams({
			post_slug: config.postSlug,
			page: page.toString(),
			limit: limit.toString(),
			nested: 'true',
		});

		if (config.avatarPrefix) {
			params.set('avatar_prefix', config.avatarPrefix);
		}

		if (config.siteId) {
			params.set('site_id', config.siteId);
		}

		const response = await fetch(`${baseUrl}/api/comments?${params}`);
		if (!response.ok) {
			throw new Error(`获取评论失败：${response.status} ${response.statusText}`);
		}
		return response.json();
	}

	/**
	 * 提交评论
	 * @param {Object} data - 评论数据
	 * @param {string} data.name - 昵称
	 * @param {string} data.email - 邮箱
	 * @param {string} data.url - 网址（可选）
	 * @param {string} data.content - 评论内容
	 * @param {number} data.parentId - 父评论 ID（可选，用于回复）
	 * @returns {Promise<Object>}
	 */
	async function submitComment(data) {
		const response = await fetch(`${baseUrl}/api/comments`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				post_slug: config.postSlug,
				post_title: config.postTitle,
				post_url: config.postUrl,
				name: data.name,
				email: data.email,
				url: data.url || undefined,
				content: data.content,
				parent_id: data.parentId,
				adminToken: data.adminToken,
				turnstileToken: data.turnstileToken,
				site_id: config.siteId
			}),
		});

		if (!response.ok) {
			let msg = response.statusText;
			let turnstileConsumed = true;
			try {
				const json = await response.json();
				if (json.message) msg = json.message;
				turnstileConsumed = json.turnstileConsumed !== false;
			} catch (e) {}
			const error = new Error(msg);
			error.status = response.status;
			error.turnstileConsumed = turnstileConsumed;
			throw error;
		}
		return response.json();
	}

    async function verifyAdminKey(key) {
        const response = await fetch(`${baseUrl}/api/verify-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminToken: key })
        });
        if (!response.ok) {
             let msg = response.statusText;
            try {
                const json = await response.json();
                if (json.message) msg = json.message;
            } catch (e) {}
			throw new Error(msg);
        }
        return response.json();
    }

    async function trackVisit() {
        try {
            const body = {
                postSlug: config.postUrl || config.postSlug,
                postTitle: config.postTitle,
                postUrl: config.postUrl
            };
            if (config.siteId) {
                body.siteId = config.siteId;
            }
            await fetch(`${baseUrl}/api/analytics/visit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
        } catch (e) {
        }
    }

    async function getLikeStatus() {
        const params = new URLSearchParams({
            post_slug: config.postUrl
        });
        const headers = {
            'X-CWD-Like-User': getLikeUserId()
        };
        const response = await fetch(`${baseUrl}/api/like?${params.toString()}`, {
            method: 'GET',
            headers
        });
        if (!response.ok) {
            return {
                liked: false,
                alreadyLiked: false,
                totalLikes: 0
            };
        }
        return response.json();
    }

    async function likePage() {
        const headers = {
            'Content-Type': 'application/json',
            'X-CWD-Like-User': getLikeUserId()
        };
        const response = await fetch(`${baseUrl}/api/like`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                postSlug: config.postSlug,
                postTitle: config.postTitle,
                postUrl: config.postUrl
            })
        });
        if (!response.ok) {
            let msg = response.statusText;
            try {
                const json = await response.json();
                if (json.message) msg = json.message;
            } catch (e) {}
            throw new Error(msg);
        }
        return response.json();
    }

    async function likeComment(commentId, isLike = true) {
        const id =
            typeof commentId === 'number'
                ? commentId
                : typeof commentId === 'string' && commentId.trim()
                ? Number.parseInt(commentId.trim(), 10)
                : NaN;
        if (!Number.isFinite(id) || id <= 0) {
            throw new Error('Invalid comment id');
        }
        const method = isLike ? 'POST' : 'DELETE';
        const response = await fetch(`${baseUrl}/api/comments/like`, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
        });
        if (!response.ok) {
            let msg = response.statusText;
            try {
                const json = await response.json();
                if (json.message) msg = json.message;
            } catch (e) {}
            throw new Error(msg);
        }
        return response.json();
    }

    async function getPagePv() {
        const params = new URLSearchParams({
            post_slug: config.postUrl || config.postSlug
        });

        if (config.siteId) {
            params.set('siteId', config.siteId);
        }

        const response = await fetch(`${baseUrl}/api/analytics/pv?${params}`);

        if (!response.ok) {
            return { pv: 0, postSlug: config.postSlug };
        }

        return response.json();
    }

		return {
		fetchComments,
		submitComment,
        verifyAdminKey,
        trackVisit,
        getLikeStatus,
        likePage,
        likeComment,
        getPagePv
	};
}
