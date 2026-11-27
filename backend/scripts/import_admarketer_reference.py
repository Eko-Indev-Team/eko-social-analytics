"""Import AdMarketer's reference data (targeting history, creatives + pictures, labels, optimisation, CSP/village
reference lists) into the Ads tables of one workspace. Idempotent: running it again changes nothing.

    python -m scripts.import_admarketer_reference .data/admarketer-reference
    python -m scripts.import_admarketer_reference .data/admarketer-reference --workspace ws-eko-india

The workspace defaults to META_ADS_WORKSPACE_ID, else the only workspace. The folder is Eko-internal data
(gitignored) — never commit it. Prints counts only (no file contents).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory
from app.core.errors import ApiError
from app.core.tenancy import bind_workspace
from app.models import Workspace
from app.services.ads.importer import import_reference
from app.services.ads.sync import resolve_workspace_id


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directory", type=Path, help="AdMarketer data/ folder (e.g. backend/.data/admarketer-reference)")
    parser.add_argument("--workspace", default=None, help="workspace id (default: META_ADS_WORKSPACE_ID or the only workspace)")
    args = parser.parse_args(argv)

    settings = get_settings()
    factory = build_session_factory(build_engine(settings))
    with factory() as db, db.begin():
        try:
            workspace_id = args.workspace or resolve_workspace_id(db, settings)
        except ApiError as exc:
            print(f"Error: {exc.message} (or pass --workspace)", file=sys.stderr)
            return 1
        if db.get(Workspace, workspace_id) is None:
            print(f"Error: workspace '{workspace_id}' does not exist.", file=sys.stderr)
            return 1
        bind_workspace(db, workspace_id)
        try:
            report = import_reference(db, args.directory)
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1

    print(f"Imported AdMarketer reference data into workspace {workspace_id}:")
    for table, counts in sorted(report.counts.items()):
        print(f"  {table:28s} " + ", ".join(f"{k} {v}" for k, v in counts.items() if v))
    for warning in report.warnings:
        print(f"  warning: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
