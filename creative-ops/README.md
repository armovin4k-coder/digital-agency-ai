# Creative Ops

Веб-сервис для управления задачами между медиабайерами и креативщиками в performance-команде. Интерфейс — русский язык.

Результаты beta-проверки и список условий для production: [BETA-TEST-REPORT.md](./BETA-TEST-REPORT.md). Подробности технического аудита: [TECHNICAL-AUDIT.md](./TECHNICAL-AUDIT.md).

## Стек

- Next.js 15 App Router + TypeScript
- Tailwind CSS и компоненты в стиле shadcn/ui
- PostgreSQL (Neon) + Prisma 6
- NextAuth Credentials (JWT-сессии), bcryptjs
- Zod
- @dnd-kit
- Recharts
- Vercel Blob
- Vitest
- Vercel deployment

## Что входит

- Авторизация по email и паролю; демонстрационные карточки входа.
- Роли BUYER, CREATIVE, MANAGER с серверной проверкой доступа.
- Kanban-доска на пять колонок, поиск, фильтры и drag-and-drop разрешённых переходов.
- Создание задач байером, референсы-ссылки и загрузка файлов.
- Карточка задачи с файлами по раундам, комментариями, AI-кредитами, историей и таймлайном.
- Руководитель видит командную аналитику и может переназначить исполнителя без изменения статуса.
- Общая история действий с фильтрами в рамках ролевой видимости.
- Светлая и тёмная тема, адаптивная доска, уведомления.

## Требования

- Node.js 20.19+, 22.12+ или 24+
- npm
- PostgreSQL 14+ либо Neon
- Для файлов: Vercel Blob read/write token

## Локальный запуск

```bash
npm install
Copy-Item .env.example .env
```

Заполни `.env`:

```env
DATABASE_URL="postgresql://...pooled..."
DIRECT_URL="postgresql://...direct..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-long-random-secret"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
DEMO_USER_PASSWORD="choose-a-private-local-password"
NEXT_PUBLIC_DEMO_USER_PASSWORD="same-private-local-password"
```

Для Neon `DATABASE_URL` обычно указывает на pooled endpoint для runtime, `DIRECT_URL` — на прямое соединение для миграций. Не публикуй эти значения и не коммить `.env`. Для production обязателен уникальный `NEXTAUTH_SECRET`; приложение не использует встроенный резервный секрет.

```bash
npm run db:generate
npm run db:validate
npm run db:deploy
npm run db:seed
npm run dev
```

Открой `http://localhost:3000`.

### Демо-пользователи

Seed создаёт шесть пользователей:

| Роль | Email |
|---|---|
| Байер | buyer.anna@creativeops.demo |
| Байер | buyer.maxim@creativeops.demo |
| Креативщик | creative.alexey@creativeops.demo |
| Креативщик | creative.maria@creativeops.demo |
| Креативщик | creative.dmitry@creativeops.demo |
| Руководитель | manager.elena@creativeops.demo |

Пароль демо задаётся явно через `DEMO_USER_PASSWORD`; seed не использует встроенный пароль. Кнопки входа используют `NEXT_PUBLIC_DEMO_USER_PASSWORD`, поэтому этот пароль публичен и допустим только для тестовых данных. В production демо-вход по умолчанию запрещён. Его можно включить только на отдельной базе, содержащей исключительно демонстрационные данные: задайте серверные `ENABLE_DEMO_LOGIN=true` и `DEMO_DATABASE_ISOLATED=true`, а также клиентские `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` и `NEXT_PUBLIC_DEMO_DATABASE_ISOLATED=true`. Перед seed в production дополнительно требуются `SEED_ISOLATED_DEMO_DATABASE=true` и `DEMO_DATABASE_ISOLATED=true`. Никогда не включайте эти параметры для базы с реальными данными.

На Vercel production build автоматически применяет Prisma-миграции. Для первоначальной загрузки демо-данных временно задайте `SEED_ISOLATED_DEMO_DATABASE=true` только для Production и удалите этот флаг после успешного деплоя. Preview-деплои не запускают миграции и seed.

## Роли и доступ

| Действие | BUYER | CREATIVE | MANAGER |
|---|---|---|---|
| Видит задачи | Только свои | Все NEW и назначенные ему | Все |
| Создаёт задачу | Да | Нет | Нет |
| Редактирует задачу | Только свои NEW | Нет | Нет |
| Берёт NEW в работу | Нет | Да | Нет |
| Сдаёт результат | Нет | Только назначенные ему IN_PROGRESS | Нет |
| Принимает/возвращает | Только свои REVIEW | Нет | Нет |
| Добавляет AI-кредиты | Нет | Свои задачи в работе | Нет |
| Переназначает исполнителя | Нет | Нет | Да, для активных задач |
| Аналитика | Нет | Нет | Да |
| История | По своим задачам | По видимым задачам | Вся история |

Все права проверяются на сервере в API и бизнес-сервисах; скрытие кнопок в интерфейсе не является механизмом безопасности.

## Машина статусов

```text
NEW -> IN_PROGRESS -> REVIEW -> DONE
                         |
                         +-> REVISION -> IN_PROGRESS -> REVIEW ...
```

- CREATIVE берёт NEW: назначается assignee, фиксируется первый `takenAt`.
- CREATIVE сдаёт IN_PROGRESS: требуется хотя бы один RESULT-файл текущего раунда, сохраняется последний `submittedAt`.
- BUYER принимает REVIEW: фиксируется `completedAt`.
- BUYER возвращает REVIEW: нужен комментарий, `revisionCount` увеличивается.
- CREATIVE начинает REVISION: исполнитель остаётся тем же.
- Ролевые запреты возвращают 403; устаревшие состояния и конкурентные изменения — 409; нарушение бизнес-правил (например, отсутствие результата или комментария) — 422.
- Изменения статуса и ActivityLog пишутся в одной транзакции.

Номер раунда вложений и AI-расходов равен `revisionCount`: `0` — первая сдача; `1` — сдача после первого возврата и т.д. Старые файлы не заменяются.

## Расчёт времени и аналитика

- Время производства — `completedAt - takenAt` (согласно продуктовому определению; включает периоды проверки и правок между первым взятием и приёмкой).
- Полный цикл — `completedAt - createdAt`.
- Время ожидания исполнителя — `takenAt - createdAt`.
- Объём и распределение по статусам — задачи, созданные в выбранном периоде.
- Среднее время производства и полный цикл — задачи, завершённые в выбранном периоде; поэтому в отчёт попадают и задачи, созданные раньше выбранного диапазона.
- Загрузка исполнителей — текущие активные задачи в статусах IN_PROGRESS, REVIEW и REVISION, независимо от периода.
- AI-кредиты суммируются по дате внесения расхода в выбранном периоде как кредиты, а не денежные суммы. Тарифы и валютная стоимость пока не моделируются.
- Просрочки в KPI — незавершённые задачи из выборки по дате создания с дедлайном раньше текущего момента.

## Файлы и безопасность

Файлы принимаются в форматах PNG, JPEG, WEBP, GIF, MP4, WEBM, MOV и PDF; лимит приложения — 25 МБ на файл и до 10 файлов в интерфейсе. Upload token выдаётся сервером после проверки сессии, роли, задачи и типа вложения. Загруженные файлы должны храниться в private Vercel Blob store; выдача проходит через авторизованный `/api/attachments/:id/file`, который повторно проверяет ролевой доступ.

Подключи именно private Blob store и настрой `BLOB_READ_WRITE_TOKEN` для окружения приложения. Старые вложения, загруженные до перехода на private storage, остаются в прежнем хранилище и требуют отдельного переноса; migration добавляет путь для новых private-файлов, но не удаляет и не копирует старые объекты.

Успешная загрузка Blob и запись метаданных в PostgreSQL — два отдельных шага. При сетевом сбое возможен orphan blob; периодическая очистка неподтверждённых private-объектов остаётся операционной задачей.

## API (основные маршруты)

- `GET/POST /api/tasks`
- `GET/PATCH /api/tasks/:id`
- `POST /api/tasks/:id/status`
- `POST /api/tasks/:id/comments`
- `POST /api/tasks/:id/attachments`
- `POST /api/tasks/:id/ai-usage`
- `POST /api/tasks/:id/assign`
- `POST /api/upload`
- `GET /api/attachments/:id/file` (авторизованная выдача private Blob)
- `GET /api/analytics` (MANAGER)
- `GET /api/activity`
- `GET /api/users/creatives`
- `GET /api/auth/[...nextauth]`

## Команды

```bash
npm run dev           # локальный сервер
npm run build         # production build
npm run start         # запуск production build
npm run typecheck     # TypeScript
npm run lint          # Next lint
npm test              # Vitest
npm run db:generate   # Prisma Client
npm run db:validate   # Prisma schema validation
npm run db:migrate    # локальная dev migration
npm run db:deploy     # применить готовые миграции
npm run db:seed       # демонстрационные данные
npm run db:studio     # Prisma Studio
```

## Тесты

Unit-тесты находятся в `tests/`: машина статусов, матрица доступа и расчёт метрик. Перед выпуском запусти:

```bash
npm run db:generate
npm run db:validate
npm run typecheck
npm test
npm run test:integration
npm run build
```

Интеграционные тесты по умолчанию пропускаются, чтобы случайно не запускать их на рабочей базе. Для запуска укажи `DATABASE_URL` на изолированную локальную БД `creativeops_test` на `127.0.0.1` и установи `RUN_INTEGRATION_TESTS=true`. Тесты проверяют полный цикл BUYER → CREATIVE → BUYER, обязательность результата и комментария, ролевые ограничения, историю действий и переназначение менеджером.

## Фактический статус проверок

Последняя локальная проверка:

- `npm audit` — уязвимостей не найдено.
- `npm run typecheck`, `npm run lint`, `npm run db:validate` — успешно.
- `npm run test:unit` — 15 тестов пройдены; 2 интеграционных теста выполняются отдельно.
- `npm run test:integration` — 2 теста пройдены на изолированной локальной PostgreSQL `creativeops_test`.
- `prisma migrate status` — миграции применены, схема актуальна; локальный seed содержит 6 пользователей и 15 задач.
- `npm run build` — production-сборка успешно завершена.
- Ручной browser beta workflow прошёл для BUYER, CREATIVE и MANAGER; проверены создание, результат в двух раундах, комментарий при возврате, приёмка, история и ролевые отказы.
- Запрос задач без сессии получает `401`.

Загрузка и выдача файлов в Vercel Blob не проверены end-to-end: в локальном окружении нет `BLOB_READ_WRITE_TOKEN`. Перед проверкой настрой private Blob store и токен. Полный автоматизированный E2E, production deployment и нагрузочное тестирование остаются отдельными этапами.

### Три контрольных прохода

- [x] **Проход 1 — статическая проверка:** typecheck, lint, Prisma validation и production build прошли.
- [x] **Проход 2 — логика и права:** unit- и PostgreSQL integration-тесты прошли; проверены переходы, RBAC и транзакционные записи истории.
- [x] **Проход 3 — beta в браузере:** основной workflow проверен вручную; Blob upload/download и полная accessibility/mobile приёмка не выполнены.

## Деплой на Vercel

1. Создай PostgreSQL/Neon и скопируй pooled и direct URL.
2. Создай Vercel Blob store и добавь `BLOB_READ_WRITE_TOKEN`.
3. Импортируй Git-репозиторий в Vercel.
4. Добавь все production environment variables (`DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`).
5. Оставь `DEMO_LOGIN_ENABLED=false` и `NEXT_PUBLIC_DEMO_LOGIN_ENABLED=false`, если специально не публикуешь демо.
6. Выполни миграции через `npm run db:deploy` в контролируемом deployment step.
7. Не запускай `npm run db:seed` в production, кроме отдельной изолированной демо-базы при явном включении `SEED_ISOLATED_DEMO_DATABASE=true` и `DEMO_DATABASE_ISOLATED=true`. Никогда не включай production demo-login для базы с реальными данными.
8. Запусти проверку login, RBAC, загрузки файлов, workflow и аналитики после деплоя.

## Архитектура

Модульный монолит Next.js: route handlers отвечают за HTTP и Zod-валидацию, `server/services` содержит бизнес-операции и транзакции, `lib/permissions.ts` и `lib/status-machine.ts` — серверные политики. Prisma — единственный слой доступа к PostgreSQL. Отдельные микросервисы и фоновые очереди не нужны для MVP.

## Использование AI

Процесс разделён на роли:

- **Architect** — декомпозиция продукта, ER-модель, границы модулей, роли и workflow.
- **Backend** — Prisma-модель, API-контракты, авторизация, проверки доступа, транзакции, валидация.
- **Frontend** — Kanban, формы, карточка задачи, графики, история, адаптивность и тема.
- **QA/Reviewer** — review сценариев, тест-кейсы, проверка seed, прав доступа и временных метрик.

ИИ использовался для подготовки первичных версий схемы, сервисов, компонентов, тестов и документации. Вручную при интеграции необходимо сверить Prisma-клиент с установленной версией схемы, выполнить миграции, проверить типы и пройти интеграционный сценарий. AI-generated code не считается production-verified до прохождения этих команд и ручного QA.

## Известные ограничения текущего MVP

- Не реализованы email/push/Telegram уведомления.
- Не реализован отдельный денежный учёт AI-тарифов, только кредиты.
- Публичные URL файлов не подходят для конфиденциальных материалов.
- Нет CRUD-интерфейса управления пользователями; в MVP команда задаётся seed/БД.
- Для production необходимо настроить резервное копирование БД, мониторинг ошибок и rate limiting.
