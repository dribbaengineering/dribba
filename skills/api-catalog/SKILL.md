---
name: api-catalog
type: discovery
description: Dribba publishes a linkset API catalog at /.well-known/api-catalog per RFC 9727.
---

# API Catalog — Dribba

Dribba exposes a small set of public endpoints for contact, job applications,
budget estimates, and the conversational assistant. They are catalogued at:

```
https://www.dribba.com/.well-known/api-catalog
```

The resource returns `application/linkset+json` per RFC 9727 / RFC 9264.


## When to use this skill

Use it when you have found an endpoint and need **the contract behind it**: the
catalog points at the OpenAPI description, the human reference, the deprecation
policy and the individual endpoints.

It is not a data source. For data, call `/api/v1` (see the `rest-api` skill).

## Notes for agents

- All endpoints accept both `application/json` and `multipart/form-data`.
- Endpoints are rate-limited by IP. The chat endpoint enforces 15 requests per
  10 minutes plus burst detection at 4 requests per 10 seconds.
- No authentication is required; do not send credentials.
- **Same-origin policy:** endpoints reject requests whose `Origin` is not
  `https://www.dribba.com`. They are intended for the Dribba site itself and
  for partners we've allow-listed — not for general agent automation. Use the
  markdown-negotiation skill to read page content instead.

## Reference

- https://www.rfc-editor.org/rfc/rfc9727
- https://www.rfc-editor.org/rfc/rfc9264
