# HTTP API

Programmatic access to Lummus. Used for automation (bulk invite creation, future integrations). All `/api/*` routes are bearer-token authenticated — they do **not** use the session cookie.

## Auth

Every request must include:

```
Authorization: Bearer $LUMMUS_API_TOKEN
```

The token is a single shared secret stored in the server env var `LUMMUS_API_TOKEN`. Comparison is constant-time. Rotation = change the env var and restart the app.

| Status | Meaning |
|---|---|
| 401 | Header missing, malformed, or token wrong |
| 503 | Server has no `LUMMUS_API_TOKEN` set (fail-closed) |

### Generating a token

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

### Setting it on Scalingo

```sh
scalingo --app crmenergy env-set LUMMUS_API_TOKEN='<paste-token>'
scalingo --app crmenergy restart
```

### Setting it locally

Add `LUMMUS_API_TOKEN="..."` to `.env`, then restart the dev server.

---

## Endpoints

### `POST /api/invites` — create an invite

Creates a single-use invite link. Role and workshop access are applied automatically when the user signs up — same fields as the admin UI.

**Request body** (all fields optional):

| field | type | default | notes |
|---|---|---|---|
| `email` | string | null | If set, only this address can use the invite |
| `ttlDays` | number | 7 | Must be > 0 and ≤ 365 |
| `workshopRole` | `"PM"` \| `"Engineer"` \| `"IT"` | null | Applied to `user.workshop_role` at signup |
| `workshopCodes` | string[] | null | e.g. `["W1", "W2"]` — each must exist |

**Response (200)**:

```json
{
  "ok": true,
  "code": "P0oA3KD4-v6Iakr8tZh87TO6",
  "inviteUrl": "https://crmenergy.osc-fr1.scalingo.io/signup?invite=P0oA3KD4-v6Iakr8tZh87TO6",
  "expiresAt": "2026-05-29T07:37:18.502Z",
  "email": "tina@partner.com",
  "workshopRole": "IT",
  "workshopCodes": ["W2"]
}
```

**Error codes**:

| Status | When |
|---|---|
| 400 | Body is not JSON / unknown workshop code / `ttlDays > 365` |
| 401 | Bearer token missing or wrong |
| 503 | Server has no token configured |

**Example — single invite**:

```sh
curl -s -X POST https://crmenergy.osc-fr1.scalingo.io/api/invites \
  -H "Authorization: Bearer $LUMMUS_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tina@partner.com",
    "workshopRole": "IT",
    "workshopCodes": ["W2"],
    "ttlDays": 14
  }'
```

**Example — bulk invites from a CSV** (`people.csv`: `email,role,workshops`):

```sh
while IFS=, read -r email role workshops; do
  codes=$(echo "[\"${workshops//;/\",\"}\"]")
  curl -s -X POST https://crmenergy.osc-fr1.scalingo.io/api/invites \
    -H "Authorization: Bearer $LUMMUS_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"workshopRole\":\"$role\",\"workshopCodes\":$codes}" \
    | jq -r '.inviteUrl'
done < people.csv
```

---

## Adding new endpoints

Drop a `+server.ts` under `src/routes/api/<route>/`. Call `requireApiToken(request)` first to enforce auth. The hook in `src/hooks.server.ts` already treats `/api/*` as public for session purposes — bearer-token auth is the gate.

## Future: per-integration tokens

The current single-token design (Option A) is intentionally minimal. To upgrade to multiple revocable tokens with audit (Option B):

1. Add an `api_token` table (`id`, `name`, `token_hash`, `created_by`, `created_at`, `last_used_at`, `revoked_at`).
2. Replace the `requireApiToken` implementation with a DB lookup (SHA-256 the incoming token, find by hash, check not revoked, update `last_used_at`).
3. Add a small admin UI (`/users` → "API tokens" tab) to mint/revoke.

The endpoint contract stays the same; only the guard helper changes.
