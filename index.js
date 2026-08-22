/**
 * Official client for the Dribba public API — https://dribba.com/developers
 *
 * Zero dependencies: everything here is `fetch` and `URL`, both built into
 * Node 20+. The API needs no key, so there is nothing to configure beyond the
 * base URL — and the only reason to change that is to point at the sandbox.
 *
 * The whole surface is generated from one contract:
 * https://dribba.com/openapi.json
 */

export const PRODUCTION = "https://dribba.com";
export const SANDBOX = "https://dribba.com/sandbox";

/**
 * Error thrown for any non-2xx response.
 *
 * The API answers RFC 9457 problem details, so the interesting field is `code`:
 * it is stable and safe to branch on. `detail` and `title` are prose and may be
 * reworded. `resolution` says what to do next, verbatim from the server.
 */
export class DribbaError extends Error {
  constructor(problem, status) {
    super(problem?.detail ?? `HTTP ${status}`);
    this.name = "DribbaError";
    this.status = problem?.status ?? status;
    this.code = problem?.code ?? "unknown";
    this.resolution = problem?.resolution;
    this.instance = problem?.instance;
    this.documentationUrl = problem?.documentation_url;
    this.problem = problem;
  }
}

export class Dribba {
  /**
   * @param {{ baseUrl?: string, sandbox?: boolean, fetch?: typeof fetch, userAgent?: string }} [options]
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl ?? (options.sandbox ? SANDBOX : PRODUCTION)).replace(/\/$/, "");
    this._fetch = options.fetch ?? globalThis.fetch;
    this.userAgent = options.userAgent ?? "dribba-sdk/1.0.0 (+https://dribba.com/developers)";
    /** Quota advertised by the last response, from the IETF RateLimit fields. */
    this.rateLimit = { limit: null, remaining: null, reset: null };
  }

  async request(path, { method = "GET", body, idempotencyKey, query } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }

    const headers = { Accept: "application/json", "User-Agent": this.userAgent };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const res = await this._fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    this.rateLimit = {
      limit: numberOrNull(res.headers.get("ratelimit-limit")),
      remaining: numberOrNull(res.headers.get("ratelimit-remaining")),
      reset: numberOrNull(res.headers.get("ratelimit-reset")),
    };

    const text = await res.text();
    const isJson = (res.headers.get("content-type") ?? "").includes("json");
    const payload = isJson && text ? JSON.parse(text) : text;

    if (!res.ok) throw new DribbaError(isJson ? payload : null, res.status);
    return payload;
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  index() { return this.request("/api"); }
  version() { return this.request("/api/v1"); }
  company() { return this.request("/api/v1/company"); }
  pricing() { return this.request("/api/v1/pricing"); }

  services(query) { return this.request("/api/v1/services", { query }); }
  service(slug) { return this.request(`/api/v1/services/${encodeURIComponent(slug)}`); }
  cases(query) { return this.request("/api/v1/cases", { query }); }
  case(slug) { return this.request(`/api/v1/cases/${encodeURIComponent(slug)}`); }
  articles(query) { return this.request("/api/v1/articles", { query }); }
  jobs(query) { return this.request("/api/v1/jobs", { query }); }
  comparisons(query) { return this.request("/api/v1/comparisons", { query }); }
  comparison(topic) { return this.request(`/api/v1/comparisons/${encodeURIComponent(topic)}`); }

  /**
   * Every item of a collection, following `next_cursor` for you.
   *
   * Async iterator rather than an array: the caller decides when to stop, and a
   * `for await` that breaks early does not fetch the pages it never needed.
   */
  async *paginate(path, { limit = 50, ...query } = {}) {
    let cursor;
    do {
      const page = await this.request(path, { query: { ...query, limit, cursor } });
      for (const item of page.items ?? []) yield item;
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
  }

  // ── Writes and jobs ───────────────────────────────────────────────────────

  /**
   * Ballpark budget. Indicative range, never a quote — a binding proposal always
   * follows a Discovery conversation.
   */
  estimate(input, { idempotencyKey } = {}) {
    return this.request("/api/v1/estimate", { method: "POST", body: input, idempotencyKey });
  }

  /** Up to 20 GET operations in one request. */
  batch(operations, { idempotencyKey } = {}) {
    return this.request("/api/v1/batch", { method: "POST", body: { operations }, idempotencyKey });
  }

  /** Natural-language question. Returns verbatim passages with their URL. */
  ask(query) { return this.request("/ask", { method: "POST", body: { query } }); }

  /** Starts a markdown export and returns the job. Poll `waitForExport`. */
  startExport(paths) {
    return this.request("/api/v1/exports", { method: "POST", body: paths ? { paths } : {} });
  }

  exportStatus(id) { return this.request(`/api/v1/exports/${encodeURIComponent(id)}`); }

  /**
   * Polls until the export finishes, honouring the documented cadence.
   * Jobs are instance-scoped and expire after 15 minutes; a 404 while polling
   * means the request reached another instance, not that the work was lost.
   */
  async waitForExport(id, { intervalMs = 2000, timeoutMs = 120000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = await this.exportStatus(id);
      if (job.status === "completed" || job.status === "failed") return job;
      if (Date.now() > deadline) throw new Error(`Export ${id} did not finish in ${timeoutMs}ms`);
      await sleep(intervalMs);
    }
  }

  async exportResult(id) {
    const res = await this._fetch(`${this.baseUrl}/api/v1/exports/${encodeURIComponent(id)}/result`, {
      headers: { Accept: "text/markdown", "User-Agent": this.userAgent },
    });
    if (!res.ok) throw new DribbaError(null, res.status);
    return res.text();
  }

  // ── Markdown ──────────────────────────────────────────────────────────────

  /** Any page of dribba.com as markdown. `/` returns the homepage. */
  async markdown(path = "/") {
    const suffix = path === "/" ? "/index.md" : `${path.replace(/\/$/, "")}.md`;
    const res = await this._fetch(`${this.baseUrl}${suffix}`, {
      headers: { Accept: "text/markdown", "User-Agent": this.userAgent },
    });
    if (!res.ok) throw new DribbaError(null, res.status);
    return res.text();
  }
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default Dribba;
