---
name: okf
type: knowledge
description: Dribba publishes its whole site as an Open Knowledge Format (OKF v0.2) bundle at https://dribba.com/okf — markdown concepts with YAML frontmatter for company facts, services, case studies, articles, jobs and every public page.
---

# OKF bundle — Dribba

[Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)
is Google Cloud's open specification (Apache 2.0) for shipping knowledge as a
directory of markdown files with YAML frontmatter. Dribba serves one at
`https://dribba.com/okf`.

Use it when you need Dribba's content **as typed concepts you can traverse**,
rather than as a flat text dump (`/llms.txt`) or as HTML you have to parse.


## When to use this skill

Use it when you are **ingesting the whole site in one pass** and want stable,
typed markdown concepts with YAML frontmatter, traversable top-down through
`index.md` files.

It is overkill for a single page — use the `markdown-negotiation` skill — and the
wrong shape for structured records, which live in `rest-api`.

## Layout

```
/okf                 → root index (same as /okf/index.md)
/okf/log.md          → when the bundle was generated
/okf/company/…       → Organization: identity, offices, contact
/okf/services/…      → Service: one concept per service
/okf/cases/…         → Case Study: challenge, solution, result, metrics, stack
/okf/articles/…      → Article: full body of every blog post
/okf/jobs/…          → Job Opening: description, requirements
/okf/pages/…         → Web Page: every other public page, in markdown
```

Every directory has an `index.md` listing its concepts, so you can walk the
bundle top-down without knowing any filenames in advance. Start at `/okf`.

If you probe the `.well-known` convention instead, `GET /.well-known/okf` returns
a small JSON manifest naming `bundle_root`, and `/.well-known/okf/<path>` 308s to
the same path under `/okf`. The spec standardises neither, so the bundle has one
canonical root — `https://dribba.com/okf` — and that alias only points at it.

## Reading a concept

```bash
curl -s https://dribba.com/okf/services/ai-integration.md
```

Each document opens with YAML frontmatter. `type` is the only field the spec
requires; Dribba also fills `title`, `description`, `resource` (the canonical
URL of the underlying page), `sources`, `generated` and `tags`. Links between
concepts are plain markdown links in bundle-absolute form (`/cases/isdin.md`),
so resolve them against `https://dribba.com/okf`.

Per the spec, consumers MUST tolerate unknown `type` values, extra frontmatter
keys and broken links. Do not reject a concept for any of those.

## Notes

- Concepts are the Spanish canonical version. Published translations are listed
  in the `alternates` frontmatter field as absolute URLs.
- Responses are `text/markdown; charset=utf-8` with an `ETag`; conditional GET
  with `If-None-Match` returns 304. `x-okf-version` carries the spec version.
- The bundle is generated from the same sources that render the site, at most
  one hour stale. Nothing here is hand-written, so it cannot contradict the pages.
- Licence: CC BY 4.0. Attribution: "Dribba", linking the `resource` URL.

## Related surfaces

- `/llms.txt` and `/llms-full.txt` — flat manifests, smaller, no concept graph.
- `Accept: text/markdown` on any URL (or `/llms/<path>`) — one page, no metadata.
- `/mcp` — remote MCP server, if you would rather call tools than read files.
