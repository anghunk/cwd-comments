import assert from 'node:assert/strict';
import test from 'node:test';
import { CommentForm } from './CommentForm.js';
import { ReplyEditor } from './ReplyEditor.js';

test('preview toggles update in place without rendering a new challenge', () => {
	for (const ComponentClass of [CommentForm, ReplyEditor]) {
		const component = Object.create(ComponentClass.prototype);
		component.state = { showPreview: false };
		let renders = 0;
		let previewUpdates = 0;
		component.render = () => renders++;
		component.updatePreviewState = () => previewUpdates++;

		component.togglePreview();

		assert.equal(component.state.showPreview, true);
		assert.equal(previewUpdates, 1);
		assert.equal(renders, 0);
	}
});

test('reply prop updates do not render a new challenge', () => {
	const editor = Object.create(ReplyEditor.prototype);
	editor.props = {
		turnstileSiteKey: 'site-key',
		turnstileTheme: 'light',
		content: 'draft',
		currentUser: { name: 'Reader' },
		error: 'failed',
		submitting: true,
	};
	editor.state = { content: 'draft', showPreview: false };
	editor.elements = {};
	let renders = 0;
	editor.render = () => renders++;
	editor.updateUserInfoFields = () => {};
	editor.updateErrorState = () => {};
	editor.updateSubmittingState = () => {};
	editor.updateActionState = () => {};

	editor.updateProps({
		turnstileSiteKey: 'site-key',
		turnstileTheme: 'light',
		content: 'draft',
		currentUser: {},
		error: null,
		submitting: false,
	});

	assert.equal(renders, 0);
});

test('a pre-Siteverify rejection preserves the current challenge', async () => {
	for (const ComponentClass of [CommentForm, ReplyEditor]) {
		const component = Object.create(ComponentClass.prototype);
		component.turnstileToken = 'token';
		let resets = 0;
		component.turnstileWidget = { reset: () => resets++ };
		component.props = {
			onSubmit: async () => ({ success: false, resetTurnstile: false }),
		};
		component.state = { localForm: { email: '' } };

		if (ComponentClass === CommentForm) {
			await component.handleSubmit({ preventDefault() {} });
		} else {
			await component.handleSubmit();
		}

		assert.equal(resets, 0);
	}
});
