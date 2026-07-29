import { Context } from 'hono';
import { Bindings } from '../../bindings';
import { checkContent } from '../public/postComment';
import xss from 'xss';
import { parseMarkdown } from '../../utils/markdown';

export const updateComment = async (c: Context<{ Bindings: Bindings }>) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const rawId = body?.id;
  const id =
    typeof rawId === 'number'
      ? rawId
      : typeof rawId === 'string' && rawId.trim()
      ? Number.parseInt(rawId.trim(), 10)
      : NaN;

  if (!Number.isFinite(id) || id <= 0) {
    return c.json({ message: 'Missing or invalid id' }, 400);
  }

  const existing = await c.env.CWD_DB.prepare(
    'SELECT id, status, post_slug, post_url, priority FROM Comment WHERE id = ?'
  )
    .bind(id)
    .first<{
      id: number;
      status: string;
      post_slug: string;
      post_url: string | null;
      priority: number | null;
    }>();

  if (!existing) {
    return c.json({ message: 'Comment not found' }, 404);
  }

  const rawName = typeof body.name === 'string' ? body.name : '';
  const rawEmail = typeof body.email === 'string' ? body.email : '';
  const rawUrl = typeof body.url === 'string' ? body.url : '';
  const rawStatus = typeof body.status === 'string' ? body.status : existing.status;
  const rawPriority = body.priority;
  const hasPostSlugField =
    Object.prototype.hasOwnProperty.call(body, 'postSlug') ||
    Object.prototype.hasOwnProperty.call(body, 'post_slug');
  const rawPostSlug =
    typeof body.postSlug === 'string'
      ? body.postSlug
      : typeof body.post_slug === 'string'
      ? body.post_slug
      : '';
  const hasPostUrlField =
    Object.prototype.hasOwnProperty.call(body, 'postUrl') ||
    Object.prototype.hasOwnProperty.call(body, 'post_url');
  const rawPostUrl =
    typeof body.postUrl === 'string'
      ? body.postUrl
      : typeof body.post_url === 'string'
      ? body.post_url
      : '';

  const contentSource =
    typeof body.content === 'string'
      ? body.content
      : typeof body.contentText === 'string'
      ? body.contentText
      : '';

  const name = rawName.trim();
  const email = rawEmail.trim();
  const url = rawUrl.trim() || null;
  const status = rawStatus.trim();
  const postSlug = hasPostSlugField
    ? (rawPostSlug.trim() || existing.post_slug)
    : existing.post_slug;
  const postUrl = hasPostUrlField
    ? (rawPostUrl.trim() || null)
    : existing.post_url;

  let priority: number = typeof existing.priority === 'number' && Number.isFinite(existing.priority)
    ? existing.priority
    : 1;

  if (rawPriority !== undefined && rawPriority !== null) {
    const parsed =
      typeof rawPriority === 'number'
        ? rawPriority
        : typeof rawPriority === 'string' && rawPriority.trim()
        ? Number.parseInt(rawPriority.trim(), 10)
        : NaN;
    if (Number.isFinite(parsed) && parsed >= 1) {
      priority = parsed;
    }
  }

  if (!name) {
    return c.json({ message: '昵称不能为空' }, 400);
  }
  if (!email) {
    return c.json({ message: '邮箱不能为空' }, 400);
  }

  const cleanedContent = checkContent(contentSource);
  const contentText = cleanedContent;

  if (!contentText) {
    return c.json({ message: '评论内容不能为空' }, 400);
  }

  const html = await parseMarkdown(cleanedContent);
  const contentHtml = xss(html, {
    whiteList: {
      ...xss.whiteList,
      code: ['class'],
      span: ['class', 'style'],
      pre: ['class'],
      div: ['class', 'style'],
      img: ['src', 'alt', 'title', 'width', 'height', 'style']
    }
  });

  const { success } = await c.env.CWD_DB.prepare(
    'UPDATE Comment SET name = ?, email = ?, url = ?, content_text = ?, content_html = ?, status = ?, post_slug = ?, post_url = ?, priority = ? WHERE id = ?'
  )
    .bind(name, email, url, contentText, contentHtml, status, postSlug, postUrl, priority, id)
    .run();

  if (!success) {
    return c.json({ message: 'Update failed' }, 500);
  }

  return c.json({
    message: `Comment updated, id: ${id}.`
  });
};
