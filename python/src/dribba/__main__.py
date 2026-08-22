"""``dribba`` — CLI for the Dribba public API.

Runs as ``dribba <command>`` once installed, or ``python -m dribba <command>``
without installing anything. Everything prints JSON by default so it pipes into
``jq``; ``--table`` when a human is reading.

Kept in step with the JavaScript CLI (``npx dribba``) on purpose: same commands,
same flags, same output. Two ecosystems, one vocabulary.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from . import Dribba, DribbaError, __version__

HELP_EPILOG = """\
examples:
  dribba services --table
  dribba case cityxerpa
  dribba estimate --platforms ios,android --complexity complex
  dribba ask "flutter migration"
  dribba markdown /servicios
  dribba services --sandbox

No API key, no account: every read endpoint is public.
Docs: https://dribba.com/docs · Contract: https://dribba.com/openapi.json
"""


def _table(rows: list[dict[str, Any]]) -> str:
    """Two columns — an identifier and a label — which is what a human scans for."""
    lines = []
    for row in rows:
        left = row.get("slug") or row.get("id") or row.get("topic") or row.get("title") or ""
        right = row.get("name") or row.get("title") or row.get("summary") or ""
        lines.append(f"{str(left)[:38]:38} {str(right)[:100]}")
    return "\n".join(lines)


def _emit(payload: Any, as_table: bool) -> None:
    if as_table:
        items = payload.get("items") if isinstance(payload, dict) else payload
        if isinstance(items, list) and items and isinstance(items[0], dict):
            print(_table(items))
            return
    if isinstance(payload, str):
        print(payload)
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))


def build_parser() -> argparse.ArgumentParser:
    """Builds the parser.

    The shared flags are declared **twice**: once on the top-level parser and
    once, through `parent`, on every subcommand. Without the second copy argparse
    only accepts them before the command (`dribba --table services`), and
    `dribba services --table` — the order everyone actually types, and the one
    the JavaScript CLI takes — dies with «unrecognized arguments».

    Con la copia y **sin** `SUPPRESS` pasa lo contrario: al parsear el
    subcomando, argparse escribe los valores por defecto de su copia encima de lo
    que ya se había leído antes del comando, así que `dribba --table services`
    devolvía `table=False`. `SUPPRESS` hace que un flag ausente no toque el
    namespace, y entonces valen las dos órdenes.
    """
    parent = argparse.ArgumentParser(add_help=False)
    parent.add_argument("--sandbox", action="store_true", default=argparse.SUPPRESS,
                        help="hit the frozen fixtures")
    parent.add_argument("--table", action="store_true", default=argparse.SUPPRESS,
                        help="human-readable output")
    parent.add_argument("--limit", type=int, default=argparse.SUPPRESS,
                        help="page size for collections")
    parent.add_argument("--base-url", default=argparse.SUPPRESS,
                        help="override the origin (for testing against a local build)")

    parser = argparse.ArgumentParser(
        prog="dribba",
        description="CLI for the Dribba public API (https://dribba.com/developers)",
        epilog=HELP_EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        parents=[parent],
    )
    parser.add_argument("--version", action="version", version=f"dribba {__version__}")

    sub = parser.add_subparsers(dest="command", required=True, metavar="<command>")
    for name, helptext in (
        ("api", "the API index: versions, quota, contract"),
        ("company", "company profile: offices, team, clients"),
        ("services", "service catalog"),
        ("cases", "case studies"),
        ("articles", "blog index"),
        ("jobs", "open positions"),
        ("pricing", "estimator inputs and the price floor"),
        ("comparisons", "technology comparisons"),
    ):
        sub.add_parser(name, help=helptext, parents=[parent])

    for name, arg, helptext in (
        ("service", "slug", "one service"),
        ("case", "slug", "one case study"),
        ("comparison", "topic", "one comparison"),
        ("markdown", "path", "any page as markdown"),
        ("ask", "question", "verbatim passages from the site"),
    ):
        p = sub.add_parser(name, help=helptext, parents=[parent])
        p.add_argument(arg, nargs="?" if name == "markdown" else None)

    est = sub.add_parser("estimate", help="ballpark budget (indicative, never a quote)", parents=[parent])
    est.add_argument("--platforms", required=True, help="comma-separated: ios,android,web")
    est.add_argument("--type", dest="project_type", help="app, web, backend…")
    est.add_argument("--complexity", help="simple, medium, complex")

    exp = sub.add_parser("export", help="start a markdown export, wait, print it", parents=[parent])
    exp.add_argument("paths", nargs="*", help="paths to export (default: a standard set)")

    return parser


def run(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    # Con `SUPPRESS` un flag no dado simplemente no está en el namespace.
    limit = getattr(args, "limit", None)
    client = Dribba(
        base_url=getattr(args, "base_url", None),
        sandbox=getattr(args, "sandbox", False),
    )
    as_table = getattr(args, "table", False)
    query: dict[str, Any] = {"limit": limit} if limit else {}

    try:
        if args.command == "api":
            payload: Any = client.index()
        elif args.command == "company":
            payload = client.company()
        elif args.command == "pricing":
            payload = client.pricing()
        elif args.command == "services":
            payload = client.services(**query)
        elif args.command == "cases":
            payload = client.cases(**query)
        elif args.command == "articles":
            payload = client.articles(**query)
        elif args.command == "jobs":
            payload = client.jobs(**query)
        elif args.command == "comparisons":
            payload = client.comparisons(**query)
        elif args.command == "service":
            payload = client.service(args.slug)
        elif args.command == "case":
            payload = client.case(args.slug)
        elif args.command == "comparison":
            payload = client.comparison(args.topic)
        elif args.command == "markdown":
            payload = client.markdown(args.path or "/")
        elif args.command == "ask":
            payload = client.ask(args.question)
        elif args.command == "estimate":
            payload = client.estimate(
                platforms=[p.strip() for p in args.platforms.split(",") if p.strip()],
                **{k: v for k, v in (("project_type", args.project_type), ("complexity", args.complexity)) if v},
            )
        elif args.command == "export":
            job = client.start_export(args.paths or None)
            job_id = job.get("id") or job.get("job_id")
            done = client.wait_for_export(job_id)
            if done.get("status") != "completed":
                print(f"export {job_id} failed: {json.dumps(done)}", file=sys.stderr)
                return 1
            payload = client.export_result(job_id)
        else:  # pragma: no cover — argparse rejects anything else first
            raise SystemExit(2)
    except DribbaError as err:
        # The server already said what went wrong and what to do; repeating it is
        # more useful than a traceback.
        print(f"error {err.status} [{err.code}]: {err}", file=sys.stderr)
        if err.resolution:
            print(f"  {err.resolution}", file=sys.stderr)
        return 1
    except (TimeoutError, OSError) as err:
        print(f"network error: {err}", file=sys.stderr)
        return 1

    _emit(payload, as_table)
    return 0


def main() -> None:
    raise SystemExit(run())


if __name__ == "__main__":
    main()
