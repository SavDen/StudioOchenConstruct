"""Check the exact static artifact, including links under a repository subpath."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
import zipfile
from build_pages import OUT, GALLERIES, deployment_settings


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        self.values += [v for k,v in attrs if k in {"src", "href"} and v]


errors = []
checked = 0
for html in OUT.rglob("*.html"):
    parser = Links()
    parser.feed(html.read_text())
    for value in parser.values:
        url = urlsplit(value)
        if url.scheme or url.netloc or not url.path:
            continue
        if url.path.startswith("/"):
            errors.append(f"Root-relative link: {html.relative_to(OUT)}")
            continue
        target = (html.parent / unquote(url.path)).resolve()
        if not target.is_relative_to(OUT.resolve()) or not target.exists():
            errors.append(f"Broken link: {html.relative_to(OUT)} → {value}")
        checked += 1
svg_count = 0
for name in GALLERIES + ["examples"]:
    base = OUT / "examples" if name == "examples" else OUT / "reviews" / name
    manifest = json.loads((base / "manifest.json").read_text())
    for case in manifest["cases"]:
        for value in ([case["project"]] if case.get("project") else []) + [o["file"] for o in case["outputs"]]:
            if not (base / value).is_file():
                errors.append(f"Missing report asset: {name}/{value}")
            checked += 1
        svg_count += len(case["outputs"])
    for archive in base.glob("*.zip"):
        with zipfile.ZipFile(archive) as z:
            if z.testzip():
                errors.append(f"Invalid archive: {archive.name}")
for path in OUT.rglob("*"):
    if any(part in {".git", ".env", "node_modules", "responses", "upstream", "before"} for part in path.relative_to(OUT).parts):
        errors.append(f"Unexpected artifact: {path.relative_to(OUT)}")
settings = (OUT / "deployment.js").read_text().removeprefix("globalThis.STUDIO_DEPLOYMENT = ").strip().removesuffix(";")
if json.loads(settings) != deployment_settings():
    errors.append("Deployment configuration mismatch")
print(json.dumps({"checkedLinks":checked,"svgCount":svg_count,"errors":errors}, ensure_ascii=False))
raise SystemExit(bool(errors))
