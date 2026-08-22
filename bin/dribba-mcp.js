#!/usr/bin/env node
/**
 * `dribba-mcp` — stdio bridge to Dribba's remote MCP server.
 *
 * Dribba's MCP server speaks Streamable HTTP at https://dribba.com/mcp, which
 * is what a remote-capable client wants. Plenty of clients only speak stdio:
 * they spawn a process and exchange newline-delimited JSON-RPC over its stdin
 * and stdout. This is that process. It forwards every message to the remote
 * endpoint and writes the reply back, so the tools, resources and protocol
 * versions are whatever the server declares — nothing is reimplemented here.
 *
 *   npx dribba-mcp                 # the product surface (5 tools)
 *   npx dribba-mcp --docs          # the documentation surface (4 tools)
 *   DRIBBA_MCP_URL=… npx dribba-mcp
 *
 * Written without dependencies on purpose: the official SDK would do the
 * framing in twenty lines, but this package advertises zero dependencies and a
 * bridge is not worth breaking that for.
 *
 * Two rules this file must never break:
 *
 *   1. **stdout carries protocol only.** One JSON message per line, nothing
 *      else — a stray `console.log` corrupts the stream and the client drops
 *      the connection. Diagnostics go to stderr.
 *   2. **A request always gets an answer.** If the network fails, the reply is
 *      a JSON-RPC error with the same `id`; a client that never hears back
 *      hangs forever instead of failing.
 */

const PRODUCT_URL = "https://dribba.com/mcp";
const DOCS_URL = "https://dribba.com/docs/mcp";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(
    `dribba-mcp — stdio bridge to Dribba's remote MCP server

Usage
  dribba-mcp [--docs]

Options
  --docs        Bridge to the documentation surface (${DOCS_URL})
                instead of the product one (${PRODUCT_URL}).
  -h, --help    This text.

Environment
  DRIBBA_MCP_URL   Override the endpoint entirely.

Client config (Claude Desktop, Cursor, Codex…):

  {
    "mcpServers": {
      "dribba": { "command": "npx", "args": ["-y", "dribba-mcp"] }
    }
  }

If your client speaks Streamable HTTP, skip this bridge and point it straight
at ${PRODUCT_URL}. Docs: https://dribba.com/developers/mcp
`,
  );
  process.exit(0);
}

const ENDPOINT =
  process.env.DRIBBA_MCP_URL || (args.includes("--docs") ? DOCS_URL : PRODUCT_URL);

/**
 * The session id the server handed us, echoed on every later request.
 *
 * Our server does not require one today, but the transport allows it to start:
 * a bridge that dropped the header would work until the day it silently
 * stopped, which is the worst kind of bug to leave behind.
 */
let sessionId = null;

const USER_AGENT = "dribba-mcp-bridge (+https://dribba.com/developers/mcp)";

/** Writes one JSON-RPC message. The newline is the frame — never omit it. */
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function errorReply(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function forward(message) {
  const headers = {
    "Content-Type": "application/json",
    // Both, so the server may answer with plain JSON or wrap the single
    // response in an SSE frame — the transport allows either.
    Accept: "application/json, text/event-stream",
    "User-Agent": USER_AGENT,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  const handedSession = response.headers.get("mcp-session-id");
  if (handedSession) sessionId = handedSession;

  // A notification gets 202 with no body, and there is nothing to write back.
  if (response.status === 202) return null;

  const text = await response.text();
  if (!text.trim()) return null;

  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    /* SSE frame: `event:`/`id:` lines we ignore, and one or more `data:` lines
       whose concatenation is the JSON payload. */
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("");
    return data ? JSON.parse(data) : null;
  }

  if (!response.ok) {
    /* An HTML body means we hit a page, not the endpoint (a typo in
       DRIBBA_MCP_URL, a proxy in the way). Quoting 200 characters of markup at
       the client helps nobody: the status and the URL are the diagnosis. */
    const isHtml = (response.headers.get("content-type") ?? "").includes("text/html");
    throw new Error(
      isHtml ? `HTTP ${response.status} (HTML response, not an MCP endpoint)` : `HTTP ${response.status}: ${text.slice(0, 200)}`,
    );
  }
  return JSON.parse(text);
}

async function handle(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    // Unparseable input has no id to answer to; -32700 with a null id is what
    // the spec prescribes.
    send(errorReply(null, -32700, "Parse error: the line is not valid JSON"));
    return;
  }

  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined;

  try {
    const reply = await forward(message);
    if (reply !== null) send(reply);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[dribba-mcp] ${ENDPOINT} failed: ${detail}\n`);
    // Only a request expects a reply. Answering a notification would be a
    // protocol violation of its own.
    if (id !== undefined) {
      send(errorReply(id, -32603, `Bridge to ${ENDPOINT} failed: ${detail}`));
    }
  }
}

/**
 * Messages are handled in order, one at a time.
 *
 * Concurrency would be faster and wrong: two `initialize`-then-`tools/list`
 * exchanges racing means the second can leave before the first has learnt the
 * session id.
 */
let queue = Promise.resolve();
let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) queue = queue.then(() => handle(line));
  }
});

process.stdin.on("end", () => {
  // Drain what is in flight before exiting, or the last reply is lost.
  queue.then(() => process.exit(0));
});

// A broken stdout means the client is gone; exiting quietly beats an EPIPE trace.
process.stdout.on("error", () => process.exit(0));
