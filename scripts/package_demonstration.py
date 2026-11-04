"""Package the standalone demo page and its own SVG/project assets."""
from pathlib import Path
import zipfile,json
root=Path(__file__).resolve().parents[1]
source=root/'exports/demonstration-2026-11-04'
files=sorted((source/'svg').glob('*.svg'))+sorted((source/'projects').glob('*.json'))+[source/'palette.json',source/'manifest.json']
assert len(list((source/'svg').glob('*.svg')))==27
with zipfile.ZipFile(source/'compositions.zip','w',zipfile.ZIP_DEFLATED) as z:
 for file in files:z.write(file,file.relative_to(source))
html=(source/'index.html').read_text().replace('<a href="web-report.zip" download>Скачать страницу с примерами</a>','')
with zipfile.ZipFile(source/'web-report.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('examples/index.html',html)
 for file in files:z.write(file,Path('examples')/file.relative_to(source))
 z.writestr('examples/README.txt','Откройте index.html. Три метафоры, три формата и три варианта: всего 27 SVG. JSON проектов хранит редактируемые сцены. Палитру palette.json можно загрузить в конструктор. API не требуется для просмотра примеров.\n')
with zipfile.ZipFile(source/'web-report.zip') as z:assert z.testzip() is None
print(json.dumps({'svg':27,'projects':3,'page':str(source/'index.html')}))
