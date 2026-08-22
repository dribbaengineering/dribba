# dribba (Python)

Official SDK and CLI for the [Dribba](https://dribba.com) public API.

**No API key, no OAuth, no account.** Every read endpoint is public. If you were
looking for the credentials page, there isn't one — see
[dribba.com/auth.md](https://dribba.com/auth.md).

- Reference: <https://dribba.com/docs>
- Contract: <https://dribba.com/openapi.json> (OpenAPI 3.1)
- Developer portal: <https://dribba.com/developers>

Zero dependencies: the client is `urllib` and `json` from the standard library.
The JavaScript package (`npm i dribba`) mirrors this API method for method, so a
team using both does not have to learn two vocabularies.

## Install

```bash
pip install dribba
```

## CLI

```bash
dribba services --table
dribba case cityxerpa
dribba estimate --platforms ios,android --complexity complex
dribba ask "flutter migration"
dribba markdown /servicios
dribba --help
```

Add `--sandbox` to hit the frozen fixtures instead of production. Without
installing anything: `python -m dribba services`.

## SDK

```python
from dribba import Dribba, DribbaError

dribba = Dribba()

page = dribba.services(limit=5)
print(page["total"], page["next_cursor"])

study = dribba.case("cityxerpa")
budget = dribba.estimate(platforms=["ios", "android"])
```

Every item of a collection, following the cursor for you:

```python
for service in dribba.paginate("/api/v1/services"):
    print(service["slug"])
```

Errors are RFC 9457 problem details. Branch on `code` — it is stable; `detail`
is prose and may be reworded:

```python
try:
    dribba.case("does-not-exist")
except DribbaError as err:
    print(err.status, err.code, err.resolution)
```

The quota advertised by the last response, from the IETF `RateLimit` fields:

```python
dribba.rate_limit  # {"limit": 120, "remaining": 118, "reset": 47}
```

## Sandbox

```python
dribba = Dribba(sandbox=True)
```

Frozen fixtures with the same response shapes, so your tests do not break the
day we publish a tenth service. The data is fictional on purpose (`acme-*`).

## What this package does not do

- **No writes.** The public API is read-only; the site's forms require a
  same-origin request. For an agent that needs to contact us there is the
  `submit_contact_request` tool of the [MCP server](https://dribba.com/mcp),
  which asks for confirmation first.
- **No auth.** There is nothing to configure. See
  [auth.md](https://dribba.com/auth.md) for why, and what that means for you.

## Licence

MIT — see [LICENSE](./LICENSE).
