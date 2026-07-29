
import { Bindings } from '../bindings';

export const TG_BOT_TOKEN_KEY = 'telegram_bot_token';
export const TG_CHAT_ID_KEY = 'telegram_chat_id';
export const TG_NOTIFY_ENABLED_KEY = 'telegram_notify_enabled';

export interface TelegramSettings {
  botToken: string | null;
  chatId: string | null;
  notifyEnabled: boolean;
}

/** Telegram Bot API response envelope. */
export interface TelegramApiResponse<TResult = unknown> {
  ok: boolean;
  result?: TResult;
  description?: string;
  error_code?: number;
}

export async function loadTelegramSettings(env: Bindings): Promise<TelegramSettings> {
  const keys = [TG_BOT_TOKEN_KEY, TG_CHAT_ID_KEY, TG_NOTIFY_ENABLED_KEY];
  const { results } = await env.CWD_DB.prepare(
    'SELECT key, value FROM Settings WHERE key IN (?, ?, ?)'
  )
    .bind(...keys)
    .all<{ key: string; value: string }>();

  const map = new Map<string, string>();
  for (const row of results) {
    map.set(row.key, row.value);
  }

  return {
    botToken: map.get(TG_BOT_TOKEN_KEY) ?? null,
    chatId: map.get(TG_CHAT_ID_KEY) ?? null,
    notifyEnabled: map.get(TG_NOTIFY_ENABLED_KEY) === '1',
  };
}

export async function saveTelegramSettings(env: Bindings, settings: TelegramSettings) {
  const entries = [
    { key: TG_BOT_TOKEN_KEY, value: settings.botToken },
    { key: TG_CHAT_ID_KEY, value: settings.chatId },
    { key: TG_NOTIFY_ENABLED_KEY, value: settings.notifyEnabled ? '1' : '0' },
  ];

  for (const entry of entries) {
    if (entry.value !== undefined && entry.value !== null) {
        await env.CWD_DB.prepare('REPLACE INTO Settings (key, value) VALUES (?, ?)')
            .bind(entry.key, entry.value)
            .run();
    } else if (entry.value === null) { // Explicit null means delete
         await env.CWD_DB.prepare('DELETE FROM Settings WHERE key = ?').bind(entry.key).run();
    }
  }
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  options: any = {}
): Promise<TelegramApiResponse> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return response.json<TelegramApiResponse>();
}

export async function setTelegramWebhook(token: string, webhookUrl: string): Promise<TelegramApiResponse> {
    const url = `https://api.telegram.org/bot${token}/setWebhook`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
    });
    return response.json<TelegramApiResponse>();
}

export async function deleteMessage(token: string, chatId: string | number, messageId: number) {
    const url = `https://api.telegram.org/bot${token}/deleteMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
}

export async function editMessageText(
  token: string,
  chatId: string | number,
  messageId: number,
  text: string,
  options: any = {}
): Promise<TelegramApiResponse> {
     const url = `https://api.telegram.org/bot${token}/editMessageText`;
      const body = {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        ...options,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return response.json<TelegramApiResponse>();
}

export async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
     const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
     await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
}
