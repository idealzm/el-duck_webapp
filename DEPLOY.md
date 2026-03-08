# Установка El-Duck WebApp на VPS (dev.el-duck.ru)

## 1. Подготовка сервера

### Подключение к серверу
```bash
ssh user@your-vps-ip
```

### Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### Установка Node.js 20.x
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Установка PM2
```bash
sudo npm install -g pm2
```

### Установка nginx
```bash
sudo apt install -y nginx
```

### Установка Certbot (SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 2. Загрузка проекта

### Создание директории
```bash
sudo mkdir -p /var/www/el-duck_webapp
sudo chown $USER:$USER /var/www/el-duck_webapp
```

### Копирование файлов (с локальной машины)
```bash
# С локального компьютера
scp -r /Users/idealzm/Desktop/el-duck_webapp/* user@your-vps-ip:/var/www/el-duck_webapp/
```

**Или через git:**
```bash
cd /var/www/el-duck_webapp
git init
git remote add origin <your-repo-url>
git pull origin main
```

---

## 3. Настройка проекта

### Переход в директорию
```bash
cd /var/www/el-duck_webapp
```

### Установка зависимостей
```bash
npm install --production
```

### Создание .env файла
```bash
cat > .env << EOF
YOOKASSA_SHOP_ID=1293384
YOOKASSA_SECRET_KEY=test_RuhTK6Gu2CTA-1m_wiLd6rC9pNGfgLncVzgi_0NpaJM
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DOMAIN=https://dev.el-duck.ru
ADMIN_TELEGRAM_ID=729705340
SESSION_SECRET=el-duck-secret-key-change-in-production
EOF
```

### Создание директории для логов
```bash
mkdir -p logs
```

---

## 4. Настройка nginx

### Копирование конфига
```bash
sudo cp nginx.conf /etc/nginx/sites-available/el-duck-webapp
```

### Включение сайта
```bash
sudo ln -s /etc/nginx/sites-available/el-duck-webapp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### Проверка конфига
```bash
sudo nginx -t
```

### Получение SSL сертификата
```bash
sudo certbot --nginx -d dev.el-duck.ru
```

### Перезапуск nginx
```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 5. Запуск приложения через PM2

### Старт
```bash
cd /var/www/el-duck_webapp
pm2 start ecosystem.config.js
```

### Сохранение списка процессов
```bash
pm2 save
```

### Настройка автозапуска при загрузке
```bash
pm2 startup
# Выполните команду, которую выведет (sudo env PATH=... pm2 startup ...)
```

### Проверка
```bash
pm2 status
pm2 logs el-duck-webapp
```

---

## 6. Проверка работы

### Проверка HTTPS
```bash
curl -I https://dev.el-duck.ru
```

### Проверка API
```bash
curl https://dev.el-duck.ru/health
curl https://dev.el-duck.ru/api/prices
```

### Проверка в браузере
Откройте: `https://dev.el-duck.ru`

---

## 7. Управление приложением

### Просмотр логов
```bash
pm2 logs el-duck-webapp
pm2 logs el-duck-webapp --lines 100
```

### Перезапуск
```bash
pm2 restart el-duck-webapp
```

### Остановка
```bash
pm2 stop el-duck-webapp
```

### Удаление
```bash
pm2 delete el-duck-webapp
```

### Мониторинг
```bash
pm2 monit
```

---

## 8. Настройка YooKassa webhook

В личном кабинете YooKassa укажите webhook URL:
```
https://dev.el-duck.ru/api/payment/webhook
```

---

## 9. Обновление приложения

```bash
cd /var/www/el-duck_webapp

# Если через git
git pull origin main

# Установка зависимостей (если были изменения)
npm install --production

# Перезапуск
pm2 restart el-duck-webapp
```

---

## 10. Решение проблем

### Порт 3000 занят
```bash
sudo lsof -i :3000
sudo kill <PID>
```

### Ошибки nginx
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Ошибки приложения
```bash
pm2 logs el-duck-webapp --err
```

### Проверка SSL
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

---

## 11. Безопасность

### Настройка фаервола (UFW)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### Мониторинг логов
```bash
sudo tail -f /var/log/auth.log
```

---

## Готово! 🎉

Ваш VPN сервис доступен по адресу: **https://dev.el-duck.ru**
