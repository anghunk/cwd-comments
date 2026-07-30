/**
 * CommentList 评论列表容器组件
 */

import { Component } from './Component.js';
import { CommentItem } from './CommentItem.js';
import { Loading } from './Loading.js';
import { Pagination } from './Pagination.js';
import { canUpdateLikesInPlace, updateCommentLikesInPlace } from './commentLikeUpdates.js';

export class CommentList extends Component {
  /**
   * @param {HTMLElement|string} container - 容器元素或选择器
   * @param {Object} props - 组件属性
   * @param {Array} props.comments - 评论列表
   * @param {boolean} props.loading - 是否正在加载
   * @param {string|null} props.error - 错误信息
   * @param {number} props.currentPage - 当前页码
   * @param {number} props.totalPages - 总页数
   * @param {number|null} props.replyingTo - 当前正在回复的评论 ID
   * @param {string} props.replyContent - 回复内容
   * @param {string|null} props.replyError - 回复错误
   * @param {boolean} props.submitting - 是否正在提交
   * @param {Function} props.onRetry - 重试回调
   * @param {Function} props.onReply - 回复回调
   * @param {Function} props.onSubmitReply - 提交回复回调
   * @param {Function} props.onCancelReply - 取消回复回调
   * @param {Function} props.onUpdateReplyContent - 更新回复内容回调
   * @param {Function} props.onClearReplyError - 清除回复错误回调
   * @param {Function} props.onPrevPage - 上一页回调
   * @param {Function} props.onNextPage - 下一页回调
   * @param {Function} props.onGoToPage - 跳转页码回调
   * @param {string} props.adminEmail - 博主邮箱（可选）
   * @param {string} props.adminBadge - 博主标识文字（可选）
   * @param {boolean} props.enableCommentLike - 是否开启评论点赞
   * @param {Array} props.emotionGroups - 表情分组
   */
  constructor(container, props = {}) {
    super(container, props);
    this.t = props.t || ((k) => k);
    this.loadingComponent = null;
    this.paginationComponent = null;
    this.commentItems = new Map(); // 缓存 CommentItem 实例，key 为 comment.id
  }

  render() {
    const { comments, loading, error, currentPage, totalPages } = this.props;
    this.commentItems.forEach((commentItem) => commentItem.destroy());
    this.commentItems.clear();
    // 清空容器
    this.empty(this.container);

    // 加载状态
    if (loading && comments.length === 0) {
      this.loadingComponent = new Loading(this.container, { text: '加载评论中...' });
      this.loadingComponent.render();
      this.elements.root = this.loadingComponent.elements.root;
      return;
    }

    // 错误状态
    if (error && comments.length === 0) {
      const errorEl = this.createElement('div', {
        className: 'cwd-error',
        children: [
          this.createTextElement('span', error),
          this.createElement('button', {
            className: 'cwd-error-retry',
            attributes: {
              type: 'button',
              onClick: () => this.handleRetry()
            },
            text: '重试'
          })
        ]
      });
      this.elements.root = errorEl;
      this.container.appendChild(errorEl);
      return;
    }

    // 评论列表容器
    const root = this.createElement('div', {
      className: 'cwd-comment-list'
    });

    // 评论列表
    if (comments.length > 0) {
      const commentsContainer = this.createElement('div', {
        className: 'cwd-comments'
      });

      comments.forEach((comment, index) => {
        const commentItem = new CommentItem(commentsContainer, {
          comment,
          replyingTo: this.props.replyingTo,
          replyContent: this.props.replyContent,
          replyError: this.props.replyError,
          submitting: this.props.submitting,
          currentUser: this.props.currentUser,
          onUpdateUserInfo: this.props.onUpdateUserInfo,
          // adminEmail 已移除，改用 comment.isAdmin 字段
          adminBadge: this.props.adminBadge,
          enableCommentLike: this.props.enableCommentLike,
          replyPlaceholder: this.props.replyPlaceholder,
          emotionGroups: this.props.emotionGroups,
          turnstileSiteKey: this.props.turnstileSiteKey,
          turnstileTheme: this.props.turnstileTheme,
          onReply: (commentId) => this.handleReply(commentId),
          onSubmitReply: (commentId, turnstileToken) => this.handleSubmitReply(commentId, turnstileToken),
          onCancelReply: () => this.handleCancelReply(),
          onUpdateReplyContent: (content) => this.handleUpdateReplyContent(content),
          onClearReplyError: () => this.handleClearReplyError(),
          onLikeComment: (commentId, isLike) => this.handleLikeComment(commentId, isLike),
          t: this.props.t
        });
        commentItem.render();
        // 缓存 CommentItem 实例
        this.commentItems.set(comment.id, commentItem);
      });

      root.appendChild(commentsContainer);
    } else {
      // 空状态
      const emptyEl = this.createElement('div', {
        className: 'cwd-empty',
        children: [
          this.createTextElement('p', this.t('noComments'), 'cwd-empty-text')
        ]
      });
      root.appendChild(emptyEl);
    }

    // 分页
    if (totalPages > 1) {
      const paginationContainer = this.createElement('div');
      root.appendChild(paginationContainer);

      this.paginationComponent = new Pagination(paginationContainer, {
        currentPage,
        totalPages,
        onPrev: () => this.handlePrevPage(),
        onNext: () => this.handleNextPage(),
        onGoTo: (page) => this.handleGoToPage(page)
      });
      this.paginationComponent.render();
    } else {
      this.paginationComponent = null;
    }

    this.elements.root = root;
    this.container.appendChild(root);
  }

  updateProps(prevProps) {
    // 如果状态从加载变为非加载，需要完全重新渲染
    if (this.props.loading !== prevProps.loading && !this.props.loading) {
      this.render();
      return;
    }

    // 点赞只更新对应评论，保留已创建的回复编辑器和 Turnstile challenge。
    if (this.props.comments !== prevProps.comments) {
      const canUpdateInPlace =
        canUpdateLikesInPlace(prevProps.comments, this.props.comments) &&
        this.props.comments.every((comment) => this.commentItems.has(comment.id));

      if (canUpdateInPlace) {
        updateCommentLikesInPlace(this.commentItems, this.props.comments);
      } else {
        this.render();
        return;
      }
    }

    // 如果只是回复状态变化，局部更新 CommentItem 而不是完全重新渲染
    if (this.props.replyingTo !== prevProps.replyingTo ||
        this.props.replyError !== prevProps.replyError ||
        this.props.submitting !== prevProps.submitting ||
        this.props.currentUser !== prevProps.currentUser ||
        this.props.turnstileSiteKey !== prevProps.turnstileSiteKey ||
        this.props.turnstileTheme !== prevProps.turnstileTheme) {
      // 局部更新所有 CommentItem
      this.commentItems.forEach((commentItem) => {
        commentItem.setProps({
          replyingTo: this.props.replyingTo,
          replyContent: this.props.replyContent,
          replyError: this.props.replyError,
          submitting: this.props.submitting,
          currentUser: this.props.currentUser,
          enableCommentLike: this.props.enableCommentLike,
          emotionGroups: this.props.emotionGroups,
          turnstileSiteKey: this.props.turnstileSiteKey,
          turnstileTheme: this.props.turnstileTheme,
          onLikeComment: (commentId, isLike) => this.handleLikeComment(commentId, isLike)
        });
      });
      return;
    }

    // 如果分页信息变化，更新分页组件
    if (this.paginationComponent) {
      const pageChanged =
        this.props.currentPage !== prevProps.currentPage ||
        this.props.totalPages !== prevProps.totalPages;

      if (pageChanged) {
        this.paginationComponent.props.currentPage = this.props.currentPage;
        this.paginationComponent.props.totalPages = this.props.totalPages;
        this.paginationComponent.updateProps();
      }
    }
  }

  handleRetry() {
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  }

  handleReply(commentId) {
    if (this.props.onReply) {
      this.props.onReply(commentId);
    }
  }

  handleSubmitReply(commentId, turnstileToken) {
    if (this.props.onSubmitReply) {
      return this.props.onSubmitReply(commentId, turnstileToken);
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

  handleLikeComment(commentId, isLike) {
    if (this.props.onLikeComment) {
      this.props.onLikeComment(commentId, isLike);
    }
  }

  destroy() {
    this.commentItems.forEach((commentItem) => commentItem.destroy());
    this.commentItems.clear();
    super.destroy();
  }

  handlePrevPage() {
    if (this.props.onPrevPage) {
      this.props.onPrevPage();
    }
  }

  handleNextPage() {
    if (this.props.onNextPage) {
      this.props.onNextPage();
    }
  }

  handleGoToPage(page) {
    if (this.props.onGoToPage) {
      this.props.onGoToPage(page);
    }
  }
}
