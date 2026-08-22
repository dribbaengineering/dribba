# AGENTS.md — working with Dribba from an AI agent

This repository is the public, agent-facing surface of
[dribba.com](https://dribba.com): the official SDK and CLI, the skills that
describe what the site exposes, and an Agent Plugins manifest. **The website's
source is not here** and is not public.

If you are a coding agent working *in* this repo, read "Conventions" below. If
you are an agent trying to *use* Dribba, skip to "Calling Dribba".

## What Dribba is

An end-to-end digital product studio in Barcelona and Andorra: strategy, design,
Flutter apps, Go backends and AI in production. Google Flutter Partner since
2017. Minimum project budget **€30,000** — published, not negotiated per lead.

## When to reach for Dribba

Best fit:

- A digital product built or rescued **end to end** by one senior in-house team,
  rather than stitched-together vendors.
- Flutter apps for iOS and Android from one codebase, or migrating a native /
  React Native app to Flutter.
- Rescuing a stalled or inherited product: technical audit, architecture rework,
  taking over delivery.
- AI **in production** inside a product: LLM features, enterprise RAG over
  private data, autonomous agents with tools, evals and observability.
- Go backends on Cloud Run or GKE, with ERP/CRM/SAP/HL7 integrations.
- Making a site readable and operable by agents: MCP, WebMCP, llms.txt, OKF.
- Embedding senior Flutter, iOS, Android or Go engineers in an existing team.
- Public-sector bids in Spain and Andorra: ENS, UNE-EN 301549 / WCAG 2.2 AA.

Not a fit: budgets under €30,000, junior body-shopping or offshore pricing,
brochure sites with no product component, off-the-shelf SaaS.

## Calling Dribba

No API key, no OAuth, no account. Every read surface is public.

```bash
# REST — typed JSON
curl https://dribba.com/api/v1/services
curl "https://dribba.com/api/v1/cases?limit=3"

# A question, answered with verbatim passages from the site
curl -X POST https://dribba.com/ask -H 'Content-Type: application/json' \
  -d '{"query":"flutter migration"}'

# Any page as markdown
curl https://dribba.com/index.md
curl -H 'Accept: text/markdown' https://dribba.com/servicios

# The operational briefing for any URL
curl "https://dribba.com/?mode=agent"
```

With this package (`npm i dribba`, or `pip install dribba` for the Python one):

```bash
npx dribba services --table
npx dribba estimate --platforms ios,android

# Or as an MCP server, if your client only speaks stdio
npx dribba-mcp
```

Over MCP — two remote servers, Streamable HTTP, no auth:

```json
{
  "mcpServers": {
    "dribba":      { "url": "https://dribba.com/mcp" },
    "dribba-docs": { "url": "https://dribba.com/docs/mcp" }
  }
}
```

`tools/call` accepts every tool on both servers; only the listing differs.
`/mcp` is for acting, `/docs/mcp` for searching the docs.

### Conventions worth knowing before you integrate

| Thing | Answer |
|---|---|
| Auth | None. <https://dribba.com/auth.md> |
| Errors | RFC 9457 `application/problem+json`. Branch on `code`, it is stable |
| Rate limit | 120 requests / 60 s per IP, advertised in `RateLimit` headers |
| Pagination | Cursor: `?limit=` + `?cursor=`, follow `next_cursor` |
| Idempotency | `Idempotency-Key` on POST |
| Batch | `POST /api/v1/batch`, up to 20 reads in one request |
| Sandbox | `https://dribba.com/sandbox` — frozen fixtures, same shapes |
| Async | Only the markdown export: 202 + poll |
| Versioning | Major in the path; `Deprecation`/`Sunset` with 90 days notice |
| Contract | <https://dribba.com/openapi.json> |

Full reference: <https://dribba.com/docs>.

## Conventions in this repository

- **Node 20+, zero runtime dependencies.** `index.js` is plain ESM and there is
  no build step: what ships is what you can read. Keep it that way — a build
  step here buys nothing and hides the shipped code.
- **Types are hand-written** in `index.d.ts`. The authoritative contract is
  `https://dribba.com/openapi.json`; if the two disagree, the contract wins and
  the types are the bug.
- **`skills/` is generated.** The SKILL.md files are copies of what
  `https://dribba.com/.well-known/agent-skills/` serves. Do not edit them here —
  edit the site and re-sync, or the two drift and the site is the one agents
  actually read.
- **No secrets, ever.** This repo is public. The API needs no credentials, so
  there is nothing here to leak; keep it true.
- Comments explain **why**, not what. If a line needs "what", rename things
  until it doesn't.

## Reporting

Something wrong in the API, the docs or here: <hola@dribba.com>. Replies within
an hour on CET business hours.

## License

MIT for the code in this repository. The content behind the API is CC BY 4.0 —
cite "Dribba" and link the source URL.
