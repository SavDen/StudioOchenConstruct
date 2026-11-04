# studio-ochen-construct: GitHub и GitHub Pages

Исходники, тесты и статическая сборка отправлены в [SavDen/StudioOchenConstruct](https://github.com/SavDen/StudioOchenConstruct), ветка main. Название проекта — studio-ochen-construct. Публикация Pages и собственный домен ещё не подтверждены.

## Состав публикации

`npm run build:pages` собирает `_site`: редактор из dist, реестр, текст промпта и три галереи — всего 234 SVG, проекты JSON и архивы. Серверные скрипты, env, ответы upstream и резервные копии в сайт не копируются. Относительные ссылки рассчитаны и на корень домена, и на подкаталог репозитория.

- reviews/metaphors-2026-11-04/ — основной отчёт: 18 метафор, 162 SVG.
- reviews/metaphors-directional-2026-11-04/ — одобренная направленная коррекция: 36 SVG.
- reviews/metaphors-refined-2026-11-04/ — смысл и кадрирование: 36 SVG и сравнение до/после.

Опубликованный редактор запускается в режиме Gemini и использует HTTPS gateway из deployment/pages.json. Подбор «По словам», слои, память, импорт JSON и SVG-экспорт работают в браузере. Галереи доступны из меню «Проект». Локальный npm start продолжает использовать свой API.

## Проверка локально

```sh
npm ci
npm test
npm run check:secrets
npm run build:pages
npm run check:pages
npm run preview:pages
```

Предпросмотр: http://localhost:8001/. Проверка Pages проверяет ссылки HTML, все SVG и JSON из манифестов, ZIP и состав выходной папки. Проверка секретов просматривает файлы для Git и ZIP; `python3 scripts/check_secrets.py --history` включает историю. Это поиск известных локальных секретов и распространённых форматов ключей, а не универсальный детектор конфиденциальных данных.

## Подключить GitHub

Репозиторий SavDen/StudioOchenConstruct подключён как origin по SSH; main отправлена на GitHub. В Settings → Pages выберите GitHub Actions. Workflow pages.yml выполняет тесты, проверку секретов, сборку и проверку ссылок; deploy публикует только готовый статический артефакт. Pull request запускает проверки без публикации. Доступен ручной запуск через Actions.

Использованы официальные configure-pages, upload-pages-artifact и deploy-pages: [документация GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). На бесплатном плане Pages доступен для публичных репозиториев; приватные зависят от плана аккаунта.

Ожидаемый адрес после активации Pages: https://SavDen.github.io/StudioOchenConstruct/. Собственный домен подключается отдельно через Settings → Pages после регистрации и настройки DNS. Имя репозитория не фиксирует будущий домен. Файл CNAME появится после выбора принадлежащего владельцу домена.

## Живая генерация

Pages размещает статические файлы и не запускает scripts/serve.mjs. Для Gemini нужен отдельно размещённый Node.js-gateway с текущей валидацией планов и серверными ключами. Существующий HTTPS-прокси к модели сам по себе не заменяет этот исполнитель.

Gateway размещён отдельным контейнером studio-ochen-construct на сервере прокси. Публичный адрес — https://gemini-179-255-187-165.sslip.io/studio-api, допустимый origin — https://savden.github.io. Локальный режим по умолчанию сохраняет прежнюю проверку localhost. Публичный режим включается только явными серверными настройками и ограничен CORS, числом параллельных запросов и квотами. CORS не заменяет авторизацию произвольных HTTP-клиентов. Подробности размещения и отката — в [deployment/README.md](../deployment/README.md). Токен прокси в сайт и Git не включён.

Пользовательская палитра и запись демонстрации остаются отдельными пунктами задания. Код отправлен в GitHub; успешная публикация сайта проверяется отдельно.
