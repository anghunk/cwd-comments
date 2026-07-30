/**
 * CommentForm 评论表单组件
 */

import { Component } from './Component.js';
import { AdminAuthModal } from './AdminAuthModal.js';
import { EmotionPicker } from './EmotionPicker.js';
import { TurnstileWidget } from './TurnstileWidget.js';
import { auth } from '../utils/auth.js';
import { insertTextAtCursor } from '../utils/emotions.js';
import { renderMarkdown } from '../utils/markdown.js';

export class CommentForm extends Component {
	/**
	 * @param {HTMLElement|string} container - 容器元素或选择器
	 * @param {Object} props - 组件属性
	 * @param {Object} props.form - 表单数据
	 * @param {Object} props.formErrors - 表单错误
	 * @param {boolean} props.submitting - 是否正在提交
	 * @param {Function} props.onSubmit - 提交回调
	 * @param {Function} props.onFieldChange - 字段变化回调
	 * @param {string} props.adminEmail - 管理员邮箱
	 * @param {Array} props.emotionGroups - 表情分组
	 * @param {Function} props.onVerifyAdmin - 验证管理员回调 (returns Promise)
	 */
	constructor(container, props = {}) {
		super(container, props);
		this.t = props.t || ((k) => k);
		// 确保 localForm 的各个字段都有初始值
		const initialForm = props.form || {};
		this.state = {
			localForm: {
				name: initialForm.name || '',
				email: initialForm.email || '',
				url: initialForm.url || '',
				content: initialForm.content || '',
			},
			activeTab: 'write', // 'write' | 'preview'
			showPreview: false,
		};
		this.modal = null;
		this.emotionPicker = null;
		this.turnstileWidget = null;
		this.turnstileToken = '';
	}

	render() {
		this.turnstileWidget?.destroy();
		this.turnstileWidget = null;
		this.turnstileToken = '';
		const { formErrors, submitting } = this.props;
		const { localForm } = this.state;

		const canSubmit =
			localForm.name.trim() &&
			localForm.email.trim() &&
			localForm.content.trim() &&
			(!this.props.turnstileSiteKey || this.turnstileToken);
		const isAdmin = this.props.adminEmail && localForm.email.trim() === this.props.adminEmail;
		const isVerified = isAdmin && auth.hasToken();
		const placeholderText = this.props.placeholder || '';

		const root = this.createElement('form', {
			className: 'cwd-comment-form',
			attributes: {
				novalidate: true,
				onSubmit: (e) => this.handleSubmit(e),
			},
			children: [
				// 标题
				this.createTextElement('h3', this.t('formTitle'), 'cwd-form-title'),

				// 表单字段
				this.createElement('div', {
					className: 'cwd-form-fields',
					children: [
						// 第一行：昵称和邮箱
						this.createElement('div', {
							className: 'cwd-form-row',
							children: [
								// 昵称
								this.createFormField(this.t('nickname'), 'text', 'name', localForm.name, formErrors.name),
								// 邮箱
								this.createElement('div', {
									className: 'cwd-form-field-wrapper',
									children: [
										this.createFormField(this.t('email'), 'email', 'email', localForm.email, formErrors.email),
										isVerified
											? this.createElement('div', {
													className: 'cwd-admin-controls',
													children: [
														this.createElement('button', {
															className: 'cwd-btn-text',
															text: this.t('verifyAdmin'),
															attributes: {
																type: 'button',
																title: '清除管理员凭证',
																onClick: () => {
																	auth.clearToken();
																	this.render();
																},
															},
														}),
													],
												})
											: null,
									],
								}),
								// 网址
								this.createFormField(this.t('website'), 'url', 'url', localForm.url, formErrors.url),
							],
						}),

						// 评论内容
						this.createElement('div', {
							className: 'cwd-form-field',
							children: [
								this.createTextElement('label', this.t('writeComment'), 'cwd-form-label'),
								this.createElement('textarea', {
									className: `cwd-form-textarea ${formErrors.content ? 'cwd-input-error' : ''}`,
									attributes: {
										rows: 4,
										placeholder: placeholderText,
										disabled: submitting,
										onInput: (e) => this.handleFieldChange('content', e.target.value),
										onKeydown: (e) => this.handleContentKeydown(e),
									},
								}),
								this.createElement('div', {
									className: 'cwd-emotion-picker-container',
								}),
								...(formErrors.content ? [this.createTextElement('span', formErrors.content, 'cwd-error-text')] : []),
							],
						}),
					],
				}),

				...(this.props.turnstileSiteKey
					? [this.createElement('div', { className: 'cwd-turnstile-container' })]
					: []),

				// 操作按钮
				this.createElement('div', {
					className: 'cwd-form-actions',
					children: [
						this.createElement('button', {
							className: `cwd-btn cwd-btn-secondary cwd-btn-preview ${this.state.showPreview ? 'cwd-btn-active' : ''}`,
							attributes: {
								type: 'button',
								disabled: submitting || !localForm.content?.trim(),
								style: localForm.content?.trim() ? '' : 'display:none;',
								onClick: () => this.togglePreview(),
							},
							text: this.state.showPreview ? this.t('close') : this.t('preview'),
						}),
						this.createElement('button', {
							className: 'cwd-btn cwd-btn-primary',
							attributes: {
								type: 'submit',
								disabled: submitting || !canSubmit,
							},
							text: submitting ? this.t('submitting') : this.t('submit'),
						}),
					],
				}),

				// 预览区域
				...(this.state.showPreview && localForm.content
					? [
							this.createElement('div', {
								className: 'cwd-preview-container',
								children: [
									this.createElement('div', {
										className: 'cwd-preview-content cwd-comment-content',
										// 直接设置 innerHTML
										html: renderMarkdown(localForm.content),
									}),
								],
							}),
						]
					: []),
			],
		});

		// 设置输入框的值
		this.setInputValues(root, localForm);

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
				this.updateFormState();
			},
		});
		this.turnstileWidget.render();
	}

	/**
	 * 渲染评论框表情选择器。
	 *
	 * @param {HTMLElement} root - 表单根元素
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
			this.props.turnstileSiteKey !== prevProps.turnstileSiteKey ||
			this.props.turnstileTheme !== prevProps.turnstileTheme
		) {
			this.render();
			return;
		}
		// 只在非提交状态时同步表单数据（避免覆盖用户正在输入的内容）
		if (!this.props.submitting && this.props.form !== prevProps.form) {
			// 保留当前正在输入的内容
			const currentName = this.state.localForm.name || '';
			const currentEmail = this.state.localForm.email || '';
			const currentUrl = this.state.localForm.url || '';
			const currentContent = this.state.localForm.content || '';

			this.state.localForm = {
				name: this.props.form.name || currentName,
				email: this.props.form.email || currentEmail,
				url: this.props.form.url || currentUrl,
				content: this.props.form.content !== undefined ? this.props.form.content : currentContent,
			};

			// 同步更新 DOM 值（不重新渲染）
			if (this.elements.root) {
				this.setInputValues(this.elements.root, this.state.localForm);
			}
		}

		// 更新提交按钮状态和错误提示
		if (this.elements.root) {
			this.updateFormState();
		}
	}

	/**
	 * 更新表单状态（按钮、错误提示等）
	 */
	updateFormState() {
		const { formErrors, submitting } = this.props;
		const { localForm } = this.state;

		const canSubmit =
			localForm.name.trim() &&
			localForm.email.trim() &&
			localForm.content.trim() &&
			(!this.props.turnstileSiteKey || this.turnstileToken);

		// 更新提交按钮状态
		const submitBtn = this.elements.root.querySelector('button[type="submit"]');
		if (submitBtn) {
			submitBtn.disabled = submitting || !canSubmit;
			submitBtn.textContent = submitting ? this.t('submitting') : this.t('submit');
		}

		// 更新预览按钮状态
		const previewBtn = this.elements.root.querySelector('.cwd-btn-preview');
		if (previewBtn) {
			const hasContent = !!localForm.content?.trim();
			previewBtn.disabled = submitting || !hasContent;
			previewBtn.style.display = hasContent ? '' : 'none';
			if (!hasContent) {
				this.state.showPreview = false;
				const previewContainer = this.elements.root.querySelector('.cwd-preview-container');
				if (previewContainer) {
					previewContainer.remove();
				}
				previewBtn.textContent = this.t('preview');
			} else {
				previewBtn.textContent = this.state.showPreview ? this.t('close') : this.t('preview');
			}
			previewBtn.classList.toggle('cwd-btn-active', this.state.showPreview);
		}

		// 更新输入框禁用状态
		const inputs = this.elements.root.querySelectorAll('input, textarea');
		inputs.forEach((input) => {
			input.disabled = submitting;
		});

		// 更新错误提示
		this.updateErrors(formErrors);
	}

	/**
	 * 更新错误提示
	 */
	updateErrors(formErrors) {
		if (!this.elements.root) return;

		const nameInput = this.elements.root.querySelector('input[name="name"]');
		this.updateFieldError(nameInput, formErrors?.name);

		const emailInput = this.elements.root.querySelector('input[name="email"]');
		this.updateFieldError(emailInput, formErrors?.email);

		const urlInput = this.elements.root.querySelector('input[name="url"]');
		this.updateFieldError(urlInput, formErrors?.url);

		const contentTextarea = this.elements.root.querySelector('textarea');
		this.updateFieldError(contentTextarea, formErrors?.content);
	}

	/**
	 * 更新单个字段的错误状态
	 */
	updateFieldError(element, error) {
		if (!element) return;

		// 移除或添加错误样式
		if (error) {
			element.classList.add('cwd-input-error');
		} else {
			element.classList.remove('cwd-input-error');
		}

		// 查找并更新/移除错误提示元素
		const parent = element.parentElement;
		let errorSpan = parent.querySelector('.cwd-error-text');
		if (error) {
			if (!errorSpan) {
				errorSpan = document.createElement('span');
				errorSpan.className = 'cwd-error-text';
				parent.appendChild(errorSpan);
			}
			errorSpan.textContent = error;
		} else if (errorSpan) {
			errorSpan.remove();
		}
	}

	/**
	 * 创建表单字段
	 */
	createFormField(label, type, fieldName, value, error, placeholder = '') {
		return this.createElement('div', {
			className: 'cwd-form-field',
			children: [
				this.createTextElement('label', label, 'cwd-form-label'),
				this.createElement('input', {
					className: `cwd-form-input ${error ? 'cwd-input-error' : ''}`,
					attributes: {
						type,
						name: fieldName,
						value: value || '',
						disabled: this.props.submitting,
						onInput: (e) => this.handleFieldChange(fieldName, e.target.value),
						onBlur: (e) => {
							if (fieldName === 'email') this.handleEmailBlur(e.target.value);
						},
						onKeydown: (e) => this.handleContentKeydown(e),
					},
				}),
				...(error ? [this.createTextElement('span', error, 'cwd-error-text')] : []),
			],
		});
	}

	/**
	 * 设置输入框的值
	 */
	setInputValues(root, form) {
		const nameInput = root.querySelector('input[name="name"]');
		const emailInput = root.querySelector('input[name="email"]');
		const urlInput = root.querySelector('input[name="url"]');
		const contentTextarea = root.querySelector('textarea');

		if (nameInput) nameInput.value = form.name || '';
		if (emailInput) emailInput.value = form.email || '';
		if (urlInput) urlInput.value = form.url || '';
		if (contentTextarea) contentTextarea.value = form.content || '';
	}

	togglePreview() {
		this.state.showPreview = !this.state.showPreview;
		this.updatePreviewState();
	}

	updatePreviewState() {
		const root = this.elements.root;
		if (!root) {
			return;
		}

		const previewBtn = root.querySelector('.cwd-btn-preview');
		if (previewBtn) {
			previewBtn.textContent = this.state.showPreview ? this.t('close') : this.t('preview');
			previewBtn.classList.toggle('cwd-btn-active', this.state.showPreview);
		}

		let previewContainer = root.querySelector('.cwd-preview-container');
		if (!this.state.showPreview || !this.state.localForm.content) {
			previewContainer?.remove();
			return;
		}

		if (!previewContainer) {
			previewContainer = this.createElement('div', {
				className: 'cwd-preview-container',
				children: [
					this.createElement('div', {
						className: 'cwd-preview-content cwd-comment-content',
						html: renderMarkdown(this.state.localForm.content),
					}),
				],
			});
			const actions = root.querySelector('.cwd-form-actions');
			root.insertBefore(previewContainer, actions?.nextSibling || null);
		} else {
			this.updatePreviewContent(this.state.localForm.content);
		}
	}

	handleFieldChange(field, value) {
		this.state.localForm[field] = value;
		if (this.props.onFieldChange) {
			this.props.onFieldChange(field, value);
		}
		// 实时更新按钮状态
		if (this.elements.root) {
			this.updateFormState();
			// 实时更新预览内容
			if (field === 'content' && this.state.showPreview) {
				this.updatePreviewContent(value);
			}
		}
	}

	/**
	 * 插入选中的表情。
	 *
	 * @param {Object} item - 表情项
	 */
	handleEmotionSelect(item) {
		const textarea = this.elements.root?.querySelector('.cwd-form-textarea');
		if (!textarea) {
			return;
		}

		const nextValue = insertTextAtCursor(textarea, item.insertValue);
		this.handleFieldChange('content', nextValue);
		textarea.focus();
	}

	handleContentKeydown(e) {
		if (
			e.key === '/' &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey &&
			!e.shiftKey
		) {
			e.stopPropagation();
		}
	}

	updatePreviewContent(content) {
		const previewContent = this.elements.root.querySelector('.cwd-preview-content');
		if (previewContent) {
			previewContent.innerHTML = renderMarkdown(content);
		}
	}

	async handleSubmit(e) {
		e.preventDefault();
		const email = this.state.localForm.email?.trim();
		const adminEmail = this.props.adminEmail;
		if (adminEmail && email && email === adminEmail && !auth.hasToken()) {
			this.showAuthModal();
			return;
		}
		if (this.props.onSubmit) {
			try {
				const result = await this.props.onSubmit(this.state.localForm, this.turnstileToken);
				if (result?.resetTurnstile !== false) {
					this.turnstileWidget?.reset();
				}
			} catch {
				this.turnstileWidget?.reset();
			}
		}
	}

	async handleEmailBlur(email) {
		if (!email || !this.props.adminEmail) return;
		if (email.trim() === this.props.adminEmail) {
			// Check local storage
			if (auth.hasToken()) {
				// Already valid
				return;
			}
			// Show modal
			this.showAuthModal();
		}
	}

	showAuthModal() {
		// Create modal container if not exists
		let modalContainer = this.elements.root.querySelector('.cwd-modal-container');
		if (!modalContainer) {
			modalContainer = document.createElement('div');
			modalContainer.className = 'cwd-modal-container';
			this.elements.root.appendChild(modalContainer);
		}

		this.modal = new AdminAuthModal(modalContainer, {
			onCancel: () => {
				this.modal.destroy();
				this.modal = null;
			},
			onSubmit: async (key) => {
				if (this.props.onVerifyAdmin) {
					await this.props.onVerifyAdmin(key);
					auth.saveToken(key);
					this.modal.destroy();
					this.modal = null;
				}
			},
			t: this.t
		});
		this.modal.render();
	}

	destroy() {
		this.turnstileWidget?.destroy();
		this.turnstileWidget = null;
		super.destroy();
	}
}
