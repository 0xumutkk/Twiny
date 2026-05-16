/**
 * GmailAgent
 *
 * Read-only Gmail connector for the live demo. It reads a narrow slice of
 * the inbox, summarizes locally from metadata/snippets, and never treats mail
 * content as executable instructions.
 */

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

let runtimeRefreshToken: string | null = null;

export interface ImportantEmail {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  snippet: string;
  importanceReason: string;
}

export interface TodayEmailSummary {
  status: 'ok' | 'not_configured' | 'error';
  totalToday: number;
  important: ImportantEmail[];
  summary: string;
  voiceSummary: string;
  authUrl?: string;
  error?: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
}

interface GmailMessageResponse {
  id: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

export function buildGmailOAuthUrl(): string | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = getRedirectUri();
  if (!clientId || !redirectUri) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_READONLY_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function connectGmailWithCode(code: string): Promise<{ ok: boolean; refreshToken?: string; error?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    return { ok: false, error: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must be configured.' };
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }

  const data = await res.json() as { refresh_token?: string };
  if (!data.refresh_token) {
    return {
      ok: false,
      error: 'Google did not return a refresh token. Re-open the auth URL; prompt=consent is required for the demo.',
    };
  }

  runtimeRefreshToken = data.refresh_token;
  return { ok: true, refreshToken: data.refresh_token };
}

export async function summarizeTodayEmails(): Promise<TodayEmailSummary> {
  const accessToken = await getGmailAccessToken();
  if (!accessToken.ok) {
    return {
      status: 'not_configured',
      totalToday: 0,
      important: [],
      summary: 'Gmail is not connected yet.',
      voiceSummary: 'Gmail is not connected yet. Connect Gmail, then ask me again.',
      authUrl: buildGmailOAuthUrl() ?? undefined,
      error: accessToken.error,
    };
  }

  try {
    const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    listUrl.searchParams.set('q', 'newer_than:1d -in:spam -in:trash');
    listUrl.searchParams.set('maxResults', '10');

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken.token}` },
    });

    if (!listRes.ok) {
      return gmailError(await listRes.text());
    }

    const list = await listRes.json() as GmailListResponse;
    const messages = list.messages ?? [];
    if (messages.length === 0) {
      return {
        status: 'ok',
        totalToday: 0,
        important: [],
        summary: 'Bugün gelen önemli bir e-posta yok.',
        voiceSummary: 'Bugün gelen önemli bir e-posta görünmüyor.',
      };
    }

    const details = await Promise.all(
      messages.map(message => fetchGmailMessage(accessToken.token, message.id))
    );

    const important = details
      .filter((message): message is ImportantEmail => Boolean(message))
      .sort((a, b) => scoreEmail(b) - scoreEmail(a))
      .slice(0, 5);

    const summary = buildSummary(important, messages.length);
    return {
      status: 'ok',
      totalToday: messages.length,
      important,
      summary,
      voiceSummary: summary,
    };
  } catch (err) {
    return gmailError(String(err));
  }
}

async function fetchGmailMessage(accessToken: string, id: string): Promise<ImportantEmail | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set('format', 'metadata');
  for (const header of ['From', 'Subject', 'Date']) {
    url.searchParams.append('metadataHeaders', header);
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const message = await res.json() as GmailMessageResponse;
  const headers = message.payload?.headers ?? [];
  const from = getHeader(headers, 'From') || 'Unknown sender';
  const subject = getHeader(headers, 'Subject') || '(no subject)';
  const receivedAt = getHeader(headers, 'Date') || '';
  const snippet = cleanSnippet(message.snippet ?? '');

  return {
    id: message.id,
    from,
    subject,
    receivedAt,
    snippet,
    importanceReason: getImportanceReason(subject, snippet, message.labelIds ?? []),
  };
}

async function getGmailAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (process.env.GMAIL_ACCESS_TOKEN) {
    return { ok: true, token: process.env.GMAIL_ACCESS_TOKEN };
  }

  const refreshToken = runtimeRefreshToken ?? process.env.GMAIL_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    return {
      ok: false,
      error: 'Configure Google OAuth and connect Gmail first. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN or runtime OAuth callback.',
    };
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }

  const data = await res.json() as { access_token?: string };
  if (!data.access_token) return { ok: false, error: 'Google token response did not include access_token.' };
  return { ok: true, token: data.access_token };
}

function getRedirectUri(): string | undefined {
  return process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${process.env.PORT ?? 3001}/api/gmail/oauth/callback`;
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function cleanSnippet(snippet: string): string {
  return snippet.replace(/\s+/g, ' ').trim();
}

function getImportanceReason(subject: string, snippet: string, labelIds: string[]): string {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (labelIds.includes('IMPORTANT')) return 'Gmail bunu önemli olarak işaretlemiş.';
  if (/(urgent|asap|deadline|due|action required|important|kritik|acil|son tarih|onay)/i.test(text)) {
    return 'Aksiyon veya zaman hassasiyeti içeriyor.';
  }
  if (/(invoice|payment|receipt|security|login|meeting|contract|fatura|ödeme|odeme|güvenlik|guvenlik|toplantı|toplanti)/i.test(text)) {
    return 'Finans, güvenlik veya toplantı bağlamı içeriyor.';
  }
  return 'Bugünkü gelen kutusunda öne çıkan yeni bir mesaj.';
}

function scoreEmail(email: ImportantEmail): number {
  const text = `${email.subject} ${email.snippet} ${email.importanceReason}`.toLowerCase();
  let score = 10;
  if (/(urgent|asap|acil|kritik|deadline|son tarih|action required|onay)/i.test(text)) score += 40;
  if (/(security|login|güvenlik|guvenlik)/i.test(text)) score += 30;
  if (/(invoice|payment|receipt|fatura|ödeme|odeme)/i.test(text)) score += 25;
  if (/(meeting|calendar|toplantı|toplanti)/i.test(text)) score += 15;
  return score;
}

function buildSummary(emails: ImportantEmail[], total: number): string {
  if (emails.length === 0) return `Bugün ${total} mail var ama öne çıkan önemli bir konu görünmüyor.`;

  const top = emails.slice(0, 3).map((email, index) => (
    `${index + 1}. ${email.subject} — ${email.importanceReason}`
  ));

  return `Bugün ${total} mail geldi. Önemli görünenler: ${top.join(' ')}`;
}

function gmailError(error: string): TodayEmailSummary {
  return {
    status: 'error',
    totalToday: 0,
    important: [],
    summary: 'Gmail okunurken bir hata oluştu.',
    voiceSummary: 'Gmail okunurken bir hata oluştu. Ayrıntıları ekranda gösteriyorum.',
    error,
  };
}
