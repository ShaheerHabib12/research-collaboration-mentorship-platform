/**
 * mailer.js - sends e-mail through an HTTPS API (no SMTP, no dependencies).
 *
 * Why an HTTP API: free hosts such as Render block outgoing SMTP ports, but HTTPS always works.
 *
 *   RCMP_MAIL_PROVIDER   brevo | resend | console   (empty = e-mail is off)
 *   RCMP_MAIL_API_KEY    the provider's API key (a secret: set it on the host, never commit it)
 *   RCMP_MAIL_FROM       sender address; must be verified with the provider
 *   RCMP_MAIL_FROM_NAME  display name (default "RCMP")
 *
 * "console" prints the message to the server log instead of sending it. It is for development only,
 * because it would put PINs in the log.
 */
'use strict';

function createMailer(env) {
  env = env || process.env;
  const provider = (env.RCMP_MAIL_PROVIDER || '').toLowerCase();
  const key = env.RCMP_MAIL_API_KEY || '', from = env.RCMP_MAIL_FROM || '', fromName = env.RCMP_MAIL_FROM_NAME || 'RCMP';
  const fetchFn = env.__fetch || globalThis.fetch;

  async function post(url, headers, body) {
    const res = await fetchFn(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json' }, headers), body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!res.ok) { let t = ''; try { t = (await res.text()).slice(0, 200); } catch (e) { /* ignore */ } throw new Error(provider + ' refused the message (HTTP ' + res.status + ') ' + t); }
  }

  const impl = {
    brevo: (m) => post('https://api.brevo.com/v3/smtp/email', { 'api-key': key }, { sender: { email: from, name: fromName }, to: [{ email: m.to }], subject: m.subject, textContent: m.text, htmlContent: m.html || undefined }),
    resend: (m) => post('https://api.resend.com/emails', { Authorization: 'Bearer ' + key }, { from: fromName + ' <' + from + '>', to: [m.to], subject: m.subject, text: m.text, html: m.html || undefined }),
    console: async (m) => { console.log('[mail:console] to=' + m.to + ' subject=' + m.subject + '\n' + m.text); }
  };

  return {
    provider,
    /** True when messages really leave the server (used to switch e-mail verification on). */
    get enabled() { return !!impl[provider] && provider !== 'console'; },
    /** Whether a provider is configured at all (console counts, for development). */
    get configured() { return !!impl[provider]; },
    /** Missing settings, so start-up can fail loudly instead of silently not sending. */
    problems() {
      if (!provider) return [];
      if (!impl[provider]) return ['RCMP_MAIL_PROVIDER must be brevo, resend or console'];
      return provider === 'console' ? [] : [!key && 'RCMP_MAIL_API_KEY', !from && 'RCMP_MAIL_FROM'].filter(Boolean).map((n) => n + ' is not set');
    },
    /** @param {{to:string, subject:string, text:string, html?:string}} m */
    async send(m) { if (!impl[provider]) throw new Error('E-mail is not configured.'); return impl[provider](m); }
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The verification message: plain text first, simple HTML second. */
function pinMessage(name, pin, minutes) {
  const text = 'Hello ' + name + ',\n\nYour RCMP verification code is ' + pin + '\n\nIt expires in ' + minutes + ' minutes. If you did not create an account, ignore this message and nothing will happen.\n\nRCMP - Research Collaboration and Mentorship Platform';
  const html = '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2A2D32"><h2 style="color:#A8452B;margin:0 0 12px">Verify your email</h2><p>Hello ' + esc(name) + ',</p><p>Your RCMP verification code is</p><p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:12px 0">' + pin + '</p><p>It expires in ' + minutes + ' minutes. If you did not create an account, ignore this message and nothing will happen.</p><p style="color:#777;font-size:12px">RCMP - Research Collaboration and Mentorship Platform</p></div>';
  return { subject: 'Your RCMP verification code: ' + pin, text, html };
}

function resetMessage(name, link) {
  const text = 'Hello ' + name + ',\n\nUse this link to choose a new password. It works once and expires in 30 minutes:\n' + link + '\n\nIf you did not ask for this, ignore this message.\n\nRCMP';
  const html = '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2A2D32"><h2 style="color:#A8452B;margin:0 0 12px">Reset your password</h2><p>Hello ' + esc(name) + ',</p><p><a href="' + esc(link) + '">Choose a new password</a>. The link works once and expires in 30 minutes.</p><p>If you did not ask for this, ignore this message.</p></div>';
  return { subject: 'Reset your RCMP password', text, html };
}

module.exports = { createMailer, pinMessage, resetMessage };
