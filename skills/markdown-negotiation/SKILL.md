---
name: markdown-negotiation
type: content-negotiation
description: "Dribba serves a markdown representation of any page when the client sends the Accept header text/markdown. HTML remains the default for browsers."
---

# Markdown for Agents — Dribba

Any public page on `https://www.dribba.com` supports HTTP content negotiation
between HTML and Markdown.


## When to use this skill

Use it when you want **the prose of a specific page** without HTML: send
`Accept: text/markdown` to any page URL, or append `.md` (`/servicios.md`).

Do not use it for structured records — services, case studies, jobs as typed
JSON — that is the `rest-api` skill. Do not use it to ingest the whole site in
one pass either; walk the `okf` bundle instead.

## How to request markdown

Send an HTTP GET request with an `Accept: text/markdown` header (or with
markdown weighted equal to or higher than `text/html`):

```
GET / HTTP/1.1
Host: www.dribba.com
Accept: text/markdown
```

## Response

```
HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
x-markdown-tokens: <integer — rough token estimate>
Vary: Accept
```

The response body is a markdown rendering of the page's main content. Script,
style, SVG, navigation, footer, and iframe elements are stripped before
conversion.

## Notes

- Every localized URL is supported (`/`, `/ca/...`, `/en/...`).
- Redirects (301/302/307/308) are forwarded.
- The estimate in `x-markdown-tokens` assumes ~4 characters per token and is
  intended as a hint, not a billing measurement.

## Reference

- https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
- https://isitagentready.com/.well-known/agent-skills/markdown-negotiation/SKILL.md
