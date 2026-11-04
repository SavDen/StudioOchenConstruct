"""Package the existing gallery as a portable web report, without an AI call."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
source = root / "exports" / "metaphors-2026-11-04"
page = source / "index.html"
archive = source / "web-report.zip"
html = page.read_text()
old_link = ' · <a href="report.md" download>Отчёт с описаниями</a>'
web_link = ' · <a href="web-report.zip" download>Скачать веб-отчёт</a>'
if old_link in html:
    html = html.replace(old_link, web_link)
elif web_link not in html:
    raise SystemExit("Expected report download link is missing")
page.write_text(html)

# The packaged page already IS the downloaded report; omit its self-download.
portable_html = html.replace(web_link, "")
files = [source / "compositions.zip"]
for folder in ["svg", "projects"]:
    files.extend(sorted((source / folder).glob("*")))
if not all(p.is_file() for p in files):
    raise SystemExit("A report asset is missing")
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("web-report/index.html", portable_html)
    for file in files:
        z.write(file, Path("web-report") / file.relative_to(source))
    z.writestr("web-report/README.txt", "Откройте index.html в браузере. Все 18 метафор, 162 SVG, описания и фильтры работают без сервера и Gemini. Клик по изображению открывает SVG, ссылки SVG и JSON скачивают отдельные файлы.\n")
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len([n for n in z.namelist() if n.startswith("web-report/svg/")]) == 162
print(json.dumps({"page": str(page), "archive": str(archive), "svg": 162, "projects": 18}, ensure_ascii=False))
