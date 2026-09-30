# PomidorQA — автотесты на Playwright

Автотесты сервиса [PomidorQA](https://aiqa.su/pomidorqa) — коротких 25-минутных встреч для QA-специалистов. В репозитории только тесты: исходный код приложения закрыт, E2E ходят на живой стенд, API-сценарии — на локальный мок.

## Что проверяется

- **Профиль.** Имя, Telegram, часовой пояс, блок «о себе» и навык «могу помочь».
- **Слот и каталог.** Хост публикует свободный слот, гость находит его по навыку и бронирует.
- **Две стороны встречи.** После бронирования карточка есть и у гостя, и у хоста в «Моих встречах».
- **Занятый слот.** После резерва карточка хоста пропадает из каталога для других участников.
- **Отмена.** Отмену бронирования видят и хост, и гость.
- **API.** Свободный слот, свой слот, слот в прошлом, несуществующий слот, повторная бронь и гонка двух запросов.
- **Unit.** Пересечение слотов по времени.

## Стек

Playwright, TypeScript, ESLint, GitHub Actions.

## Установка

```bash
npm install
npx playwright install chromium
```

## Запуск

```bash
npm run test:unit   # без сети и без браузера
npm run test:api    # HTTP к локальному мок-серверу
npm run test:e2e    # браузер на https://aiqa.su/pomidorqa
npm test            # все три уровня
npm run report      # HTML-отчёт последнего прогона
```

Локальный стенд:

```bash
POMIDORQA_BASE_URL=http://localhost:3000 npx playwright test --project=e2e
```

## CI

| Workflow | Когда запускается | Что делает |
|---|---|---|
| Playwright CI | pull request в `main`, ручной запуск | линтер и все тесты, HTML-отчёт в artifacts |
| Playwright Telegram | pull request в `main`, ручной запуск | тот же прогон и сообщение в Telegram |

Для Telegram в секретах репозитория нужны `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`.

## Структура

```
src/pyramid/                 чистые функции и локальный мок API
tests/unit/                  пересечение слотов
tests/api/                   регистрация и бронирование по HTTP
tests/e2e/                   сценарии в браузере
tests/Pages/                 экраны: профиль, слоты, каталог и брони
tests/helpers/               тестовый пользователь, регистрация, cleanup
.github/workflows/           CI и уведомление в Telegram
```
