# El-Duck WebApp Server

Современный Node.js/Express сервер для VPN сервиса подписок с интеграцией YooKassa.

**Домен:** https://dev.el-duck.ru

## 🔐 Безопасность

### Защита от атак
- **CSRF Protection** — токены для всех mutating запросов
- **Rate Limiting** — 100 запросов на 15 минут с одного IP
- **CORS** — строгая проверка доменов
- **Валидация данных** — проверка всех входящих данных

### Токены
- Генерация через `crypto.randomBytes()` (не `Math.random()`)
- Срок действия сессии: 24 часа
- Одноразовые CSRF токены

## 🚀 Быстрый старт

### Установка зависимостей

```bash
npm install
```

### Настройка

1. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Отредактируйте `.env` (домен уже настроен на `dev.el-duck.ru`)

### Запуск

```bash
# Продакшен режим
npm start

# Режим разработки (с авто-перезагрузкой)
npm run dev

# Через PM2 (на VPS)
pm2 start ecosystem.config.js
```

## 📡 API Endpoints

### Публичные endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/health` | Проверка здоровья сервера |
| GET | `/api/balance?userId={id}` | Получить баланс пользователя |
| GET | `/api/profile?userId={id}` | Получить профиль пользователя |
| GET | `/api/cards` | Получить конфигурацию карт |
| GET | `/api/prices` | Получить текущие цены |
| GET | `/api/settings` | Получить настройки сайта |
| POST | `/api/subscription/create` | Создать подписку через YooKassa |
| POST | `/api/subscription/pay` | Оплатить подписку с баланса |
| GET | `/api/subscription/success?paymentId={id}` | Обработка успеха подписки |
| POST | `/api/payment/create` | Создать платёж (пополнение) |
| GET | `/api/payment/success?paymentId={id}` | Обработка успеха платежа |
| POST | `/api/payment/webhook` | Webhook от YooKassa |

### Admin endpoints (требуют аутентификации)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/config` | Получить конфиг (bot username, CSRF token) |
| POST | `/api/admin/auth` | Войти как администратор |
| POST | `/api/admin/check` | Проверить сессию |
| POST | `/api/admin/logout` | Выйти |
| GET | `/api/admin/users` | Получить всех пользователей |
| POST | `/api/admin/stats` | Получить статистику |
| POST | `/api/admin/user/balance` | Изменить баланс пользователя ⚠️ CSRF |
| POST | `/api/admin/user/subscription` | Изменить подписку пользователя ⚠️ CSRF |
| POST | `/api/admin/user/delete` | Удалить пользователя ⚠️ CSRF |
| GET | `/api/admin/prices` | Получить цены |
| POST | `/api/admin/prices/save` | Обновить цены ⚠️ CSRF |
| GET | `/api/admin/subscriptions` | Получить все подписки |
| GET | `/api/admin/settings` | Получить настройки |
| POST | `/api/admin/settings/save` | Обновить настройки ⚠️ CSRF |

⚠️ **CSRF Protected:** Эти endpoints требуют заголовок `X-CSRF-Token`

## 🔐 Аутентификация администратора

### 1. Получить CSRF токен и bot username
```bash
curl -X GET "http://localhost:3000/api/admin/config?telegramId=729705340"
```

Ответ:
```json
{
  "botUsername": "your_bot",
  "csrfToken": "abc123..."
}
```

### 2. Войти
```bash
curl -X POST http://localhost:3000/api/admin/auth \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 729705340}'
```

Ответ:
```json
{
  "success": true,
  "token": "admin_...",
  "telegramId": 729705340
}
```

### 3. Использование токенов
```bash
curl -X POST http://localhost:3000/api/admin/user/balance \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: abc123..." \
  -d '{
    "token": "admin_...",
    "telegramId": 729705340,
    "telegramId": 123456,
    "amount": 100,
    "operation": "add"
  }'
```

⚠️ **Важно:** CSRF токены одноразовые. Для каждого mutating запроса нужен новый токен.

## 📁 Структура проекта

```
el-duck_webapp/
├── server.js              # Точка входа сервера
├── routes/                # API маршруты
│   ├── balance.js
│   ├── subscription.js
│   ├── payment.js
│   ├── profile.js
│   ├── cards.js
│   ├── prices.js
│   ├── settings.js
│   └── admin.js
├── services/              # Бизнес-логика
│   ├── userService.js
│   ├── paymentService.js
│   └── configService.js
├── middleware/            # Express middleware
│   ├── auth.js
│   ├── validation.js
│   └── csrf.js            # CSRF защита
├── database/              # Работа с БД
│   └── init.js
├── admin/                 # Админ панель
│   └── index.html
├── .env                   # Переменные окружения (НЕ КОММИТИТЬ!)
├── .env.example           # Шаблон переменных окружения
├── .gitignore             # Игнорируемые файлы
└── package.json
```

## 🛠 Технологии

- **Node.js** + **Express** — сервер
- **sql.js** — SQLite на JavaScript
- **axios** — HTTP запросы к YooKassa
- **uuid** — Генерация уникальных ID
- **dotenv** — Переменные окружения
- **crypto** — Криптографически безопасная генерация токенов

## 🔒 Файлы с секретами (НЕ КОММИТИТЬ!)

Следующие файлы содержат чувствительные данные и добавлены в `.gitignore`:

- `.env` — Переменные окружения с ключами API
- `bot_config.json` — Конфигурация Telegram бота
- `admin_config.json` — ID администраторов
- `admin_sessions.json` — Активные сессии администраторов
- `database.db` — База данных пользователей

### Настройка для продакшена

1. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Заполните реальными значениями:
```bash
# .env
YOOKASSA_SHOP_ID=your_real_shop_id
YOOKASSA_SECRET_KEY=your_real_secret_key
BOT_TOKEN=your_bot_token
BOT_USERNAME=your_bot_username
ADMIN_TELEGRAM_ID=your_telegram_id
SESSION_SECRET=your_random_secure_string
DOMAIN=https://your-domain.com
```

3. Создайте `admin_config.json`:
```json
{
  "adminIds": ["your_telegram_id"],
  "prices": {
    "telegramPrice": 99,
    "fullPrice": 299,
    "minTopUp": 50,
    "maxTopUp": 500,
    "billingCycle": "month"
  }
}
```

## 🔧 Конфигурация

### Опции цен

Настройки цен хранятся в `admin_config.json`:

```json
{
  "adminIds": ["729705340"],
  "prices": {
    "telegramPrice": 99,
    "fullPrice": 299,
    "minTopUp": 50,
    "maxTopUp": 500,
    "billingCycle": "month"
  }
}
```

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `telegramPrice` | Цена Telegram Proxy | 99 ₽ |
| `fullPrice` | Цена полного доступа | 299 ₽ |
| `minTopUp` | Минимальное пополнение | 50 ₽ |
| `maxTopUp` | Максимальное пополнение | 500 ₽ |
| `billingCycle` | Период списания | `month` |

Параметры `billingCycle`: `day`, `week`, `month`, `year`

## 💳 YooKassa

⚠️ **Важно:** Для продакшена замените тестовые ключи на реальные в `.env`:

```bash
YOOKASSA_SHOP_ID=your_real_shop_id
YOOKASSA_SECRET_KEY=your_real_secret_key
```

Webhook URL для настройки в YooKassa:
```
https://your-domain.com/api/payment/webhook
```

## 📝 Примеры использования

### Получение баланса пользователя

```javascript
fetch('http://localhost:3000/api/balance?userId=729705340')
  .then(res => res.json())
  .then(data => console.log(data));
```

### Создание платежа

```javascript
fetch('http://localhost:3000/api/payment/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 729705340,
    amount: 100,
    description: 'Пополнение баланса'
  })
})
.then(res => res.json())
.then(data => {
  // Перенаправление на YooKassa
  window.location.href = data.confirmationUrl;
});
```

### Активация подписки через баланс

```javascript
fetch('http://localhost:3000/api/subscription/pay', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 729705340,
    plan: 'full',
    amount: 299
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Админ: изменение баланса с CSRF токеном

```javascript
// 1. Получить CSRF токен
const configRes = await fetch('http://localhost:3000/api/admin/config?telegramId=729705340');
const { csrfToken } = await configRes.json();

// 2. Изменить баланс
fetch('http://localhost:3000/api/admin/user/balance', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify({
    token: 'admin_session_token',
    telegramId: 123456,
    amount: 100,
    operation: 'add'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

## ⚠️ Важные замечания

1. **База данных** хранится в `database.db` (SQLite)
2. **Сессии администраторов** хранятся в `admin_sessions.json` (24 часа)
3. **YooKassa webhook** должен быть настроен на `https://your-domain.com/api/payment/webhook`
4. **CSRF токены** одноразовые — для каждого mutating запроса нужен новый
5. **Rate limiting** — 100 запросов на 15 минут с одного IP

## 🐛 Устранение проблем

### Порт 3000 занят
```bash
# Найти процесс
lsof -i :3000

# Убить процесс
kill <PID>
```

### Ошибки компиляции зависимостей
Используется `sql.js` (чистый JavaScript), не требующий компиляции нативных модулей.

### База данных не создаётся
Проверьте права на запись в директорию проекта.

## 📄 Лицензия

ISC
