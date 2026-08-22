"""Official Python client for the Dribba public API — https://dribba.com/developers

Zero dependencies: everything here is ``urllib.request`` and ``json`` from the
standard library. The API needs no key, so there is nothing to configure beyond
the base URL — and the only reason to change that is to point at the sandbox.

The whole surface comes from one contract: https://dribba.com/openapi.json

    from dribba import Dribba

    dribba = Dribba()
    for service in dribba.paginate("/api/v1/services"):
        print(service["slug"])

Deliberately mirrors the JavaScript client (``npm i dribba``) method for method,
so a team using both does not have to learn two vocabularies.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Iterator

__all__ = ["Dribba", "DribbaError", "PRODUCTION", "SANDBOX", "__version__"]

__version__ = "1.0.1"

PRODUCTION = "https://dribba.com"
SANDBOX = "https://dribba.com/sandbox"

_USER_AGENT = f"dribba-python/{__version__} (+https://dribba.com/developers)"


class DribbaError(Exception):
    """Raised for any non-2xx response.

    The API answers RFC 9457 problem details, so the field worth branching on is
    ``code``: it is stable. ``detail`` and ``title`` are prose and may be
    reworded without notice. ``resolution`` says what to do next, verbatim from
    the server.
    """

    def __init__(self, problem: dict[str, Any] | None, status: int) -> None:
        problem = problem or {}
        super().__init__(problem.get("detail") or f"HTTP {status}")
        self.status: int = problem.get("status", status)
        self.code: str = problem.get("code", "unknown")
        self.resolution: str | None = problem.get("resolution")
        self.instance: str | None = problem.get("instance")
        self.documentation_url: str | None = problem.get("documentation_url")
        self.problem: dict[str, Any] = problem


class Dribba:
    """Client for https://dribba.com/api/v1.

    :param base_url: override the origin entirely.
    :param sandbox: use the frozen fixtures at ``/sandbox`` instead of production.
    :param timeout: seconds before a request gives up (default 30).
    """

    def __init__(
        self,
        base_url: str | None = None,
        *,
        sandbox: bool = False,
        timeout: float = 30.0,
        user_agent: str = _USER_AGENT,
    ) -> None:
        self.base_url = (base_url or (SANDBOX if sandbox else PRODUCTION)).rstrip("/")
        self.timeout = timeout
        self.user_agent = user_agent
        #: Quota advertised by the last response, from the IETF RateLimit fields.
        self.rate_limit: dict[str, int | None] = {
            "limit": None,
            "remaining": None,
            "reset": None,
        }

    # ── Transport ─────────────────────────────────────────────────────────────

    def request(
        self,
        path: str,
        *,
        method: str = "GET",
        body: Any = None,
        query: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
        accept: str = "application/json",
    ) -> Any:
        url = f"{self.base_url}{path}"
        if query:
            pairs = {k: v for k, v in query.items() if v is not None}
            if pairs:
                url = f"{url}?{urllib.parse.urlencode(pairs)}"

        headers = {"Accept": accept, "User-Agent": self.user_agent}
        data: bytes | None = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                self._read_quota(res.headers)
                return self._decode(res.read(), res.headers.get("Content-Type", ""))
        except urllib.error.HTTPError as err:
            # The body of an error is a problem+json document, and it carries the
            # only stable thing about the failure — read it before raising.
            self._read_quota(err.headers)
            payload = self._decode(err.read(), err.headers.get("Content-Type", ""))
            raise DribbaError(payload if isinstance(payload, dict) else None, err.code) from None

    def _read_quota(self, headers: Any) -> None:
        def num(name: str) -> int | None:
            raw = headers.get(name)
            try:
                return int(raw) if raw is not None else None
            except (TypeError, ValueError):
                return None

        self.rate_limit = {
            "limit": num("RateLimit-Limit"),
            "remaining": num("RateLimit-Remaining"),
            "reset": num("RateLimit-Reset"),
        }

    @staticmethod
    def _decode(raw: bytes, content_type: str) -> Any:
        text = raw.decode("utf-8", errors="replace")
        if "json" in content_type and text:
            return json.loads(text)
        return text

    # ── Reads ─────────────────────────────────────────────────────────────────

    def index(self) -> Any:
        """The API index: versions, quota policy, contract links."""
        return self.request("/api")

    def version(self) -> Any:
        return self.request("/api/v1")

    def company(self) -> Any:
        return self.request("/api/v1/company")

    def pricing(self) -> Any:
        return self.request("/api/v1/pricing")

    def services(self, **query: Any) -> Any:
        return self.request("/api/v1/services", query=query)

    def service(self, slug: str) -> Any:
        return self.request(f"/api/v1/services/{urllib.parse.quote(slug)}")

    def cases(self, **query: Any) -> Any:
        return self.request("/api/v1/cases", query=query)

    def case(self, slug: str) -> Any:
        return self.request(f"/api/v1/cases/{urllib.parse.quote(slug)}")

    def articles(self, **query: Any) -> Any:
        return self.request("/api/v1/articles", query=query)

    def jobs(self, **query: Any) -> Any:
        return self.request("/api/v1/jobs", query=query)

    def comparisons(self, **query: Any) -> Any:
        return self.request("/api/v1/comparisons", query=query)

    def comparison(self, topic: str) -> Any:
        return self.request(f"/api/v1/comparisons/{urllib.parse.quote(topic)}")

    def paginate(self, path: str, *, limit: int = 50, **query: Any) -> Iterator[Any]:
        """Every item of a collection, following ``next_cursor`` for you.

        A generator and not a list: a caller that breaks out early never fetches
        the pages it did not need.
        """
        cursor: str | None = None
        while True:
            page = self.request(path, query={**query, "limit": limit, "cursor": cursor})
            for item in page.get("items") or []:
                yield item
            cursor = page.get("next_cursor")
            if not cursor:
                return

    # ── Writes and jobs ───────────────────────────────────────────────────────

    def estimate(self, idempotency_key: str | None = None, **payload: Any) -> Any:
        """Ballpark budget.

        Indicative range, never a quote — a binding proposal always follows a
        Discovery conversation.
        """
        return self.request(
            "/api/v1/estimate",
            method="POST",
            body=payload,
            idempotency_key=idempotency_key,
        )

    def batch(self, operations: list[dict[str, Any]], idempotency_key: str | None = None) -> Any:
        """Up to 20 GET operations in one request."""
        return self.request(
            "/api/v1/batch",
            method="POST",
            body={"operations": operations},
            idempotency_key=idempotency_key,
        )

    def ask(self, query: str) -> Any:
        """Natural-language question. Returns verbatim passages with their URL.

        It does not generate prose: the synthesis is the caller's job.
        """
        return self.request("/ask", method="POST", body={"query": query})

    def start_export(self, paths: list[str] | None = None) -> Any:
        return self.request("/api/v1/exports", method="POST", body={"paths": paths} if paths else {})

    def export_status(self, job_id: str) -> Any:
        return self.request(f"/api/v1/exports/{urllib.parse.quote(job_id)}")

    def wait_for_export(self, job_id: str, *, interval: float = 2.0, timeout: float = 120.0) -> Any:
        """Polls until the export finishes.

        Jobs are instance-scoped and expire after 15 minutes; a 404 while polling
        means the request reached another Cloud Run instance, not that the work
        was lost.
        """
        deadline = time.monotonic() + timeout
        while True:
            job = self.export_status(job_id)
            if job.get("status") in ("completed", "failed"):
                return job
            if time.monotonic() > deadline:
                raise TimeoutError(f"Export {job_id} did not finish in {timeout}s")
            time.sleep(interval)

    def export_result(self, job_id: str) -> str:
        return self.request(
            f"/api/v1/exports/{urllib.parse.quote(job_id)}/result",
            accept="text/markdown",
        )

    # ── Markdown ──────────────────────────────────────────────────────────────

    def markdown(self, path: str = "/") -> str:
        """Any page of dribba.com as markdown. ``/`` returns the homepage."""
        suffix = "/index.md" if path == "/" else f"{path.rstrip('/')}.md"
        return self.request(suffix, accept="text/markdown")
