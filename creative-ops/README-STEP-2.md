# Creative Ops — этап 2: Prisma, Seed и Auth

## Что входит в этот этап

- Prisma 6.19.0 schema для PostgreSQL / Neon.
- Шесть основных моделей: `User`, `Task`, `Attachment`, `AiUsage`, `Comment`, `ActivityLog`.
- Индексы для статусов, исполнителей, дедлайнов, авторов, AI-расходов и истории.
- Seed на 6 демо-пользователей и 15 задач.
- Demo tasks распределены по статусам: 3 NEW, 3 IN_PROGRESS, 2 REVIEW, 2 REVISION, 5 DONE.
- Три незавершённые просроченные задачи и четыре задачи с историей правок.
- У каждой завершённой задачи есть несколько AI-расходов по разным сервисам.
- NextAuth v4 Credentials с bcryptjs, Zod и JWT-сессиями.
- Демонстрационные аккаунты блокируются в production, пока явно не задано `DEMO_LOGIN_ENABLED=true`.

## Требования

- Node.js 18.17+ (рекомендуется Node 20/22).
- PostgreSQL 14+ или Neon.
- npm.

## Локальный запуск

```bash
npm install
cp .env.example .env
```

Заполните `DATABASE_URL` (Neon pooled endpoint), `DIRECT_URL` (обычный, non-pooled endpoint) и `NEXTAUTH_SECRET`. Для генерации секрета:

```bash
openssl rand -base64 32
```

Затем выполните:

```bash
npm run db:validate
npm run db:generate
npm run db:deploy
npm run db:seed
```

`prisma/migrations/202611090001_init` — начальная миграция, она применяется командой `db:deploy`. Для последующих изменений схемы используйте `npm run db:migrate -- --name имя_изменения`.

## Демо-аккаунты

Общий пароль по умолчанию: `CreativeOpsDemo2026!`.

| Роль | Email |
|---|---|
| BUYER | buyer.anna@creativeops.demo |
| BUYER | buyer.maxim@creativeops.demo |
| CREATIVE | creative.alexey@creativeops.demo |
| CREATIVE | creative.maria@creativeops.demo |
| CREATIVE | creative.dmitry@creativeops.demo |
| MANAGER | manager.elena@creativeops.demo |

Переопределить пароль можно через `DEMO_USER_PASSWORD` перед запуском seed. Для карточек быстрого входа установите такое же значение в `NEXT_PUBLIC_DEMO_USER_PASSWORD`.

**Безопасность:** не используйте демо-аккаунты для реальных данных. В production вход демо-пользователей выключен по умолчанию. Включайте его только для специально подготовленного публичного стенда, где данные регулярно сбрасываются.

## Примечания по модели данных

- `takenAt` хранит первое взятие задачи и не должен перезаписываться при возврате из правок.
- `submittedAt` хранит время последней сдачи на проверку.
- `completedAt` фиксирует окончательную приёмку.
- История всех переходов и раундов правок хранится в `ActivityLog`.
- `Attachment.type` различает референсы и результаты. Для result-файлов `revisionRound=0` означает первую сдачу, `1` — сдачу после первого возврата и т.д.
- `AiUsage.credits` — Decimal(12,4), поскольку количество кредитов может быть дробным.

## Ограничение текущего этапа

Миграция Prisma генерируется командой `prisma migrate dev` только после подключения реальной PostgreSQL/Neon базы. API задач, проверка переходов и UI будут реализованы на следующих этапах.
