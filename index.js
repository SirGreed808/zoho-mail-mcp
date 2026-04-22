#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID, ZOHO_SENDER } = process.env;

if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN || !ZOHO_ACCOUNT_ID || !ZOHO_SENDER) {
  console.error(
    "Missing required env vars: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNT_ID, ZOHO_SENDER"
  );
  process.exit(1);
}

const SENDER = ZOHO_SENDER;
const BASE = "https://mail.zoho.com/api";

// ── Token management ──────────────────────────────────────────────────────────
let _token = null;
let _tokenExpiresAt = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiresAt - 60_000) return _token;
  const res = await fetch("https://accounts.zoho.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      refresh_token: ZOHO_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  _token = data.access_token;
  _tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return _token;
}

async function zohoFetch(path, method = "GET", body = null) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zoho ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const server = new McpServer({ name: "zoho-mail", version: "1.0.0" });

// ── Tool: list_inbox ──────────────────────────────────────────────────────────
server.tool(
  "list_inbox",
  "List recent inbox messages from hey@honestdev808.com — returns sender, subject, date, messageId, and folderId",
  { count: z.number().optional().describe("Number of messages to return (default 20)") },
  async ({ count = 20 }) => {
    const data = await zohoFetch(
      `/accounts/${ZOHO_ACCOUNT_ID}/messages/view?folderId=inbox&limit=${count}`
    );
    const messages = (data.data || []).map((m) => ({
      messageId: m.messageId,
      folderId: m.folderId,
      subject: m.subject,
      from: m.fromAddress,
      date: m.receivedTime,
      summary: m.summary,
    }));
    return { content: [{ type: "text", text: JSON.stringify(messages, null, 2) }] };
  }
);

// ── Tool: search_emails ───────────────────────────────────────────────────────
server.tool(
  "search_emails",
  "Search inbox by keyword, sender email, or subject fragment — returns messageId and folderId for use with read_email",
  {
    query: z.string().describe("Search term — keyword, sender email, or subject fragment"),
    count: z.number().optional().describe("Max results (default 20)"),
  },
  async ({ query, count = 20 }) => {
    const data = await zohoFetch(
      `/accounts/${ZOHO_ACCOUNT_ID}/messages/search?searchKey=${encodeURIComponent(query)}&limit=${count}`
    );
    const messages = (data.data || []).map((m) => ({
      messageId: m.messageId,
      folderId: m.folderId,
      subject: m.subject,
      from: m.fromAddress,
      date: m.receivedTime,
      summary: m.summary,
    }));
    return { content: [{ type: "text", text: JSON.stringify(messages, null, 2) }] };
  }
);

// ── Tool: read_email ──────────────────────────────────────────────────────────
server.tool(
  "read_email",
  "Read the full body of an email given its messageId and folderId (both returned by list_inbox and search_emails)",
  {
    messageId: z.string().describe("Message ID from list_inbox or search_emails"),
    folderId: z.string().describe("Folder ID from list_inbox or search_emails"),
  },
  async ({ messageId, folderId }) => {
    const data = await zohoFetch(
      `/accounts/${ZOHO_ACCOUNT_ID}/folders/${folderId}/messages/${messageId}`
    );
    return { content: [{ type: "text", text: JSON.stringify(data.data || data, null, 2) }] };
  }
);

// ── Tool: send_email ──────────────────────────────────────────────────────────
server.tool(
  "send_email",
  "Send an email from hey@honestdev808.com",
  {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    content: z.string().describe("Email body — HTML is supported"),
  },
  async ({ to, subject, content }) => {
    const data = await zohoFetch(`/accounts/${ZOHO_ACCOUNT_ID}/messages`, "POST", {
      fromAddress: SENDER,
      toAddress: to,
      subject,
      content,
      mailFormat: "html",
    });
    return {
      content: [{ type: "text", text: `Sent. Message ID: ${data.data?.messageId ?? "—"}` }],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
