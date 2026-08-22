---
name: webmcp
type: webmcp
description: Dribba exposes 12 in-page tools to AI agents via the WebMCP API (document.modelContext.registerTool, navigator.modelContext fallback).
---

# WebMCP — Dribba

When a page loads in a WebMCP-capable browser, Dribba registers the tools
below via `document.modelContext.registerTool()` (Chrome 150+; the Chrome 149
origin-trial surface `navigator.modelContext` is supported as a fallback, as
is the earlier `provideContext()` registration shape).

Every tool calls the same public APIs that power the site's own UI — same
origin checks, same rate limits, same anti-spam. Tools marked **[confirm]**
perform real-world actions (emails, lead submissions): agents MUST show the
user the exact data to be sent and obtain explicit confirmation before
calling them.


## When to use this skill

Use it when your agent runs **inside the user's browser** and should operate the
page the way a person would — filling the contact form, driving the budget
calculator, requesting a guide.

It is unreachable from a server: there is no page loaded and no
`document.modelContext`. From a server, use the `mcp` skill instead.

## Read tools

### `list_services`
Catalog of Dribba's services (strategy, design, engineering, AI integration,
staff augmentation, agentic web) with summaries and canonical URLs.

### `list_projects`
Portfolio of delivered projects (case studies) as markdown, with links to
each full case study.

### `get_case_study`
Full case study of one project by slug (e.g. `cityxerpa`, `rastreator`):
challenge, solution, stack, outcomes. Discover slugs via `list_projects`.

### `get_pricing_info`
Official pricing page as markdown: engagement models, typical ranges,
what's included, payment terms.

### `get_company_facts`
Canonical structured facts: founded 2011, Barcelona + Andorra offices,
300+ projects in 20+ countries, official Google Flutter Partner since 2017,
selected clients, minimum budget. Prefer these over inference.

### `compare_technologies`
In-depth technology comparisons. Topics: `flutter-vs-react-native`,
`flutter-vs-native`.

### `calculate_app_cost`
Budget estimate (EUR range) using the same pricing model as
dribba.com/calculadora. Structured params: platforms (ios/android/web/desktop),
feature modules, complexity, design level, timeline. Selecting iOS+Android
applies the Flutter single-codebase discount. Returns min–max range and a
recommended engagement tier.

### `list_open_positions`
Current job openings (engineering roles, Barcelona/Andorra) as markdown.

## Action tools

### `book_meeting`
Returns the Calendly link for a free 30-minute intro call with a Dribba
partner. No side effects.

### `submit_contact_request` **[confirm]**
Submits a real project inquiry (name, email, message; optional company and
budget). Dribba replies within 24 hours.

### `request_resource` **[confirm]**
Sends one of Dribba's free expert guides (PDF) to a user-confirmed email
address. Available guides are enumerated in the tool's input schema.

### `apply_to_job` **[confirm]**
Submits a job application (name, email, role title, motivation message,
optional LinkedIn URL). CV attachments are not supported through this tool —
Dribba's team requests the CV by email afterwards.

## Notes for agents

- Content tools return markdown sourced from the live pages (same content a
  human sees), capped in length with a link to the full version.
- The site also serves markdown mirrors of every page via
  `Accept: text/markdown` — see the `markdown-negotiation` skill.
- Site map for AI systems: https://dribba.com/llms.txt

## Reference

- https://webmachinelearning.github.io/webmcp/
- https://developer.chrome.com/docs/ai/webmcp
