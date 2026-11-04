"""Export only the editor and reviewed galleries; no server configuration."""
from pathlib import Path
import json
import shutil
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"
GALLERIES = ["metaphors-2026-11-04", "metaphors-directional-2026-11-04", "metaphors-refined-2026-11-04"]


def deployment_settings():
    file = ROOT / "deployment/pages.json"
    config = json.loads(file.read_text()) if file.exists() else {"mode":"static"}
    if config == {"mode":"static"}:
        return config
    if set(config) != {"mode", "apiBase"} or config["mode"] != "remote":
        raise SystemExit("Invalid public Pages configuration")
    url = urlsplit(config["apiBase"])
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise SystemExit("Pages API requires a public HTTPS address without credentials")
    return config


def build():
    if OUT.is_symlink():
        raise SystemExit("Refusing a symlink output directory")
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for file in (ROOT / "dist").iterdir():
        if file.is_symlink():
            raise SystemExit("Unexpected symlink in dist")
        if file.is_file() and file.suffix in {".html", ".css", ".js", ".svg"}:
            shutil.copy2(file, OUT / file.name)
    config = deployment_settings()
    (OUT / "deployment.js").write_text("globalThis.STUDIO_DEPLOYMENT = "+json.dumps(config)+";\n")
    shutil.copy2(ROOT / "prompts/composition-system.txt", OUT / "composition-prompt.txt")
    (OUT / ".nojekyll").touch()
    links = []
    scenes = 0
    for name in GALLERIES:
        source = ROOT / "exports" / name
        target = OUT / "reviews" / name
        target.mkdir(parents=True)
        for entry in ["index.html", "manifest.json", "reviews.json", "compositions.zip", "web-report.zip", "framing-comparison.png"]:
            if (source / entry).is_file():
                shutil.copy2(source / entry, target / entry)
        for folder in ["svg", "projects"]:
            shutil.copytree(source / folder, target / folder)
        manifest = json.loads((source / "manifest.json").read_text())
        scenes += sum(len(case["outputs"]) for case in manifest["cases"])
        links.append(f'<a href="reviews/{name}/">'+{"metaphors-2026-11-04":"Отчёт · 18 метафор", "metaphors-directional-2026-11-04":"Проверка расстановки", "metaphors-refined-2026-11-04":"Смысл и кадрирование"}[name]+"</a>")
    index = OUT / "index.html"
    html = index.read_text()
    html = html.replace('<div class="project-popover">', '<div class="project-popover">'+"".join(links))
    index.write_text(html)
    (OUT / "build-info.json").write_text(json.dumps({"mode":config["mode"], "galleries":GALLERIES, "svgCount":scenes}, indent=2))
    print(json.dumps({"directory":str(OUT), "galleries":len(GALLERIES), "svgCount":scenes}))


if __name__ == "__main__":
    build()
