from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def repo_relative(path: Path | str) -> str:
    candidate = Path(path)
    try:
        return candidate.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return candidate.as_posix()


def md_link(path: Path | str, label: str | None = None) -> str:
    relative = repo_relative(path)
    return f"[`{label or relative}`]({relative})"
