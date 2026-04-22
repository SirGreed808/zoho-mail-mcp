# zoho-mail-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for Zoho Mail. Lets Claude (or any MCP client) read, search, and send email from a Zoho Mail account without browser automation.

No equivalent exists in the official MCP registry — this fills that gap.

## Tools

| Tool | Description |
|------|-------------|
| `list_inbox` | List recent inbox messages — returns sender, subject, date, messageId, folderId |
| `search_emails` | Search by keyword, sender email, or subject fragment |
| `read_email` | Read full email body given a messageId and folderId |
| `send_email` | Send an email from your configured sender address |

## Prerequisites

- A [Zoho Mail](https://mail.zoho.com) account
- Node.js 18+

## Setup

### 1. Create a Zoho OAuth app

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Create a **Self Client** application
3. Under **Generate Code**, add these scopes:
   ```
   ZohoMail.messages.READ,ZohoMail.messages.CREATE,ZohoMail.folders.READ,ZohoMail.accounts.READ
   ```
4. Set expiry to **10 minutes**, add a description, click **Create**
5. Copy the generated `client_id`, `client_secret`, and grant `code`

### 2. Exchange the grant code for a refresh token

Run immediately (grant code expires in 10 minutes):

```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_GRANT_CODE"
```

Save the `refresh_token` from the response — it doesn't expire.

### 3. Get your account ID

```bash
curl -X GET https://mail.zoho.com/api/accounts \
  -H "Authorization: Zoho-oauthtoken YOUR_ACCESS_TOKEN"
```

Use the `accountId` value from the first object in `data[]`.

### 4. Install

```bash
git clone https://github.com/SirGreed808/zoho-mail-mcp
cd zoho-mail-mcp
npm install
```

### 5. Add to Claude Code

```bash
claude mcp add --scope user \
  -e "ZOHO_CLIENT_ID=..." \
  -e "ZOHO_CLIENT_SECRET=..." \
  -e "ZOHO_REFRESH_TOKEN=..." \
  -e "ZOHO_ACCOUNT_ID=..." \
  -e "ZOHO_SENDER=you@yourdomain.com" \
  zoho-mail -- node /absolute/path/to/zoho-mail-mcp/index.js
```

`ZOHO_SENDER` must be a verified address or alias on the account.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ZOHO_CLIENT_ID` | OAuth app client ID |
| `ZOHO_CLIENT_SECRET` | OAuth app client secret |
| `ZOHO_REFRESH_TOKEN` | Long-lived refresh token (from step 2) |
| `ZOHO_ACCOUNT_ID` | Zoho Mail account ID (from step 3) |
| `ZOHO_SENDER` | Email address to send from |

## Notes

- Access tokens are refreshed automatically — no manual intervention needed
- `read_email` requires both `messageId` and `folderId`, both returned by `list_inbox` and `search_emails`
- Only REST API — no IMAP/SMTP

## License

MIT
