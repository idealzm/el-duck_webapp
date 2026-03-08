# El-Duck WebApp Server

Современный Node.js/Express сервер для VPN сервиса подписок с интеграцией YooKassa.

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

2. Отредактируйте `.env` при необходимости (тестовые ключи YooKassa уже настроены)

### Запуск

```bash
# Продакшен режим
npm start

# Режим разработки (с авто-перезагрузкой)
npm run dev
```

Сервер запустится на `http://localhost:3000`

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
| POST | `/api/admin/auth` | Войти как администратор |
| POST | `/api/admin/check` | Проверить сессию |
| POST | `/api/admin/logout` | Выйти |
| GET | `/api/admin/users` | Получить всех пользователей |
| POST | `/api/admin/stats` | Получить статистику |
| POST | `/api/admin/user/balance` | Изменить баланс пользователя |
| POST | `/api/admin/user/subscription` | Изменить подписку пользователя |
| POST | `/api/admin/user/delete` | Удалить пользователя |
| GET | `/api/admin/prices` | Получить цены |
| POST | `/api/admin/prices` | Обновить цены |
| GET | `/api/admin/subscriptions` | Получить все подписки |
| GET | `/api/admin/settings` | Получить настройки |
| POST | `/api/admin/settings` | Обновить настройки |
| GET | `/api/admin/bot-config` | Получить конфиг бота |
| POST | `/api/admin/bot-config` | Обновить конфиг бота |

## 🔐 Аутентификация администратора

### Вход
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

### Использование токена
```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{"token": "admin_...", "telegramId": 729705340}'
```

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
│   └── validation.js
├── database/              # Работа с БД
│   └── init.js
├── config/                # Конфигурация
│   └── adminConfig.js
├── .env                   # Переменные окружения
└── package.json
```

## 🛠 Технологии

- **Node.js** + **Express** — сервер
- **sql.js** — SQLite на JavaScript
- **axios** — HTTP запросы к YooKassa
- **uuid** — Генерация уникальных ID
- **dotenv** — Переменные окружения

## 🔧 Конфигурация

### Переменные окружения (.env)

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `YOOKASSA_SHOP_ID` | ID магазина YooKassa | - |
| `YOOKASSA_SECRET_KEY` | Секретный ключ YooKassa | - |
| `PORT` | Порт сервера | 3000 |
| `NODE_ENV` | Режим работы | development |
| `ADMIN_TELEGRAM_ID` | Telegram ID администратора | - |
| `SESSION_SECRET` | Секрет сессий | - |

### Администраторы

ID администраторов хранятся в `admin_config.json`:

```json
{
  "adminIds": ["729705340"],
  "prices": {
    "telegramPrice": 99,
    "fullPrice": 299,
    "minTopUp": 50,
    "maxTopUp": 500
  }
}
```

## 💳 YooKassa

Интеграция с YooKassa использует тестовые ключи по умолчанию:
- Shop ID: `1293384`
- Secret Key: `test_RuhTK6Gu2CTA-1m_wiLd6rC9pNGfgLncVzgi_0NpaJM`

Для продакшена замените их на реальные в `.env`.

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

## ⚠️ Важные замечания

1. **База данных** хранится в `database.db` (SQLite)
2. **Сессии администраторов** хранятся в `admin_sessions.json` (24 часа)
3. **YooKassa webhook** должен быть настроен на `https://your-domain.com/api/payment/webhook`

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
