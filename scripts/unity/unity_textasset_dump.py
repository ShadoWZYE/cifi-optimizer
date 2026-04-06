from __future__ import annotations

import json
import sys
from pathlib import Path

from portable_paths import repo_relative


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str((repo / ".deps").resolve()))

    from UnityPy import Environment  # type: ignore

    if len(sys.argv) != 3:
        raise SystemExit("usage: unity_textasset_dump.py <unity_data_dir> <output_dir>")

    unity_data_dir = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    env = Environment(str(unity_data_dir))
    env.load_folder(str(unity_data_dir))

    manifest = []
    iap_summary = []

    for obj in env.objects:
        if obj.type.name != "TextAsset":
            continue

        data = obj.read()
        blob = getattr(data, "script", b"") or getattr(data, "m_Script", b"")
        raw = blob.encode("utf-8", errors="ignore") if isinstance(blob, str) else bytes(blob)
        name = getattr(data, "m_Name", f"textasset_{obj.path_id}") or f"textasset_{obj.path_id}"
        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)

        suffix = ".txt" if raw[:1] in {b"{", b"[", b"#"} else ".bin"
        target = output_dir / f"{safe_name}{suffix}"
        target.write_bytes(raw)
        manifest.append({"name": name, "path": repo_relative(target), "size": len(raw)})

        if name == "IAPProductCatalog":
            catalog = json.loads(raw.decode("utf-8"))
            for product in catalog.get("products", []):
                iap_summary.append(
                    {
                        "id": product.get("id"),
                        "type": product.get("type"),
                        "title": product.get("defaultDescription", {}).get("title"),
                        "description": product.get("defaultDescription", {}).get("description"),
                        "google_price_num": product.get("googlePrice", {}).get("num"),
                    }
                )

    (repo / "data" / "unity-textassets-manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    (repo / "data" / "unity-iap-summary.json").write_text(
        json.dumps(iap_summary, indent=2), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
