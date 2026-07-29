export interface CWDCommentsConfig {
  /**
   * Selector or DOM element to mount the widget
   */
  el: string | HTMLElement;
  
  /**
   * Base URL of the CWD Comments API
   */
  apiBaseUrl: string;
  
  /**
   * Site ID for multi-site support
   */
  siteId?: string;
  
  /**
   * Current post slug (defaults to window.location.pathname)
   */
  postSlug?: string;
  
  /**
   * Current post title (defaults to document.title)
   */
  postTitle?: string;
  
  /**
   * Current post URL (defaults to window.location.href)
   */
  postUrl?: string;
  
  /**
   * Widget theme
   * @default 'light'
   */
  theme?: 'light' | 'dark' | string;
  
  /**
   * Comments per page
   * @default 20
   */
  pageSize?: number;
  
  /**
   * Widget language
   * @default 'auto'
   */
  lang?: 'zh-CN' | 'en-US' | 'auto' | string;
  
  /**
   * Custom CSS URL to load
   */
  customCssUrl?: string;

  /**
   * Enable/Disable comment likes
   */
  enableCommentLike?: boolean;

  /**
   * Enable/Disable article likes
   */
  enableArticleLike?: boolean;

  /**
   * Enable/Disable image lightbox
   */
  enableImageLightbox?: boolean;

  /**
   * Placeholder text for comment input
   */
  commentPlaceholder?: string;

  /**
   * Custom OwO emotion JSON for the emotion picker. Empty values hide the emotion button.
   */
  emotionJson?: string | Record<string, unknown>;

  /**
   * Cloudflare Turnstile site key. Normally loaded from the CWD API.
   */
  turnstileSiteKey?: string;
}

export class CWDComments {
  constructor(config: CWDCommentsConfig);
  
  /**
   * Mount the widget to the DOM
   */
  mount(): void;
  
  /**
   * Unmount the widget and clean up
   */
  unmount(): void;
  
  /**
   * Update widget configuration
   * @param newConfig Partial configuration to update
   */
  updateConfig(newConfig: Partial<CWDCommentsConfig>): void;
  
  /**
   * Get current configuration
   */
  getConfig(): CWDCommentsConfig;
}

export default CWDComments;
