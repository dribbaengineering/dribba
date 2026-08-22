---
name: rest-api
type: api
description: Dribba publishes a versioned, key-free JSON API at https://dribba.com/api/v1 — services, case studies, articles, jobs, company facts and a ballpark project estimate — with RFC 9457 typed errors, IETF RateLimit headers and a published deprecation policy.
---

# REST API — Dribba

`https://dribba.com/api/v1` is the **versioned, read-only JSON surface** of
dribba.com. No API key, no OAuth, no registration. Production is the sandbox:
nothing here writes, charges or affects another client.

Start at the unversioned index, which names every published version and the
policies that apply to it:

```bash
curl https://dribba.com/api
```

## When to use this skill

Reach for the REST API when you need **structured data with a stable shape**:
listing Dribba's services, matching a case study to an industry, reading the
salary band of an opening, or getting a budget range before contacting anyone.

Do **not** use it to read page prose — for that, ask any page URL for markdown
(`Accept: text/markdown`, see the `markdown-negotiation` skill) or walk the OKF
bundle (`okf` skill). And if you are an agent that wants to *act* (submit a
contact request), use the `mcp` skill: the write endpoints on this API enforce
same-origin and will answer `403 origin_not_allowed`.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1` | Endpoints, rate-limit and deprecation policy of v1 |
| GET | `/api/v1/company` | Legal identity, offices, team model, distinctions, clients |
| GET | `/api/v1/services` | `{ count, items[] }` — slug, name, summary, URL |
| GET | `/api/v1/services/{slug}` | One service |
| GET | `/api/v1/cases` | Case studies with industry, client, year, stack |
| GET | `/api/v1/cases/{slug}` | Challenge, solution, outcome, metrics |
| GET | `/api/v1/articles` | Blog index, each with the URL of its markdown twin |
| GET | `/api/v1/jobs` | Openings with location, requirements, salary band |
| GET | `/api/v1/pricing` | Estimator inputs and the €30,000 floor |
| GET | `/api/v1/comparisons` | Technology comparisons (`{ topic, verdict }`) |
| POST | `/api/v1/estimate` | `{ min, max, mid }` in EUR for a described project |

```bash
curl -X POST https://dribba.com/api/v1/estimate \
  -H 'Content-Type: application/json' \
  -d '{"platforms":["ios","android"],"complexity":"standard","timeline":"normal"}'
```

Collections return `{ count, items[] }` and are **not paginated** — they hold
tens of records, not thousands.

## Errors

Every 4xx and 5xx is `application/problem+json` (RFC 9457). Branch on `code`,
which is stable; `title` and `detail` are prose and may be reworded.

```json
{
  "type": "https://dribba.com/docs#api-route-not-found",
  "title": "Unknown API route",
  "status": 404,
  "detail": "No endpoint is published at this path.",
  "instance": "https://dribba.com/api/v1/nope",
  "code": "api_route_not_found",
  "resolution": "List the published endpoints at https://dribba.com/api or read https://dribba.com/openapi.json.",
  "documentation_url": "https://dribba.com/docs#errores"
}
```

Codes: `api_route_not_found`, `resource_not_found`, `method_not_allowed`,
`invalid_request`, `unsupported_media_type`, `rate_limit_exceeded`,
`origin_not_allowed`, `internal_error`.

## Rate limits

120 requests per 60-second window per client IP. Every response — success or
error — carries the quota, so you can self-throttle without provoking a 429:

```
RateLimit-Policy: "public-read";q=120;w=60
RateLimit: "public-read";r=118;t=47
RateLimit-Limit: 120
RateLimit-Remaining: 118
RateLimit-Reset: 47
```

A 429 adds `Retry-After` in seconds. The counter is per server instance, so the
real quota is a multiple of the advertised one; the headers describe what the
instance that served you saw.

## Versioning

The major version is in the path. `v1` is stable: inside v1 fields are only
**added**, so a client that ignores unknown fields never breaks. A breaking
change ships as `/api/v2` while v1 keeps working. Before a version is removed it
gets RFC 9745 `Deprecation` and `Link; rel="deprecation"` headers and a dated
`Sunset`, announced at least **90 days** ahead. No sunset is scheduled today.

## Discovery

- Contract: <https://dribba.com/openapi.json> (OpenAPI 3.1, typed responses on every operation)
- Human reference: <https://dribba.com/docs>
- Developer portal: <https://dribba.com/developers>
- API catalog (RFC 9727): <https://dribba.com/.well-known/api-catalog>
- Domain AI catalog: <https://dribba.com/.well-known/ai-catalog.json>

Every API response also carries an RFC 8288 `Link` header pointing at the
contract, the docs, the catalog and the deprecation policy — so a single failed
call is enough to find your way.
