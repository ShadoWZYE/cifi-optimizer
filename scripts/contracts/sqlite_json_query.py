#!/usr/bin/env python3
import json
import sqlite3
import sys


def main() -> int:
    if len(sys.argv) != 5:
        raise SystemExit(
            "usage: sqlite_json_query.py <db_path> <mode:one|all> <sql> <params_json>"
        )

    db_path, mode, sql, params_json = sys.argv[1:5]
    if mode not in {"one", "all"}:
        raise SystemExit(f"invalid mode: {mode}")

    params = json.loads(params_json)
    if not isinstance(params, list):
        raise SystemExit("params_json must decode to a JSON list")

    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.execute(sql, params)
        if mode == "one":
            row = cursor.fetchone()
            payload = dict(row) if row is not None else None
        else:
            payload = [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

    json.dump(payload, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
