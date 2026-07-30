/**
 * 状态管理 - 使用发布-订阅模式
 */

import { auth } from '../utils/auth.js';

// localStorage 键名
const STORAGE_KEY = 'cwd_user_info';

/**
 * 从 localStorage 读取用户信息
 * @returns {Object}
 */
function loadUserInfo() {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (data) {
			const parsed = JSON.parse(data);
			return {
				name: parsed.name || '',
				email: parsed.email || '',
				url: parsed.url || '',
			};
		}
	} catch (e) {}
	return { name: '', email: '', url: '' };
}

/**
 * 保存用户信息到 localStorage
 * @param {string} name - 昵称
 * @param {string} email - 邮箱
 * @param {string} url - 网址
 */
function saveUserInfo(name, email, url) {
	try {
		const data = { name, email, url };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch (e) {}
}

/**
 * 简单的 Store 类
 */
class Store {
	constructor(initialState) {
		this.state = { ...initialState };
		this.listeners = [];
	}

	/**
	 * 获取当前状态
	 * @returns {Object}
	 */
	getState() {
		return { ...this.state };
	}

	/**
	 * 更新状态
	 * @param {Object} updates - 要更新的属性
	 */
	setState(updates) {
		const prevState = { ...this.state };
		this.state = { ...this.state, ...updates };

		// 通知所有监听器
		this.listeners.forEach((listener) => {
			listener(this.state, prevState);
		});
	}

	/**
	 * 订阅状态变化
	 * @param {Function} listener - 监听器函数
	 * @returns {Function} - 取消订阅的函数
	 */
	subscribe(listener) {
		this.listeners.push(listener);

		// 返回取消订阅的函数
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}
}

/**
 * 创建评论状态管理 Store
 * @param {Object} config - 配置对象
 * @param {Function} fetchComments - 获取评论的函数
 * @param {Function} submitComment - 提交评论的函数
 * @param {Function} likeCommentFn - 点赞评论的函数
 * @returns {Object}
 */
export function createCommentStore(config, fetchComments, submitComment, likeCommentFn) {
	// 从 localStorage 加载用户信息
	const savedInfo = loadUserInfo();

	// 创建 store 实例
	const store = new Store({
		// 评论数据
		comments: [],
		loading: true,
		error: null,
		successMessage: '',

		// 分页
		pagination: {
			page: 1,
			limit: config.pageSize || 20,
			total: 0,
			totalCount: 0,
		},

		// 表单数据
		form: {
			name: savedInfo.name || '',
			email: savedInfo.email || '',
			url: savedInfo.url || '',
			content: '',
		},
		formErrors: {},
		submitting: false,

		// 回复状态
		replyingTo: null,
		replyContent: '',
		replyError: null,
		likeCount: 0,
		liked: false,
		commentLikeLoadingId: null,
	});

	// 监听用户信息变化，自动保存到 localStorage
	store.subscribe((state, prevState) => {
		if (
			state.form.name !== prevState.form.name ||
			state.form.email !== prevState.form.email ||
			state.form.url !== prevState.form.url
		) {
			saveUserInfo(state.form.name, state.form.email, state.form.url);
		}
	});

	/**
	 * 加载评论列表
	 * @param {number} page - 页码
	 */
	async function loadComments(page = 1) {
		store.setState({
			loading: true,
			error: null,
		});

		try {
			const response = await fetchComments(page, store.getState().pagination.limit);
			store.setState({
				comments: response.data,
				pagination: {
					page: response.pagination.page,
					limit: response.pagination.limit,
					total: response.pagination.total,
					totalCount: response.pagination.totalCount,
				},
				loading: false,
			});
		} catch (e) {
			store.setState({
				error: e instanceof Error ? e.message : '加载评论失败',
				loading: false,
			});
		}
	}

	function setLikeState(likeCount, liked) {
		const safeCount = typeof likeCount === 'number' && Number.isFinite(likeCount) && likeCount >= 0 ? likeCount : 0;
		store.setState({
			likeCount: safeCount,
			liked: !!liked,
		});
	}

	async function likeComment(commentId, isLike = true) {
		const state = store.getState();
		if (!likeCommentFn || state.commentLikeLoadingId === commentId) {
			return;
		}
		const id =
			typeof commentId === 'number'
				? commentId
				: typeof commentId === 'string' && commentId.trim()
				? Number.parseInt(commentId.trim(), 10)
				: NaN;
		if (!Number.isFinite(id) || id <= 0) {
			return;
		}
		store.setState({
			commentLikeLoadingId: id,
		});
		try {
			const safeComments = Array.isArray(state.comments) ? state.comments : [];
			const delta = isLike ? 1 : -1;
			const nextComments = safeComments.map((item) => {
				if (!item || typeof item.id !== 'number') {
					return item;
				}
				if (item.id === id) {
					const current =
						typeof item.likes === 'number' && Number.isFinite(item.likes) && item.likes >= 0
							? item.likes
							: 0;
					const nextLikes = Math.max(0, current + delta);
					return {
						...item,
						likes: nextLikes,
					};
				}
				if (Array.isArray(item.replies) && item.replies.length > 0) {
					const updatedReplies = item.replies.map((reply) => {
						if (!reply || typeof reply.id !== 'number') {
							return reply;
						}
						if (reply.id === id) {
							const current =
								typeof reply.likes === 'number' && Number.isFinite(reply.likes) && reply.likes >= 0
									? reply.likes
									: 0;
							const nextLikes = Math.max(0, current + delta);
							return {
								...reply,
								likes: nextLikes,
							};
						}
						return reply;
					});
					return {
						...item,
						replies: updatedReplies,
					};
				}
				return item;
			});
			store.setState({
				comments: nextComments,
			});
			await likeCommentFn(id, isLike);
		} catch (e) {
		} finally {
			const latest = store.getState();
			if (latest.commentLikeLoadingId === id) {
				store.setState({
					commentLikeLoadingId: null,
				});
			}
		}
	}

	/**
	 * 提交评论
	 */
	async function submitNewComment(turnstileToken = '') {
		const state = store.getState();
		const form = state.form;

		// 验证表单
		const { validateCommentForm } = await import('@/utils/validator.js');
		const validation = validateCommentForm(form);
		if (!validation.valid) {
			store.setState({
				formErrors: validation.errors,
			});
			return { success: false, resetTurnstile: false };
		}

		// 清空错误
		store.setState({
			formErrors: {},
			submitting: true,
			error: null,
			successMessage: '',
		});

		try {
			const result = await submitComment({
				name: form.name,
				email: form.email,
				url: form.url,
				content: form.content,
				adminToken: auth.getToken(), // Add token if exists
				turnstileToken,
			});

			const successMessage =
				result && typeof result.message === 'string'
					? result.message
					: config.requireReview
						? '已提交评论，待管理员审核后显示'
						: '评论已提交';

			store.setState({
				form: { ...form, content: '' },
				submitting: false,
				successMessage,
			});

			// 重新加载评论
			await loadComments(state.pagination.page);
			return { success: true, resetTurnstile: true };
		} catch (e) {
			store.setState({
				error: e instanceof Error ? e.message : '提交评论失败',
				submitting: false,
				successMessage: '',
			});
			return {
				success: false,
				resetTurnstile: !e || e.turnstileConsumed !== false,
			};
		}
	}

	/**
	 * 提交回复
	 * @param {number} parentId - 父评论 ID
	 */
	async function submitReply(parentId, turnstileToken = '') {
		const state = store.getState();

		// 验证回复内容
		if (!state.replyContent.trim()) {
			return { success: false, resetTurnstile: false };
		}

		// 验证用户信息
		const { validateReplyUserInfo } = await import('@/utils/validator.js');
		const validation = validateReplyUserInfo(state.form);
		if (!validation.valid) {
			const errorMessages = Object.values(validation.errors).join('；');
			store.setState({
				replyError: errorMessages,
			});
			return { success: false, resetTurnstile: false };
		}

		store.setState({
			formErrors: {},
			submitting: true,
			replyError: null,
		});

		try {
			await submitComment({
				name: state.form.name,
				email: state.form.email,
				url: state.form.url,
				content: state.replyContent,
				parentId,
				adminToken: auth.getToken(),
				turnstileToken,
			});

			// 清空回复内容并关闭回复框
			store.setState({
				replyContent: '',
				replyingTo: null,
				submitting: false,
			});

			// 重新加载评论
			await loadComments(state.pagination.page);
			return { success: true, resetTurnstile: true };
		} catch (e) {
			store.setState({
				error: e instanceof Error ? e.message : '提交回复失败',
				submitting: false,
			});
			return {
				success: false,
				resetTurnstile: !e || e.turnstileConsumed !== false,
			};
		}
	}

	/**
	 * 开始回复
	 * @param {number} commentId - 评论 ID
	 */
	function startReply(commentId) {
		store.setState({
			replyingTo: commentId,
			replyContent: '',
			replyError: null,
		});
	}

	/**
	 * 取消回复
	 */
	function cancelReply() {
		store.setState({
			replyingTo: null,
			replyContent: '',
			replyError: null,
		});
	}

	/**
	 * 更新表单字段
	 * @param {string} field - 字段名
	 * @param {string} value - 值
	 */
	function updateFormField(field, value) {
		const form = { ...store.getState().form };
		form[field] = value;
		store.setState({ form });
	}

	/**
	 * 更新回复内容
	 * @param {string} content - 回复内容
	 */
	function updateReplyContent(content) {
		store.setState({
			replyContent: content,
		});
	}

	/**
	 * 清除回复错误
	 */
	function clearReplyError() {
		store.setState({
			replyError: null,
		});
	}

	/**
	 * 清除错误
	 */
	function clearError() {
		store.setState({
			error: null,
		});
	}

	function clearSuccess() {
		store.setState({
			successMessage: '',
		});
	}

	/**
	 * 切换页码
	 * @param {number} page - 页码
	 */
	function goToPage(page) {
		const totalPages = store.getState().pagination.total;
		if (page >= 1 && page <= totalPages) {
			loadComments(page);
		}
	}

		return {
		// Store 实例
		store,

		// 计算属性方法
		getTotalPages: () => {
			const state = store.getState();
			return state.pagination.total;
		},

		// 操作方法
		loadComments,
		submitNewComment,
		submitReply,
		startReply,
		cancelReply,
		updateFormField,
		updateReplyContent,
		clearReplyError,
		clearError,
		clearSuccess,
		goToPage,
		setLikeState,
		likeComment,
	};
}
