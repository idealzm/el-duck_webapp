# El-Duck WebApp — VPN с профилем и оплатой через YooKassa

Веб-приложение для Telegram с VPN-сервисами, профилем пользователя и интеграцией платежей YooKassa.

## 📁 Структура проекта

```
el-duck_webapp/
├── index.html          # Основная разметка
├── styles.css          # Стили (тёмная тема, градиенты)
├── script.js           # Логика фронтенда
├── data.json           # Данные карточек VPN
├── server.js           # Бэкенд (Express + SQLite)
├── package.json        # Зависимости Node.js
├── database.db         # База данных (создаётся автоматически)
└── README.md           # Этот файл
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install
```

### 2. Запуск бэкенда

```bash
npm start
```

Сервер запустится на `http://localhost:3000`

### 3. Настройка Telegram Web App

1. Откройте [@BotFather](https://t.me/BotFather)
2. Создайте бота или выберите существующего
3. **Bot Settings** → **Menu Button** → **Configure Menu Button**
4. Отправьте ссылку на веб-приложение (ваш домен или ngrok для тестов)

### 4. Тестирование без Telegram

Откройте `index.html` в браузере — приложение будет работать в демо-режиме.

## 💳 YooKassa Integration

### Тестовые данные

- **ShopID**: `1293384`
- **Secret Key**: `test_*gODcogODrEe8xfydEachDNToXXslF9E6qFS1xofghfg8`

### API Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/balance?userId=123` | Получить баланс пользователя |
| POST | `/api/payment/create` | Создать платёж |
| GET | `/api/payment/success?paymentId=xxx` | Проверка статуса платежа |
| POST | `/api/payment/webhook` | Webhook от YooKassa |

### Пример создания платежа

```javascript
fetch('http://localhost:3000/api/payment/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        userId: 123456,
        amount: 500,
        description: 'Пополнение баланса'
    })
})
.then(res => res.json())
.then(data => {
    // Перенаправляем на страницу оплаты
    window.open(data.confirmation_url, '_blank');
});
```

## 🎨 Особенности дизайна

- **Современный UI** с градиентами и анимациями
- **Тёмная тема** с акцентным цветом `#00d4aa`
- **Адаптивность** для мобильных устройств
- **Нижняя навигация** между разделами
- **Снежный эффект** с сохранением состояния
- **Конфетти** при завершении инструкций

## 👤 Профиль пользователя

- Аватар с инициалами
- Отображение баланса
- Статус подписки
- Количество устройств
- Кнопка пополнения баланса
- Кнопка поддержки

## 💰 Пополнение баланса

1. Нажмите кнопку "Пополнить баланс" в профиле
2. Выберите сумму (100, 300, 500, 1000 ₽) или введите свою
3. Нажмите "Оплатить"
4. Перейдите на страницу YooKassa
5. После оплаты баланс обновится автоматически

## 🗄️ База данных

### Таблица `users`

| Поле | Тип | Описание |
|------|-----|----------|
| id | INTEGER | ID записи |
| telegram_id | INTEGER | ID пользователя Telegram |
| first_name | TEXT | Имя |
| last_name | TEXT | Фамилия |
| username | TEXT | Username |
| balance | REAL | Баланс |
| subscription_active | BOOLEAN | Активная подписка |
| devices_count | INTEGER | Количество устройств |

### Таблица `payments`

| Поле | Тип | Описание |
|------|-----|----------|
| id | TEXT | UUID платежа |
| user_id | INTEGER | ID пользователя |
| amount | REAL | Сумма |
| status | TEXT | pending/succeeded/failed |
| yookassa_payment_id | TEXT | ID в YooKassa |

## 🔧 Настройка

### Изменение цветов

В `styles.css` найдите `:root`:

```css
:root {
    --accent: #00d4aa;           /* Основной цвет */
    --accent-gradient: linear-gradient(135deg, #00d4aa 0%, #00a896 100%);
    --bg-primary: #0a0a0f;       /* Фон */
}
```

### Изменение минимальной суммы

В `script.js` и `server.js` измените значение `50` на нужное.

### Настройка поддержки

В `script.js` найдите обработчик `supportBtn` и измените ссылку:

```javascript
tg.openLink('https://t.me/your_support_username');
```

## 🌐 Деплой

### VPS (Production)

1. Установите Node.js 18+
2. Скопируйте файлы на сервер
3. Установите зависимости: `npm install`
4. Запустите через PM2: `pm2 start server.js --name el-duck`
5. Настройте nginx как reverse proxy

### nginx конфигурация

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 🔐 Безопасность

- **Экранирование HTML** для защиты от XSS
- **rel="noopener noreferrer"** для внешних ссылок
- **Проверка данных** на бэкенде
- **Минимальная сумма платежа** (50 ₽)

## 📱 Тестирование

1. Откройте `http://localhost:3000` в браузере
2. Или подключитесь через Telegram Web App
3. Проверьте все кнопки и модальные окна
4. Протестируйте платёж (тестовый режим YooKassa)

## ⚠️ Важно

- **Для продакшена** замените тестовые ключи YooKassa на боевые
- **HTTPS обязателен** для Telegram WebApp
- **Настройте webhook** YooKassa для автоматического обновления баланса
- **Бэкенд должен быть доступен** из интернета для webhook'ов

## 📞 Поддержка

Для вопросов и предложений: [@your_support_username](https://t.me/your_support_username)

---

**Готово!** Ваше VPN Web App с профилем и платежами готово к использованию 🎉
