/**
 * CommentItem 评论项组件
 */

import { Component } from './Component.js';
import { ReplyEditor } from './ReplyEditor.js';
import { formatRelativeTime } from '@/utils/date.js';
import { replaceEmojiInHtml } from '@/utils/markdown.js';

export class CommentItem extends Component {
	// 防抖缓存，防止连续点击
	static _likeDebounce = new Map();
	// 用户标识缓存（单例，确保一致性）
	static _userId = null;

	/**
	 * @param {HTMLElement|string} container - 容器元素或选择器
	 * @param {Object} props - 组件属性
	 * @param {Object} props.comment - 评论数据
	 * @param {boolean} props.isReply - 是否为回复
	 * @param {number|null} props.replyingTo - 当前正在回复的评论 ID
	 * @param {string} props.replyContent - 回复内容
	 * @param {string|null} props.replyError - 回复错误
	 * @param {boolean} props.submitting - 是否正在提交
	 * @param {string} props.adminEmail - 博主邮箱（可选）
	 * @param {string} props.adminBadge - 博主标识文字（可选）
	 * @param {Function} props.onReply - 回复回调
	 * @param {Function} props.onSubmitReply - 提交回复回调
	 * @param {Function} props.onCancelReply - 取消回复回调
	 * @param {Function} props.onUpdateReplyContent - 更新回复内容回调
	 * @param {Function} props.onClearReplyError - 清除回复错误回调
	 */
	constructor(container, props = {}) {
		super(container, props);
		this.t = props.t || ((k) => k);
		this.replyEditor = null;
		this.childCommentItems = []; // 缓存嵌套回复的 CommentItem 实例
	}

	render() {
		this.replyEditor?.destroy();
		this.childCommentItems.forEach((item) => item.destroy());
		this.replyEditor = null;
		this.childCommentItems = [];
		const { comment, isReply, adminEmail, adminBadge } = this.props;
		const isPinned = typeof comment.priority === 'number' && comment.priority > 1;
		const isReplying = this.props.replyingTo === comment.id;
		// 使用后端返回的 isAdmin 字段，不再依赖前端邮箱比对
		const isAdmin = !!comment.isAdmin;

		const root = this.createElement('div', {
			className: `cwd-comment-item ${isReply ? 'cwd-comment-reply' : ''}`,
			children: [
				// 头像
				this.createElement('div', {
					className: 'cwd-comment-avatar',
					children: [
						this.createElement('img', {
							attributes: {
								src: comment.avatar,
								alt: comment.name,
								loading: 'lazy',
							},
						}),
					],
				}),

				// 主体内容
				this.createElement('div', {
					className: 'cwd-comment-body',
					children: [
						// 头部（作者名、操作按钮、时间）
						this.createElement('div', {
							className: 'cwd-comment-header',
							children: [
								// 作者信息
								this.createElement('div', {
									className: 'cwd-comment-author',
									children: [
										comment.url
											? this.createElement('span', {
													className: 'cwd-author-name',
													children: [
														this.createElement('a', {
															attributes: {
																href: comment.url,
																target: '_blank',
																rel: 'noopener noreferrer',
															},
															text: comment.name,
														}),
													],
												})
											: this.createTextElement('span', comment.name, 'cwd-author-name'),
										...(isAdmin
											? [
													adminBadge
														? this.createTextElement('span', `${adminBadge}`, 'cwd-admin-badge')
														: this.createElement('span', {
																className: 'cwd-admin-badge cwd-admin-badge-icon',
																attributes: {
																	title: '网站管理员',
																},
																html: '<svg viewBox="0 0 22 22" aria-label="网站管理员" role="img" class="cwd-admin-icon" style="width:15px;height:15px;fill:currentColor;vertical-align:-0.15em;"><g><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"></path></g></svg>',
															}),
												]
											: []),
										...(isPinned ? [this.createTextElement('span', '置顶', 'cwd-pin-badge')] : []),
										// 显示回复目标
										...(comment.replyToAuthor
											? [
													this.createTextElement('span', ` ${this.t('reply')} `, 'cwd-reply-to-separator'),
													this.createTextElement('span', comment.replyToAuthor, 'cwd-reply-to-author'),
												]
											: []),
									],
								}),

								// 操作区域
								this.createElement('div', {
									className: 'cwd-comment-actions',
									children: [
										this.createElement('span', {
											className: 'cwd-action-btn',
											attributes: {
												onClick: () => this.handleReply(),
											},
											text: this.t('reply'),
										}),
										...(this.props.enableCommentLike !== false
											? [
													this.createElement('div', {
														className: 'cwd-comment-like',
														children: [
															this.createElement('button', {
																className: `cwd-comment-like-button${this.hasLiked(comment.id) ? ' cwd-comment-like-button-liked' : ''}`,
																attributes: {
																	type: 'button',
																	'aria-label': this.hasLiked(comment.id) ? '取消点赞' : '点赞',
																	onClick: () => this.handleLikeComment(),
																},
																children: [
																	this.createElement('span', {
																		className: 'cwd-comment-like-icon-wrapper',
																		children: [
																			this.createElement('svg', {
																				className: 'cwd-comment-like-icon',
																				attributes: {
																					viewBox: '0 0 24 24',
																					'aria-hidden': 'true',
																					fill: this.hasLiked(comment.id) ? 'currentColor' : 'none',
																				},
																				children: [
																					this.createElement('path', {
																						attributes: {
																							d: 'M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13 1 7.59 6.41C7.22 6.78 7 7.3 7 7.83V19c0 1.1.9 2 2 2h8c.78 0 1.48-.45 1.82-1.11l3.02-7.05c.11-.23.16-.48.16-.74v-2z',
																						},
																					}),
																				],
																			}),
																		],
																	}),
																	...(() => {
																		const likeCount =
																			typeof comment.likes === 'number' && Number.isFinite(comment.likes) && comment.likes >= 0
																				? comment.likes
																				: 0;
																		return likeCount >= 1
																			? [this.createTextElement('span', String(likeCount), 'cwd-comment-like-count')]
																			: [];
																	})(),
																],
															}),
														],
													}),
												]
											: []),
										this.createTextElement('span', formatRelativeTime(comment.created, this.t), 'cwd-comment-time'),
									],
								}),
							],
						}),

						// 评论内容
						this.createElement('div', {
							className: 'cwd-comment-content',
						}),

						// 回复编辑器容器
						this.createElement('div', {
							className: 'cwd-reply-editor-container',
						}),

						// 嵌套回复容器
						...(comment.replies && comment.replies.length > 0
							? [
									this.createElement('div', {
										className: 'cwd-replies',
									}),
								]
							: []),
					],
				}),
			],
		});

		// 设置评论内容的 TEXT
		const contentEl = root.querySelector('.cwd-comment-content');
		if (contentEl) {
			contentEl.innerHTML = replaceEmojiInHtml(comment.contentHtml);
		}

		// 创建回复编辑器
		if (isReplying) {
			const replyContainer = root.querySelector('.cwd-reply-editor-container');
			if (replyContainer) {
				this.replyEditor = new ReplyEditor(replyContainer, {
					replyToAuthor: comment.name,
					content: this.props.replyContent,
					error: this.props.replyError,
					submitting: this.props.submitting,
					turnstileSiteKey: this.props.turnstileSiteKey,
					turnstileTheme: this.props.turnstileTheme,
					currentUser: this.props.currentUser,
					onUpdateUserInfo: this.props.onUpdateUserInfo,
					onUpdate: (content) => this.handleUpdateReplyContent(content),
					onSubmit: (turnstileToken) => this.handleSubmitReply(turnstileToken),
					onCancel: () => this.handleCancelReply(),
					onClearError: () => this.handleClearReplyError(),
					placeholder: this.props.replyPlaceholder,
					emotionGroups: this.props.emotionGroups,
					t: this.t
				});
				this.replyEditor.render();
				this.replyEditor.focus();
			}
		} else {
			this.replyEditor = null;
		}

		// 渲染嵌套回复
		this.childCommentItems = [];
		if (comment.replies && comment.replies.length > 0) {
			const repliesContainer = root.querySelector('.cwd-replies');
			if (repliesContainer) {
				comment.replies.forEach((reply) => {
					const replyItem = new CommentItem(repliesContainer, {
						comment: reply,
						isReply: true,
						replyingTo: this.props.replyingTo,
						replyContent: this.props.replyContent,
						replyError: this.props.replyError,
						submitting: this.props.submitting,
						turnstileSiteKey: this.props.turnstileSiteKey,
						turnstileTheme: this.props.turnstileTheme,
						currentUser: this.props.currentUser,
						onUpdateUserInfo: this.props.onUpdateUserInfo,
						// adminEmail 已移除
						adminBadge: this.props.adminBadge,
						enableCommentLike: this.props.enableCommentLike,
						replyPlaceholder: this.props.replyPlaceholder,
						emotionGroups: this.props.emotionGroups,
						onReply: this.props.onReply,
						onLikeComment: this.props.onLikeComment,
						onSubmitReply: this.props.onSubmitReply,
						onCancelReply: this.props.onCancelReply,
						onUpdateReplyContent: this.props.onUpdateReplyContent,
						onClearReplyError: this.props.onClearReplyError,
						t: this.t
					});
					replyItem.render();
					this.childCommentItems.push(replyItem);
				});
			}
		}

		this.elements.root = root;

		// 只在首次渲染时清空容器（当还没有 root 元素时）
		if (this.container.contains(root)) {
			// 如果 root 已存在，替换它
			this.container.replaceChild(root, this.elements.root);
		} else {
			// 否则直接添加
			this.container.appendChild(root);
		}
	}

	updateProps(prevProps) {
		const { comment } = this.props;
		const wasReplying = prevProps.replyingTo === comment.id;
		const isReplying = this.props.replyingTo === comment.id;

		// 如果评论数据本身变化，需要完全重新渲染
		if (this.props.comment !== prevProps.comment) {
			this.render();
			return;
		}

		// 处理回复编辑器的显示/隐藏
		if (isReplying !== wasReplying) {
			const replyContainer = this.elements.root?.querySelector(':scope > .cwd-comment-body > .cwd-reply-editor-container');
			if (isReplying && replyContainer) {
				// 显示回复编辑器
				this.replyEditor = new ReplyEditor(replyContainer, {
					replyToAuthor: comment.name,
					content: this.props.replyContent,
					error: this.props.replyError,
					submitting: this.props.submitting,
					turnstileSiteKey: this.props.turnstileSiteKey,
					turnstileTheme: this.props.turnstileTheme,
					currentUser: this.props.currentUser,
					onUpdateUserInfo: this.props.onUpdateUserInfo,
					onUpdate: (content) => this.handleUpdateReplyContent(content),
					onSubmit: (turnstileToken) => this.handleSubmitReply(turnstileToken),
					onCancel: () => this.handleCancelReply(),
					onClearError: () => this.handleClearReplyError(),
					placeholder: this.props.replyPlaceholder,
					emotionGroups: this.props.emotionGroups,
					t: this.t
				});
				this.replyEditor.render();
				this.replyEditor.focus();
			} else if (!isReplying && replyContainer) {
				// 隐藏回复编辑器
				this.replyEditor?.destroy();
				replyContainer.innerHTML = '';
				this.replyEditor = null;
			}
		} else if (isReplying && this.replyEditor) {
			// 更新回复编辑器的 props
			this.replyEditor.setProps({
				content: this.props.replyContent,
				error: this.props.replyError,
				submitting: this.props.submitting,
				currentUser: this.props.currentUser,
				turnstileSiteKey: this.props.turnstileSiteKey,
				turnstileTheme: this.props.turnstileTheme,
				placeholder: this.props.replyPlaceholder,
				emotionGroups: this.props.emotionGroups,
			});
		}

		// 递归更新嵌套回复
		if (this.childCommentItems && this.childCommentItems.length > 0) {
			this.childCommentItems.forEach((childItem) => {
				childItem.setProps({
					replyingTo: this.props.replyingTo,
					replyContent: this.props.replyContent,
					replyError: this.props.replyError,
					submitting: this.props.submitting,
					currentUser: this.props.currentUser,
					turnstileSiteKey: this.props.turnstileSiteKey,
					turnstileTheme: this.props.turnstileTheme,
					enableCommentLike: this.props.enableCommentLike,
					replyPlaceholder: this.props.replyPlaceholder,
					emotionGroups: this.props.emotionGroups,
					onLikeComment: this.props.onLikeComment,
				});
			});
		}
	}

	handleReply() {
		if (this.props.onReply) {
			this.props.onReply(this.props.comment.id);
		}
	}

	handleLikeComment() {
		if (!this.props.onLikeComment) {
			return;
		}

		const commentId = String(this.props.comment.id);

		// 防抖检查：1 秒内同一评论只能操作一次
		const now = Date.now();
		const debounceKey = `${this.getUserId()}_${commentId}`;
		const lastClick = CommentItem._likeDebounce.get(debounceKey);
		if (lastClick && now - lastClick < 1000) {
			return;
		}
		CommentItem._likeDebounce.set(debounceKey, now);

		// 获取当前点赞状态
		const likedComments = this.getLikedComments();
		const hasLiked = likedComments.has(commentId);

		if (!hasLiked) {
			// 未点赞，执行点赞
			likedComments.add(commentId);
			this.saveLikedComments(likedComments);
			this.props.onLikeComment(commentId, true);
		} else {
			// 已点赞，执行取消点赞
			likedComments.delete(commentId);
			this.saveLikedComments(likedComments);
			this.props.onLikeComment(commentId, false);
		}
	}

	/**
	 * 获取用户唯一标识
	 * 使用静态缓存确保一致性
	 * @returns {string} 用户ID
	 */
	getUserId() {
		if (CommentItem._userId) {
			return CommentItem._userId;
		}

		const STORAGE_KEY = 'cwd_comment_user_id';
		let userId = localStorage.getItem(STORAGE_KEY);

		if (!userId) {
			// 生成简单的用户ID
			userId = 'u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 12);
			localStorage.setItem(STORAGE_KEY, userId);
		}

		CommentItem._userId = userId;
		return userId;
	}

	/**
	 * 获取已点赞的评论ID集合
	 * @returns {Set<string>} 已点赞的评论ID集合
	 */
	getLikedComments() {
		const userId = this.getUserId();
		const key = `cwd_comment_liked_${userId}`;
		const data = localStorage.getItem(key);
		const likedSet = new Set();

		if (data) {
			try {
				const parsed = JSON.parse(data);
				if (Array.isArray(parsed)) {
					parsed.forEach((id) => likedSet.add(String(id)));
				}
			} catch (e) {
				// 解析失败，返回空集合
			}
		}

		return likedSet;
	}

	/**
	 * 保存点赞记录到 localStorage
	 * @param {Set} likedSet - 点赞集合
	 */
	saveLikedComments(likedSet) {
		const userId = this.getUserId();
		const key = `cwd_comment_liked_${userId}`;
		localStorage.setItem(key, JSON.stringify(Array.from(likedSet)));
	}

	/**
	 * 检查是否已点赞
	 * @param {string|number} commentId - 评论 ID
	 * @returns {boolean} 是否已点赞
	 */
	hasLiked(commentId) {
		const likedComments = this.getLikedComments();
		return likedComments.has(String(commentId));
	}

	handleSubmitReply(turnstileToken) {
		if (this.props.onSubmitReply) {
			return this.props.onSubmitReply(this.props.comment.id, turnstileToken);
		}
	}

	handleCancelReply() {
		if (this.props.onCancelReply) {
			this.props.onCancelReply();
		}
	}

	handleUpdateReplyContent(content) {
		if (this.props.onUpdateReplyContent) {
			this.props.onUpdateReplyContent(content);
		}
	}

	handleClearReplyError() {
		if (this.props.onClearReplyError) {
			this.props.onClearReplyError();
		}
	}

	destroy() {
		this.replyEditor?.destroy();
		this.childCommentItems.forEach((item) => item.destroy());
		this.replyEditor = null;
		this.childCommentItems = [];
		super.destroy();
	}
}
