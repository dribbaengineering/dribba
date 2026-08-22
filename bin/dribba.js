#!/usr/bin/env node
/**
 * `dribba` — CLI for the Dribba public API.
 *
 * No install, no key, no config: `npx dribba services`. Everything prints JSON
 * by default so it pipes into `jq`; `--table` when a human is reading.
 */
import { Dribba, DribbaError, SANDBOX } from "../index.js";

const HELP = `dribba — CLI for the Dribba public API (https://dribba.com/developers)

Usage
  dribba <command> [options]

Commands
  company                      Company profile: offices, team, clients
  services [--limit N]         Service catalog
  service <slug>               One service
  cases [--limit N]            Case studies
  case <slug>                  One case study
  articles [--limit N]         Blog index
  jobs                         Open positions
  pricing                      Estimator inputs and the price floor
  comparisons                  Technology comparisons
  estimate --platforms a,b     Ballpark budget (see options below)
  ask "<question>"             Verbatim passages from the site
  markdown [path]              Any page as markdown (default: the homepage)
  export [path ...]            Start a markdown export, wait, print it
  batch <path> [<path> ...]    Several reads in one request
  api                          The API index: versions, quota, contract

Options
  --sandbox                    Hit the frozen fixtures instead of production
  --limit N                    Page size (1-100)
  --table                      Human-readable output instead of JSON
  --platforms ios,android      estimate: target platforms (required)
  --complexity mvp|standard|complex
  --design basic|custom|premium
  --timeline rush|normal|relaxed
  --help                       This text

Examples
  npx dribba services --table
  npx dribba cases --limit 3 | jq -r '.items[].slug'
  npx dribba estimate --platforms ios,android --complexity complex
  npx dribba ask "flutter migration"
`;

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(argv.length === 0 ? 1 : 0);
}

function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const has = (name) => argv.includes(`--${name}`);
const positionals = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));

const client = new Dribba({ baseUrl: has("sandbox") ? SANDBOX : undefined });
const limit = flag("limit") ? Number(flag("limit")) : undefined;
const [command, ...rest] = positionals;

function out(value) {
  if (!has("table")) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  const rows = Array.isArray(value) ? value : (value?.items ?? [value]);
  for (const row of rows) {
    if (row && typeof row === "object") {
      const label = row.name ?? row.title ?? row.slug ?? row.topic ?? "";
      const detail = row.summary ?? row.description ?? row.industry ?? row.verdict ?? "";
      process.stdout.write(`${String(label).padEnd(38)} ${String(detail).slice(0, 90)}\n`);
    } else {
      process.stdout.write(`${row}\n`);
    }
  }
}

try {
  switch (command) {
    case "company": out(await client.company()); break;
    case "services": out(await client.services({ limit })); break;
    case "service": out(await client.service(need(rest[0], "service <slug>"))); break;
    case "cases": out(await client.cases({ limit })); break;
    case "case": out(await client.case(need(rest[0], "case <slug>"))); break;
    case "articles": out(await client.articles({ limit })); break;
    case "jobs": out(await client.jobs({ limit })); break;
    case "pricing": out(await client.pricing()); break;
    case "comparisons": out(await client.comparisons({ limit })); break;
    case "api": out(await client.index()); break;

    case "estimate": {
      const platforms = (flag("platforms") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
      if (platforms.length === 0) fail("estimate needs --platforms, e.g. --platforms ios,android");
      out(
        await client.estimate({
          platforms,
          complexity: flag("complexity"),
          design: flag("design"),
          timeline: flag("timeline"),
        }),
      );
      break;
    }

    case "ask": out(await client.ask(need(rest[0], 'ask "<question>"'))); break;

    case "markdown":
      process.stdout.write(await client.markdown(rest[0] ?? "/"));
      break;

    case "export": {
      const job = await client.startExport(rest.length ? rest : undefined);
      process.stderr.write(`export ${job.id}: ${job.progress.total} pages, waiting…\n`);
      const done = await client.waitForExport(job.id);
      if (done.status !== "completed") fail(`export ${done.status}: ${done.error ?? "unknown"}`);
      process.stdout.write(await client.exportResult(job.id));
      break;
    }

    case "batch": {
      if (rest.length === 0) fail("batch needs at least one /api/v1 path");
      out(await client.batch(rest.map((path, i) => ({ id: String(i), path }))));
      break;
    }

    default:
      fail(`unknown command "${command}". Run \`dribba --help\`.`);
  }
} catch (error) {
  if (error instanceof DribbaError) {
    process.stderr.write(`${error.code} (${error.status}): ${error.message}\n`);
    if (error.resolution) process.stderr.write(`  ${error.resolution}\n`);
  } else {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
}

function need(value, usage) {
  if (!value) fail(`missing argument — usage: dribba ${usage}`);
  return value;
}
function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
