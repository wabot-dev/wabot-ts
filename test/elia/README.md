# Elia test bot & HubSpot real-sandbox verification

Elia is the test bot used to exercise the framework end-to-end. Its chat controller (`EliaChatController.ts`) is wired with `@wasender()`, `@cmd()`, and — for the HubSpot channel — `@hubspot()`.

This README documents the **HubSpot real-sandbox verification** flow. It is complementary to `_hubspot_smoke_.ts` (which validates webhook signature logic without touching HubSpot) — `_hubspot_sandbox_.ts` validates the full pipeline against a real HubSpot developer account.

## Prerequisites

- A free HubSpot developer account: <https://developers.hubspot.com>.
- A tunnel tool installed locally: `cloudflared` (recommended, no signup needed) or `ngrok` (requires a free account + authtoken).
- Node 20+ and the repo dependencies installed (`npm install`).

## 1. Create a HubSpot dev app and grab credentials

1. In <https://developers.hubspot.com>, create a new **test account** (portal). It comes with its own Inbox and a fresh conversations channel.
2. In the test portal, open **Settings → Integrations → Private apps** and create a private app with these scopes:
   - `conversations` (read + write)
   - `files` (read + write)
3. Copy the **access token** (looks like `pat-na1-...`). Store it in `.env` at the repo root — do **not** paste it into chat.
4. Pick a **webhook secret** (e.g. `elia-dev-secret-2026-a4f1` or `openssl rand -hex 32`). You'll define it on HubSpot's side and put the same value in `.env`:
   ```bash
   cat >> .env <<EOF
   HUBSPOT_ACCESS_TOKEN=pat-na1-...
   HUBSPOT_WEBHOOK_SECRET=elia-dev-secret-2026-a4f1
   HUBSPOT_SENDER_ACTOR_ID=A-12345678
   EOF
   ```
   `HUBSPOT_SENDER_ACTOR_ID` is the **actor ID** HubSpot will attribute the bot's outbound message to (an "A-" prefix followed by the numeric ID, e.g. the agent assigned to the thread, or the bot's own actor if you've registered one). Find yours via `GET https://api.hubapi.com/crm/v3/owners` filtered to your portal. The Conversations API rejects `POST .../messages` with `400 VALIDATION_ERROR` if this is missing.
5. In the test portal, open the **Conversations Inbox** (e.g. go to `https://app.hubspot.com/inbox/<portalId>/inbox`) and send yourself a test message from the test email channel. This materializes the thread you will point the verification script at.

## 2. Configure the webhook subscription

1. In your dev app, go to **Webhooks** → **Create subscription**.
2. Target URL: leave blank for now — you'll fill it in step 4 once the tunnel is up.
3. Subscription type: at minimum `conversation.newMessage` (and optionally `conversation.creation`).
4. In the **signature** settings, paste the same `HUBSPOT_WEBHOOK_SECRET` you put in `.env`. HubSpot uses this to sign every outbound webhook with HMAC-SHA256 v3.

## 3. Start the bot locally

```bash
HUBSPOT_ACCESS_TOKEN=$(grep HUBSPOT_ACCESS_TOKEN .env | cut -d= -f2) \
HUBSPOT_WEBHOOK_SECRET=$(grep HUBSPOT_WEBHOOK_SECRET .env | cut -d= -f2) \
HUBSPOT_SENDER_ACTOR_ID=$(grep HUBSPOT_SENDER_ACTOR_ID .env | cut -d= -f2) \
PORT=3000 \
npm run elia:dev
```

Look for the line `[hubspot-webhook:HubSpotChannel] server listening at 0.0.0.0:3000` (or similar) in the logs. Note: the existing `EliaChatController` registers the webhook at path `/hubspot/webhook/elia`.

## 4. Expose localhost via a tunnel

In a second terminal:

```bash
# cloudflared quick tunnel — no signup
cloudflared tunnel --url http://localhost:3000
```

The output contains a line like `https://a1b2c3d4.trycloudflare.com`. Copy that URL. Then go back to the dev app → Webhooks → your subscription → set **Target URL** to:

```
https://a1b2c3d4.trycloudflare.com/hubspot/webhook/elia
```

HubSpot will probe the URL with a handshake; once it returns 200, the subscription becomes **Active**.

If you prefer ngrok: `ngrok http 3000`, then copy the `https://...ngrok-free.app` URL.

## 5. Send test messages from the HubSpot Inbox

Open the Inbox in a browser and send three messages from the test contact into the inbox:

1. **"hola"** — covers roundtrip + markdown rich text (the bot replies with `**Hola <name>**, dijiste: hola`, HubSpot renders bold).
2. **An image + "probar adjunto entrante"** — covers inbound attachments. The bot's reply will include "(con 1 adjunto)" if it received the file.
3. **"mandame un archivo"** — covers outbound attachments. The bot replies with a 1x1 transparent PNG.

After each message, look at the bot logs in terminal 1 — you should see the inbound payload logged, the `**Hola ...**` reply rendered, and (for the third) an upload to the Files API.

## 6. Run the verification script

Copy the `threadId` from the Inbox URL (it's the long numeric segment after `/inbox/`) — or read it from the bot's logs.

```bash
HUBSPOT_ACCESS_TOKEN=$(grep HUBSPOT_ACCESS_TOKEN .env | cut -d= -f2) \
HUBSPOT_THREAD_ID=12345678 \
npm run test:elia:hubspot -- \
  --require-markdown \
  --require-inbound-files=1 \
  --require-outbound-files=1
```

The script:

1. Polls the Conversations API every 2 s for up to 30 s (configurable via `--poll-seconds`), waiting for an `OUTGOING` reply to land.
2. Prints a table of the last messages in the thread.
3. Asserts:
   - **roundtrip**: the latest `OUTGOING` message starts with `**Hola`.
   - **markdown** (if `--require-markdown`): the same message has `richText` containing `<b>...</b>`.
   - **inbound attachments** (if `--require-inbound-files=N`): the latest `INCOMING` message has ≥ N attachments.
   - **outbound attachments** (if `--require-outbound-files=N`): the latest `OUTGOING` message has ≥ N attachments.
4. Exits 0 if all assertions pass, 1 if any fail.

Useful flags:

- `--thread=<id>` — pass thread explicitly (otherwise uses `HUBSPOT_THREAD_ID`).
- `--poll-seconds=60` — increase the wait window if you expect slow roundtrips.
- `--limit=20` — fetch more history.
- `--json` — dump the full message list as JSON for debugging.
- `--require-inbound-files=0 --require-outbound-files=0` — disable those checks if you only want the roundtrip.

## 7. Update the PR

When everything passes, capture the script output and paste it into PR #47's "Test plan" section, then commit any tweaks to `EliaChatController.ts` or `_hubspot_sandbox_.ts` on `feature/hubspot-channel` with a `test(elia): real-sandbox HubSpot verification script + docs` message.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Webhook returns 401 in the cloudflared logs | `HUBSPOT_WEBHOOK_SECRET` in `.env` differs from the one configured in the dev app | Re-set both to the same string |
| Webhook returns 400 with "expected event batch array" | HubSpot sends a different event shape than the type union expects | Check the bot logs for the raw event; extend `IHubSpotWebhookEvent` if HubSpot added a new subscription type |
| `404` on `GET /conversations/v3/conversations/<id>/messages` | Wrong threadId or missing `conversations` scope on the token | Verify the URL in the Inbox and the scopes in the private app |
| Bot logs `failed to download HubSpot attachment 'X'` | The attachment URL requires extra auth or has expired | Most HubSpot attachment URLs are pre-signed; check if they are still valid. If persistent, the API may need an `Authorization: Bearer` header (already included) or a refresh |
| Script exits with "no OUTGOING message with text yet" | The bot's reply never landed | Check that the tunnel is up, the webhook subscription is **Active** in the dev app, and the bot logs show the inbound event |
| Cloudflared URL changes every restart | Quick tunnels are ephemeral | Restart tunnel, re-paste the new URL into the webhook subscription |

## Security reminders

- Never paste `HUBSPOT_ACCESS_TOKEN` or `HUBSPOT_WEBHOOK_SECRET` into chat, screenshots, or git-tracked files. The `.env` at the repo root is already gitignored.
- Rotate the token immediately if it leaks (dev app → private app → rotate).
- The `HUBSPOT_WEBHOOK_SECRET` should be unique per environment (dev/staging/prod) so a leak in one doesn't compromise the others.
