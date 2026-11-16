# E-mail verification (PIN) and password-reset e-mail

## What it does
- When e-mail is configured, a new account is **not usable until the owner types a 6-digit PIN** sent to the address. The PIN comes from the operating system's random generator, lasts **10 minutes**, allows **5 wrong tries**, can be re-sent after **60 seconds** (at most **5 per hour**), and only a keyed hash of it is stored.
- Registering again with an unconfirmed address replaces that unconfirmed account (the address belongs to whoever proves they own it).
- The same e-mail service sends the password-reset link (the link is then no longer shown on the page).
- If `RCMP_MAIL_PROVIDER` is empty, nothing changes: sign-up works without a PIN (this is how the demo and the tests run).
- Demo accounts and the real administrator are never asked for a PIN.

## Why an HTTP e-mail API
Free hosts such as Render block outgoing SMTP ports, so the server sends mail over HTTPS to a provider's API (no extra npm packages). Two providers are built in:

| Provider | Free allowance | Notes |
|---|---|---|
| **Brevo** (`brevo`) | 300 e-mails a day | You only have to verify one sender address (for example your university address). Recommended. |
| Resend (`resend`) | 100 a day | Can only send to anyone after you verify a domain you own; without one it sends only to your own address. |

## Set up Brevo (about 10 minutes)
1. Create an account at brevo.com and confirm your e-mail. New accounts can be reviewed before sending is allowed; if sending is refused, contact Brevo support.
2. **Senders, domains and dedicated IPs, then Domains, then Add a domain.** Brevo only trusts a domain you own. Add its records at your DNS host (a Brevo code TXT, two DKIM CNAMEs, a DMARC TXT), then click Verify records and Authenticate domain. We used `rcmp-team02.me` (Namecheap).
   Then **Senders, then Add a sender** (we used `noreply@rcmp-team02.me`). On an authenticated domain it shows Verified without a code. With a plain Gmail or university address Brevo rewrites or rejects the sender, so the domain comes first.
3. **SMTP and API, then API keys, then Generate a new API key.** Choose **Restricted** access and set only **Transactional email** to **All** (a key with every row on None cannot send). Copy it once. Use the **API key** (starts with `xkeysib-`), not the SMTP password.
4. On your host (Render) add:
   - `RCMP_MAIL_PROVIDER` = `brevo`
   - `RCMP_MAIL_API_KEY` = the key
   - `RCMP_MAIL_FROM` = the verified sender address
   - `RCMP_MAIL_FROM_NAME` = `RCMP`
   - `RCMP_PUBLIC_URL` = `https://rcmp-team02.me`, or your own address (no trailing slash)
5. Redeploy. The log must say `E-mail verification: ON (brevo)`. Register with a second address you own: the PIN mail should arrive within a minute (check spam).

Start-up stops with a clear message if the provider is `brevo` or `resend` and the key or sender is missing.

## Try it on your computer without sending mail
```
RCMP_MAIL_PROVIDER=console RCMP_REQUIRE_VERIFY=1 npm start
```
The PIN is printed in the terminal. Do not use `console` on a live site: it puts PINs in the log.

## Limits (be honest in the report)
- Verification proves control of a mailbox, not identity or a university affiliation.
- Unconfirmed accounts are kept until the address is registered again; there is no automatic clean-up job.
- The mail itself was tested here with a captured sender and a mocked HTTP call (TC-VF-01 to 12, TC-E2E-19). On 16 November 2026 the team also ran a real delivery on the live site (https://rcmp-team02.me, Brevo, sender noreply@rcmp-team02.me on a domain authenticated with SPF, DKIM and DMARC records): a sign-up PIN e-mail and a password-reset e-mail both reached a Gmail inbox. This was a manual check with screenshots, not an automated test.
- Request limits (12 per 10 minutes per client on register, resend and verify) are held in memory, so they reset when the server restarts and are per server instance.
