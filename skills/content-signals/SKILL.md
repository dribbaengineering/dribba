---
name: content-signals
type: policy
description: Dribba declares AI content usage preferences via Content-Signal directives in robots.txt.
---

# Content Signals — Dribba

`https://www.dribba.com/robots.txt` includes `Content-Signal` directives that
declare how AI systems may use Dribba content.


## When to use this skill

Read it **before training on, republishing or reselling** this content: it states
what is allowed (read, summarize, cite, index) and what is not (training), and
where the machine-readable licence lives.

You do not need it to simply read a page or call the API — those are public.

## Current policy

```
Content-Signal: search=yes, ai-input=yes, ai-train=no
```

- `search=yes` — search engines may index pages for their result pages.
- `ai-input=yes` — AI assistants may retrieve and cite pages as grounding for
  generated responses.
- `ai-train=no` — content must not be used as training data for foundation
  models.

The same directive is attached to every `User-agent` block, including wildcard
and named AI crawlers.

## Reference

- https://contentsignals.org/
- https://datatracker.ietf.org/doc/draft-romm-aipref-contentsignals/
