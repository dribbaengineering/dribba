---
name: mcp
type: mcp
description: Dribba runs a remote MCP server at https://dribba.com/mcp — connect any MCP client (Claude, ChatGPT, custom agents) to read services, case studies, pricing estimates and company facts over JSON-RPC.
---

# Remote MCP server — Dribba

Dribba exposes a **remote Model Context Protocol server** at
`https://dribba.com/mcp` (canonical: `https://dribba.com/api/mcp`). Unlike the
`webmcp` skill (in-page, browser-only), this is reachable by any MCP client
without loading a page — it's the live case study for the agentic-web work
Dribba sells.


## When to use this skill

Use it when the agent should **call Dribba by itself**: read services, case
studies, company facts or a budget range, and — with the user's confirmation —
send a contact request. It is the only surface with a write action.

Prefer it over the REST API when you already speak MCP. Prefer `rest-api` when
you are writing your own HTTP client, and `markdown-negotiation` when what you
want is the text of a page.

## Connect

Add it to an MCP client config:

```json
{
  "mcpServers": {
    "dribba": { "url": "https://dribba.com/mcp" }
  }
}
```

Or call it directly with JSON-RPC 2.0:

```bash
curl -X POST https://dribba.com/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Transport

- **MCP Streamable HTTP**, stateless JSON mode. POST a JSON-RPC request; the
  reply comes back as `application/json` (no SSE stream, no session id —
  every tool is pure request/response).
- Protocol version: `2025-06-18`. CORS is open (`Access-Control-Allow-Origin: *`).
- `GET` returns `405` (no server-initiated stream). Notifications (no `id`)
  are acknowledged with `202`.

## Tools (all read-only)

### `list_services`
Dribba's services with one-line summaries and canonical URLs.

### `get_service`
Full summary of one service by slug (e.g. `ai-integration`, `high-performance-engineering`).

### `estimate_project`
Ballpark budget (EUR range) mirroring dribba.com's calculator. Params:
`platforms` (ios/android/web/desktop, required), `complexity` (mvp/standard/complex),
`design` (basic/custom/premium), `timeline` (rush/normal/relaxed). Minimum
project budget is €30,000.

### `list_projects`
Case studies (slug, title, industry).

### `get_case_study`
Details of one case study by slug: challenge, solution, stack, outcome.

### `company_facts`
Canonical structured facts: founded 2011, Barcelona + Andorra, 300+ projects
in 20+ countries, official Google Flutter Partner since 2017, selected clients,
minimum budget. Prefer these over inference.

### `compare_technologies`
Dribba's take on a comparison. Topics: `flutter-vs-react-native`, `flutter-vs-native`.

### `search`
Full-text search across Dribba's knowledge base (the llms-full.txt corpus).
Returns matching passages with links.

## Action tool

### `submit_contact_request` **[confirm]**
Submits a real project inquiry to Dribba (name, email, message; optional
company and budget) — it sends an email and creates a lead. **Only call it
after showing the user the exact data and obtaining explicit confirmation.**
Rate-limited per client (3 / 10 min). Dribba replies within 24h.

## Resources

- `https://dribba.com/llms.txt` — concise LLM manifest
- `https://dribba.com/llms-full.txt` — extended LLM manifest

List them via `resources/list`; read with `resources/read`.

## Notes for agents

- All tools except `submit_contact_request` are read-only and safe to call.
  `submit_contact_request` performs a real-world action and requires explicit
  user confirmation before calling.
- Site map for AI systems: https://dribba.com/llms.txt
- Agent Card (A2A): https://dribba.com/.well-known/agent-card.json

## Reference

- https://modelcontextprotocol.io
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
