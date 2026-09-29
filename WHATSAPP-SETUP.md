# LifeLoop accounts and reminder demo

## What works now, for ₹0

Start `node scripts/run-framework.mjs dev` and open `http://127.0.0.1:5173/`.

1. Create an account with an email, a password (10+ characters), and an Indian WhatsApp number. Reminder consent is optional. The email is an account identifier; no email or phone OTP is sent.
2. Open **WhatsApp**. The default mode is **In-app preview**. It uses the reminder engine but never calls Meta. No payment account or AI API is required.
3. Try **TODAY**, **HELP**, **STOP**, and **START**, or **Check reminders**. Due today, tomorrow, overdue, and waiting follow-ups appear with a “Preview · not sent” label.
4. While signed in and the page is open, task summaries sync and reminders are checked every minute. The conversation refreshes every 15 seconds. Identical reminders are deduplicated per task/kind/day in Asia/Kolkata.
5. **Explore demo** keeps the existing browser workspace available without signing in. Its chat is temporary. Registered accounts use separate browser storage keys; the original workspace is not reset or copied into another account.

Local Cloudflare D1 stores accounts, salted password hashes, hashed sessions, reminder task summaries and message history. `.openai/hosting.json` enables the DB binding; local tables are initialized on first use. Sessions use HttpOnly, SameSite cookies and Secure cookies on HTTPS. Passwords and provider credentials are never returned to the browser. API mutations check Origin and require authentication, except registration/login and signed provider webhooks. Basic request limits apply.

This is a hackathon account flow: password recovery, verified email ownership, full task backup across devices, retention controls and production security review are not implemented. Tasks/documents/receipts remain browser-local; only titles, dates and status sync to the reminder server. Two browser tabs should not edit different snapshots of the same account simultaneously. Reminder titles can be sensitive; only connect a phone whose owner has opted in.

## Optional real Meta test-number demo

The official API needs a Meta developer app and test resources. This project does not guarantee Meta pricing or free production WhatsApp delivery. Use the current terms shown in your developer dashboard. Never configure a paid production sender just to make a free demo work.

1. Create a developer app with WhatsApp, use its **test phone number**, and add/verify your own recipient phone in Meta's API setup. Follow [Meta's getting-started guide](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started).
2. Copy `.dev.vars.example` to `.dev.vars` inside this project. Fill values privately: access token, test phone-number ID, business/test display number (digits), API version shown in Meta's example request, app secret, a random webhook verify token, and a comma-separated recipient allowlist. Set `WHATSAPP_MODE=test` only after checking that these are test resources. No credential is needed for preview mode.
3. Restart the dev server. For public hosting, configure equivalent server secrets and a persistent D1 binding. A localhost-only URL cannot receive Meta webhooks; provide a public HTTPS deployment/tunnel before the live demo.
4. Configure webhook URL `https://YOUR_HOST/api/lifeloop/webhook`, enter your verify token, and subscribe to messages. POST bodies are checked using Meta's `X-Hub-Signature-256` HMAC and your app secret. The phone-number ID must match the configured test sender.
5. In LifeLoop, sign in, enable consent, open reminder settings and choose **Verify my number**. Open the supplied WhatsApp link and send its expiring `LINK …` token from the phone you entered. An authenticated inbound webhook links the sender. Merely typing a number does not verify it.
6. Send **TODAY** in WhatsApp. The bot supports HELP/TODAY/START/STOP. STOP pauses reminders and cancels queued messages without sending another external acknowledgement. Completing a task still requires evidence in LifeLoop.

The sender only dispatches to allowlisted, verified, opted-in recipients within 23 hours of their latest verified inbound message. It sends free-form text, never paid templates. Messages outside that window stay queued until refreshed or cancelled as stale. Provider acceptance is labelled **accepted**, not delivered; signed delivery callbacks update the state. Ambiguous network failures become **unknown** and are not automatically retried to avoid duplicate sends. Preview messages never become live messages later.

These safeguards reduce accidental sends; they are not a billing guarantee. Meta's public [pricing page](https://business.whatsapp.com/products/platform-pricing) describes per-message charges and service-window exceptions. Check the latest test-number terms and rate card before enabling real sending. Production proactive reminders outside the service window generally need approved templates and may be charged. This version intentionally has no production paid-template mode.

## Alerts while the browser is closed

Local preview checks while the page is open; no background service has been silently installed. The server exports a Cloudflare `scheduled` handler in `build/sites-worker.ts`. Configure a cron trigger (for example every five minutes) on a deployed Worker with persistent D1, or call `POST /api/lifeloop/cron` from a scheduler using `Authorization: Bearer YOUR_CRON_SECRET`. Generate a strong random secret and store it server-side. Do not place it in browser code or a public URL. Do not run both scheduling methods.

The sweep processes up to 100 opted-in accounts; pagination/queues are needed beyond this hackathon scale. Hosting/scheduling free tiers have provider limits and are not guaranteed permanently free. A public deployment, real secrets, webhook subscription and cron setup are intentionally left for the owner; none has been provisioned or charged.

## Verification

```sh
node scripts/test-workflows.mjs
node scripts/test-reminder-api.mjs  # requires the local dev server
node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/run-framework.mjs build
```

The API test creates a clearly named test account in local D1, checks authentication, cross-origin rejection, task sync, duplicate prevention, STOP, preview state, webhook rejection and cron authorization. It does not send WhatsApp messages. The logic suite covers Indian numbers, IST dates, password hashing and HMAC validation.

## INR demo data

Sample amounts and sample documents now use INR fixtures, and UI icons use ₹. Untouched legacy seed amounts are relabelled as INR demo fixtures on read, preserving edits and completion evidence. This is not exchange-rate conversion. Foreign amounts in user-supplied documents should be confirmed as INR by the user; extraction returns “INR amount needed” instead of inventing a conversion. Source documents remain evidence and should never be silently rewritten as a different currency.
