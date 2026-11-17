"""Package the standalone demo page and its own SVG/project assets."""
from pathlib import Path
import zipfile,json
root=Path(__file__).resolve().parents[1]
source=root/'exports/demonstration-2026-11-04'
files=sorted((source/'svg').glob('*.svg'))+sorted((source/'projects').glob('*.json'))+sorted(source.glob('interactive-*.svg'))+[source/'palette.json',source/'manifest.json']
svg_count=len(list((source/'svg').glob('*.svg')))
assert svg_count==36
with zipfile.ZipFile(source/'compositions.zip','w',zipfile.ZIP_DEFLATED) as z:
 for file in files:z.write(file,file.relative_to(source))
html=(source/'index.html').read_text().replace('<a href="web-report.zip" download>Скачать страницу с примерами</a>','')
with zipfile.ZipFile(source/'web-report.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('examples/index.html',html)
 for file in files:z.write(file,Path('examples')/file.relative_to(source))
 z.writestr('examples/README.txt','Откройте index.html. Три метафоры. Формат холста и набор S/L выбираются рядом с каждым примером. Всего 36 обычных SVG и 3 интерактивных SVG. Интерактивные SVG открывайте отдельным файлом в браузере: редактор работает офлайн; сохраняйте правки кнопкой «Интерактивный SVG». JSON проектов хранит редактируемые сцены. Палитру palette.json можно загрузить в конструктор. API не требуется для просмотра примеров.\n')
with zipfile.ZipFile(source/'web-report.zip') as z:assert z.testzip() is None
print(json.dumps({'svg':svg_count,'projects':3,'page':str(source/'index.html')}))

# Two separate deliveries of the same composition.
first=json.loads((source/'manifest.json').read_text())['cases'][0]
with zipfile.ZipFile(source/'svg-for-review.zip','w',zipfile.ZIP_DEFLATED) as z:
 z.write(source/'composition-figma.svg','composition-figma.svg')
 z.write(source/('interactive-'+first['id']+'.svg'),'composition-browser.svg')
 z.writestr('README.txt','composition-figma.svg — чистая векторная композиция для импорта и редактирования в Figma.\ncomposition-browser.svg — интерактивный редактор: откройте файл отдельно в браузере (проверено в Chrome). Работает без интернета. Для сохранения правок скачайте новый «Интерактивный SVG». В Figma интерактивность не переносится.\nОба SVG показывают одну исходную композицию.\n')
