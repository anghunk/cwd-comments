/**
 * ReplyEditor 回复编辑器组件
 */

import { Component } from './Component.js';
import { EmotionPicker } from './EmotionPicker.js';
import { TurnstileWidget } from './TurnstileWidget.js';
import { insertTextAtCursor } from '../utils/emotions.js';
import { renderMarkdown } from '../utils/markdown.js';

export class ReplyEditor extends Component {
	/**
	 * @param {HTMLElement|string} container - 容器元素或选择器
	 * @param {Object} props - 组件属性
	 * @param {string} props.replyToAuthor - 被回复的作者名
	 * @param {string} props.content - 回复内容
	 * @param {string|null} props.error - 错误信息
	 * @param {boolean} props.submitting - 是否正在提交
	 * @param {Array} props.emotionGroups - 表情分组
	 * @param {Function} props.onUpdate - 内容更新回调
	 * @param {Function} props.onSubmit - 提交回调
	 * @param {Function} props.onCancel - 取消回调
	 * @param {Function} props.onClearError - 清除错误回调
	 */
	constructor(container, props = {}) {
		super(container, props);
		this.t = props.t || ((k) => k);
		const { currentUser } = props;
		this.state = {
			content: props.content || '',
			// 如果没有昵称或邮箱，显示用户信息输入框。且一旦显示，在当前编辑器生命周期内保持显示，避免输入过程中消失
			showUserInfo: !currentUser || !currentUser.name || !currentUser.email,
			showPreview: false,
		};
		this.emotionPicker = null;
		this.turnstileWidget = null;
		this.turnstileToken = '';
	}

	render() {
		this.turnstileWidget?.destroy();
		this.turnstileWidget = null;
		this.turnstileToken = '';
		const { currentUser } = this.props;
		const { showUserInfo } = this.state;
		const placeholderText = this.props.placeholder || '';

		const root = this.createElement('div', {
			className: 'cwd-reply-editor',
			children: [
				// 头部
				this.createElement('div', {
					className: 'cwd-reply-header',
					children: [
						this.createTextElement('span', `${this.t('reply')} @${this.props.replyToAuthor}`, 'cwd-reply-to'),
						this.createElement('button', {
							className: 'cwd-btn-close',
							attributes: {
								type: 'button',
								onClick: () => this.handleCancel(),
							},
							text: '✕',
						}),
					],
				}),

				// 用户信息输入框（当缺少信息时显示）
				...(showUserInfo
					? [
							this.createElement('div', {
								className: 'cwd-form-row',
								attributes: {
									style: 'margin-bottom: 12px;',
								},
								children: [
									this.createFormField(this.t('nickname'), 'text', 'name', currentUser?.name),
									this.createFormField(this.t('email'), 'email', 'email', currentUser?.email),
									this.createFormField(this.t('website'), 'url', 'url', currentUser?.url),
								],
							}),
						]
					: []),

				// 文本框
				this.createElement('textarea', {
					className: 'cwd-reply-textarea',
					attributes: {
						rows: 3,
						placeholder: placeholderText,
						disabled: this.props.submitting,
						onInput: (e) => this.handleInput(e),
						onKeydown: (e) => this.handleTextareaKeydown(e),
					},
				}),
				this.createElement('div', {
					className: 'cwd-emotion-picker-container cwd-reply-emotion-picker-container',
				}),

				// 错误提示
				...(this.props.error
					? [
							this.createElement('div', {
								className: 'cwd-error-inline cwd-error-small',
								children: [
									this.createTextElement('span', this.props.error),
									this.createElement('button', {
										className: 'cwd-error-close',
										attributes: {
											type: 'button',
											onClick: () => this.handleClearError(),
										},
										text: '✕',
									}),
								],
							}),
						]
					: []),

				...(this.props.turnstileSiteKey
					? [this.createElement('div', { className: 'cwd-turnstile-container cwd-reply-turnstile-container' })]
					: []),

				// 操作按钮
				this.createElement('div', {
					className: 'cwd-reply-actions',
					children: [
						this.createElement('button', {
							className: `cwd-btn cwd-btn-secondary cwd-btn-small cwd-btn-preview ${this.state.showPreview ? 'cwd-btn-active' : ''}`,
							attributes: {
								type: 'button',
								disabled: this.props.submitting || !this.state.content.trim(),
								onClick: () => this.togglePreview(),
							},
							text: this.state.showPreview ? this.t('close') : this.t('preview'),
						}),
						this.createElement('button', {
							className: 'cwd-btn cwd-btn-primary cwd-btn-small',
							attributes: {
								type: 'button',
								disabled:
									this.props.submitting ||
									!this.state.content.trim() ||
									(!!this.props.turnstileSiteKey && !this.turnstileToken),
								onClick: () => this.handleSubmit(),
							},
							text: this.props.submitting ? this.t('submitting') : this.t('submit'),
						}),
						this.createElement('button', {
							className: 'cwd-btn cwd-btn-secondary cwd-btn-small cwd-btn-cancel',
							attributes: {
								type: 'button',
								disabled: this.props.submitting,
								onClick: () => this.handleCancel(),
							},
							text: this.t('cancel'),
						}),
					],
				}),

				// 预览区域
				...(this.state.showPreview && this.state.content
					? [
							this.createElement('div', {
								className: 'cwd-preview-container',
								children: [
									this.createElement('div', {
										className: 'cwd-preview-content cwd-comment-content',
										// 直接设置 innerHTML
										html: renderMarkdown(this.state.content),
									}),
								],
							}),
						]
					: []),
			],
		});

		// 设置文本框内容
		const textarea = root.querySelector('textarea');
		if (textarea) {
			textarea.value = this.state.content;
		}

		this.elements.root = root;
		this.empty(this.container);
		this.container.appendChild(root);
		this.renderEmotionPicker(root);
		this.renderTurnstile(root);
	}

	renderTurnstile(root) {
		if (!this.props.turnstileSiteKey) {
			return;
		}
		const container = root.querySelector('.cwd-turnstile-container');
		this.turnstileWidget = new TurnstileWidget(container, {
			siteKey: this.props.turnstileSiteKey,
			theme: this.props.turnstileTheme,
			errorText: this.t('verifyFailed'),
			onTokenChange: (token) => {
				this.turnstileToken = token;
				this.updateActionState();
			},
		});
		this.turnstileWidget.render();
	}

	/**
	 * 渲染回复框表情选择器。
	 *
	 * @param {HTMLElement} root - 回复编辑器根元素
	 */
	renderEmotionPicker(root) {
		const groups = Array.isArray(this.props.emotionGroups) ? this.props.emotionGroups : [];
		const pickerContainer = root.querySelector('.cwd-emotion-picker-container');
		if (!pickerContainer || !groups.length) {
			this.emotionPicker = null;
			return;
		}

		this.emotionPicker = new EmotionPicker(pickerContainer, {
			groups,
			onSelect: (item) => this.handleEmotionSelect(item),
			t: this.t,
		});
		this.emotionPicker.render();
	}

	updateProps(prevProps) {
		if (
			this.props.turnstileSiteKey !== prevProps?.turnstileSiteKey ||
			this.props.turnstileTheme !== prevProps?.turnstileTheme
		) {
			this.render();
			return;
		}
		// 如果外部传入的 content 变化，更新内部状态
		if (this.props.content !== this.state.content && this.props.content !== prevProps?.content) {
			this.state.content = this.props.content;
			const textarea = this.elements.root?.querySelector('.cwd-reply-textarea');
			if (textarea) {
				textarea.value = this.state.content;
			}
			if (!this.state.content.trim()) {
				this.state.showPreview = false;
			}
			this.updatePreviewState();
		}

		this.updateUserInfoFields();
		this.updateErrorState();
		this.updateSubmittingState();
		this.updateActionState();
	}

	handleTextareaKeydown(e) {
		if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
			e.stopPropagation();
		}
	}

	togglePreview() {
		this.state.showPreview = !this.state.showPreview;
		this.updatePreviewState();
	}

	handleInput(e) {
		this.state.content = e.target.value;

		// 更新提交按钮的禁用状态
		const submitBtn = this.elements.root?.querySelector('.cwd-btn-primary');
		if (submitBtn) {
			submitBtn.disabled =
				this.props.submitting ||
				!this.state.content.trim() ||
				(!!this.props.turnstileSiteKey && !this.turnstileToken);
		}

		// 更新预览按钮的禁用状态
		const previewBtn = this.elements.root?.querySelector('.cwd-btn-preview');
		if (previewBtn) {
			previewBtn.disabled = this.props.submitting || !this.state.content.trim();
		}

		if (this.props.onUpdate) {
			this.props.onUpdate(this.state.content);
		}

		// 实时更新预览内容
		if (this.state.showPreview) {
			this.updatePreviewContent(this.state.content);
		}
	}

	/**
	 * 插入选中的表情。
	 *
	 * @param {Object} item - 表情项
	 */
	handleEmotionSelect(item) {
		const textarea = this.elements.root?.querySelector('.cwd-reply-textarea');
		if (!textarea) {
			return;
		}

		this.state.content = insertTextAtCursor(textarea, item.insertValue);
		if (this.props.onUpdate) {
			this.props.onUpdate(this.state.content);
		}
		if (this.state.showPreview) {
			this.updatePreviewContent(this.state.content);
		}
		this.updateActionState();
		textarea.focus();
	}

	/**
	 * 更新回复按钮状态。
	 */
	updateActionState() {
		const submitBtn = this.elements.root?.querySelector('.cwd-btn-primary');
		if (submitBtn) {
			submitBtn.disabled =
				this.props.submitting ||
				!this.state.content.trim() ||
				(!!this.props.turnstileSiteKey && !this.turnstileToken);
		}

		const previewBtn = this.elements.root?.querySelector('.cwd-btn-preview');
		if (previewBtn) {
			previewBtn.disabled = this.props.submitting || !this.state.content.trim();
			previewBtn.textContent = this.state.showPreview ? this.t('close') : this.t('preview');
			previewBtn.classList.toggle('cwd-btn-active', this.state.showPreview);
		}
	}

	updatePreviewState() {
		const root = this.elements.root;
		if (!root) {
			return;
		}

		this.updateActionState();
		let previewContainer = root.querySelector('.cwd-preview-container');
		if (!this.state.showPreview || !this.state.content) {
			previewContainer?.remove();
			return;
		}

		if (!previewContainer) {
			previewContainer = this.createElement('div', {
				className: 'cwd-preview-container',
				children: [
					this.createElement('div', {
						className: 'cwd-preview-content cwd-comment-content',
						html: renderMarkdown(this.state.content),
					}),
				],
			});
			const actions = root.querySelector('.cwd-reply-actions');
			root.insertBefore(previewContainer, actions?.nextSibling || null);
		} else {
			this.updatePreviewContent(this.state.content);
		}
	}

	updateUserInfoFields() {
		const currentUser = this.props.currentUser || {};
		for (const field of ['name', 'email', 'url']) {
			const input = this.elements.root?.querySelector(`[data-cwd-user-field="${field}"]`);
			if (input && (typeof document === 'undefined' || input !== document.activeElement)) {
				input.value = currentUser[field] || '';
			}
		}
	}

	updateErrorState() {
		const root = this.elements.root;
		if (!root) {
			return;
		}

		let errorElement = root.querySelector('.cwd-error-inline');
		if (!this.props.error) {
			errorElement?.remove();
			return;
		}

		if (!errorElement) {
			errorElement = this.createElement('div', {
				className: 'cwd-error-inline cwd-error-small',
				children: [
					this.createTextElement('span', this.props.error),
					this.createElement('button', {
						className: 'cwd-error-close',
						attributes: {
							type: 'button',
							onClick: () => this.handleClearError(),
						},
						text: '✕',
					}),
				],
			});
			const nextElement = root.querySelector('.cwd-turnstile-container') || root.querySelector('.cwd-reply-actions');
			root.insertBefore(errorElement, nextElement);
			return;
		}

		const message = errorElement.querySelector('span');
		if (message) {
			message.textContent = this.props.error;
		}
	}

	updateSubmittingState() {
		const root = this.elements.root;
		if (!root) {
			return;
		}

		root.querySelectorAll('input, textarea').forEach((field) => {
			field.disabled = !!this.props.submitting;
		});
		const submitBtn = root.querySelector('.cwd-btn-primary');
		if (submitBtn) {
			submitBtn.textContent = this.props.submitting ? this.t('submitting') : this.t('submit');
		}
		const cancelBtn = root.querySelector('.cwd-btn-cancel');
		if (cancelBtn) {
			cancelBtn.disabled = !!this.props.submitting;
		}
	}

	updatePreviewContent(content) {
		const previewContent = this.elements.root?.querySelector('.cwd-preview-content');
		if (previewContent) {
			previewContent.innerHTML = renderMarkdown(content);
		}
	}

	async handleSubmit() {
		if (this.props.onSubmit) {
			try {
				const result = await this.props.onSubmit(this.turnstileToken);
				if (result?.resetTurnstile !== false) {
					this.turnstileWidget?.reset();
				}
			} catch {
				this.turnstileWidget?.reset();
			}
		}
	}

	handleCancel() {
		if (this.props.onCancel) {
			this.props.onCancel();
		}
	}

	handleClearError() {
		if (this.props.onClearError) {
			this.props.onClearError();
		}
	}

	/**
	 * 设置内容
	 * @param {string} content - 新内容
	 */
	setContent(content) {
		this.state.content = content;
		const textarea = this.elements.root?.querySelector('textarea');
		if (textarea) {
			textarea.value = content;
		}
	}

	/**
	 * 获取内容
	 * @returns {string}
	 */
	getContent() {
		return this.state.content;
	}

	/**
	 * 聚焦文本框
	 */
	focus() {
		const textarea = this.elements.root?.querySelector('textarea');
		if (textarea) {
			textarea.focus();
		}
	}

	handleUserInfoChange(field, value) {
		if (this.props.onUpdateUserInfo) {
			this.props.onUpdateUserInfo(field, value);
		}
	}

	createFormField(placeholder, type, field, value) {
		return this.createElement('div', {
			className: 'cwd-form-field',
			children: [
				this.createElement('input', {
					className: 'cwd-form-input',
					attributes: {
						type,
						placeholder,
						value: value || '',
						disabled: this.props.submitting,
						dataset: { cwdUserField: field },
						onInput: (e) => this.handleUserInfoChange(field, e.target.value),
						onKeydown: (e) => this.handleTextareaKeydown(e),
					},
				}),
			],
		});
	}

	destroy() {
		this.turnstileWidget?.destroy();
		this.turnstileWidget = null;
		super.destroy();
	}
}
