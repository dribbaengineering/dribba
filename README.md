# dribba

Official SDK and CLI for the [Dribba](https://dribba.com) public API.

**No API key, no OAuth, no account.** Every read endpoint is public. If you were
looking for the credentials page, there isn't one — see
[dribba.com/auth.md](https://dribba.com/auth.md).

- Reference: <https://dribba.com/docs>
- Contract: <https://dribba.com/openapi.json> (OpenAPI 3.1)
- Developer portal: <https://dribba.com/developers>

## CLI

Nothing to install:

```bash
npx dribba services --table
npx dribba cases --limit 3 | jq -r '.items[].slug'
npx dribba estimate --platforms ios,android --complexity complex
npx dribba ask "flutter migration"
npx dribba markdown /servicios
npx dribba --help
```

Add `--sandbox` to hit the frozen fixtures instead of production.

## SDK

```bash
npm i dribba
```

```js
import { Dribba } from "dribba";

const dribba = new Dribba();

const { items, total, next_cursor } = await dribba.services({ limit: 5 });
const study = await dribba.case("cityxerpa");
const budget = await dribba.estimate({ platforms: ["ios", "android"] });

// Whole collections, following the cursor for you
for await (const job of dribba.paginate("/api/v1/jobs")) {
  console.log(job.title);
}
```

### Errors

Every 4xx/5xx throws a `DribbaError`. Branch on `code` — it is stable. `title`
and `detail` are prose and may be reworded.

```js
import { DribbaError } from "dribba";

try {
  await dribba.service("nope");
} catch (error) {
  if (error instanceof DribbaError && error.code === "resource_not_found") {
    console.log(error.resolution); // what to do next, from the server
  }
}
```

### Rate limits

120 requests per 60 seconds per IP. After any call, `dribba.rateLimit` holds what
the last response advertised, so you can self-throttle instead of provoking a
429:

```js
await dribba.company();
console.log(dribba.rateLimit); // { limit: 120, remaining: 118, reset: 47 }
```

### Sandbox

Frozen fixtures with production shapes. Useful because a test that asserts
"there are 9 services" breaks the day we publish the tenth — against the sandbox
it does not.

```js
const sandbox = new Dribba({ sandbox: true });
const services = await sandbox.services(); // services.sandbox === true
```

### Idempotency

`Idempotency-Key` on any POST. Same key and same body replays the stored
response; same key with a different body is a 400.

```js
await dribba.estimate(input, { idempotencyKey: crypto.randomUUID() });
```

### Markdown, and the async export

Any page as markdown, and a one-request export of many pages:

```js
const page = await dribba.markdown("/servicios");

const job = await dribba.startExport(["/", "/precios", "/servicios"]);
await dribba.waitForExport(job.id);
const everything = await dribba.exportResult(job.id);
```

Export jobs live in one server instance's memory and expire after 15 minutes; a
404 while polling means the request reached a different instance, not that the
work was lost.

## Beyond the REST API

- **MCP** — two remote servers over Streamable HTTP, no auth:
  `https://dribba.com/mcp` (actions) and `https://dribba.com/docs/mcp` (docs).
  See <https://dribba.com/developers/mcp>.
- **Markdown of any page** — `Accept: text/markdown`, or append `.md`.
- **The whole site** as an [OKF](https://dribba.com/okf) bundle.
- **`/ask`** — NLWeb: a natural-language question, verbatim passages back.

## Skills and the Agent Plugins manifest

This repo doubles as a portable [Agent Plugin](https://agent-plugins.org):

```
plugin.json          the manifest
mcp.json             the two remote MCP servers
skills/              seven SKILL.md files describing what dribba.com exposes
```

Install the skills into your agent:

```bash
npx skills add dribbaengineering/dribba
```

`skills/` is **generated** from what the site serves at
`https://dribba.com/.well-known/agent-skills/`. Edit the site, not the copy — the
copy is what drifts.

## Requirements

Node 20+. Zero dependencies.

## License

MIT. The data behind the API is CC BY 4.0 — cite "Dribba" and link the source
URL.
