/**
 * Admin Panel JavaScript
 */

// API Configuration
const API_BASE_URL = '/api';

// State
let currentAdmin = null;
let currentTab = 'users';
let selectedUser = null;
let allUsers = [];
let allSubscriptions = [];
let settings = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTelegramLoginWidget();
    checkSession();

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Save prices
    document.getElementById('savePricesBtn').addEventListener('click', savePrices);

    // Save settings
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
});

// Get session data
function getSessionData() {
    const session = sessionStorage.getItem('adminSession');
    return session ? JSON.parse(session) : null;
}

// Initialize Telegram Login Widget
function initTelegramLoginWidget() {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', 'idealzmtestbot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-lang', 'ru');

    const container = document.getElementById('telegramLoginWidget');
    if (container) {
        container.innerHTML = '';
        container.appendChild(script);
    }
}

// Telegram auth callback
function onTelegramAuth(user) {
    console.log('Telegram Auth User:', user);

    fetch(`${API_BASE_URL}/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    })
    .then(res => res.json())
    .then(data => {
        console.log('Auth Response:', data);
        
        if (data.success && data.token) {
            // Save session
            sessionStorage.setItem('adminSession', JSON.stringify({
                id: user.id,
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                username: user.username || '',
                photoUrl: user.photo_url || '',
                token: data.token
            }));

            currentAdmin = {
                id: user.id,
                firstName: user.first_name || 'Admin',
                lastName: user.last_name || '',
                username: user.username || 'admin'
            };

            showDashboard();
        } else {
            showError(data.error || 'Ошибка авторизации');
        }
    })
    .catch(error => {
        console.error('Auth error:', error);
        showError('Ошибка соединения с сервером');
    });
}

// Check existing session
function checkSession() {
    const sessionData = getSessionData();
    
    if (!sessionData || !sessionData.token || !sessionData.id) {
        return;
    }

    fetch(`${API_BASE_URL}/admin/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            telegramId: sessionData.id,
            token: sessionData.token
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.isAdmin) {
            currentAdmin = {
                id: sessionData.id,
                firstName: sessionData.firstName || 'Admin',
                lastName: sessionData.lastName || '',
                username: sessionData.username || 'admin'
            };
            showDashboard();
        } else {
            sessionStorage.removeItem('adminSession');
        }
    })
    .catch(error => {
        console.error('Session check error:', error);
    });
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';

    const fullName = `${currentAdmin.firstName || ''} ${currentAdmin.lastName || ''}`.trim();
    document.getElementById('adminName').textContent = fullName || currentAdmin.firstName || 'Admin';
    document.getElementById('adminUsername').textContent = currentAdmin.username ? `@${currentAdmin.username}` : '@admin';

    loadAllData();
}

// Show error
function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// Load all data
function loadAllData() {
    loadUsers();
    loadPrices();
    loadSubscriptions();
    loadSettings();
}

// Switch tabs
function switchTab(tabName) {
    currentTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    if (tabName === 'users') loadUsers();
    if (tabName === 'subscriptions') loadSubscriptions();
}

// Load users
async function loadUsers() {
    const sessionData = getSessionData();
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: sessionData?.token,
                telegramId: sessionData?.id
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        allUsers = data || [];
        renderUsers(allUsers);
    } catch (error) {
        console.error('Load users error:', error);
    }
}

// Render users
function renderUsers(users) {
    const usersList = document.getElementById('usersList');
    if (!usersList) return;

    if (!users || users.length === 0) {
        usersList.innerHTML = '<p class="empty-message">Пользователи не найдены</p>';
        return;
    }

    usersList.innerHTML = users.map(user => {
        const avatarInitial = (user.first_name || 'U').charAt(0).toUpperCase();
        const hasSubscription = user.subscription_active;
        const subscriptionText = hasSubscription
            ? (user.subscription_plan === 'telegram' ? 'Telegram' : 'Full')
            : 'Нет';

        return `
            <div class="user-card" data-user-id="${user.telegram_id}">
                <div class="user-card-header">
                    <div class="user-avatar">${avatarInitial}</div>
                    <div class="user-info">
                        <h4>${escapeHtml(user.first_name || 'Без имени')} ${escapeHtml(user.last_name || '')}</h4>
                        <p>${user.username ? '@' + escapeHtml(user.username) : 'ID: ' + user.telegram_id}</p>
                    </div>
                </div>
                <div class="user-card-body">
                    <div class="user-stat">
                        <span class="label">Баланс</span>
                        <span class="value">${user.balance} ₽</span>
                    </div>
                    <div class="user-stat">
                        <span class="label">Подписка</span>
                        <span class="value">${subscriptionText}</span>
                    </div>
                </div>
                <button class="btn-user-action" onclick="openUserModal(${user.telegram_id})">
                    Подробнее
                </button>
            </div>
        `;
    }).join('');
}

// Load prices
async function loadPrices() {
    const sessionData = getSessionData();
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/prices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: sessionData?.token,
                telegramId: sessionData?.id
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        document.getElementById('telegramPrice').value = data.telegramPrice || 99;
        document.getElementById('fullPrice').value = data.fullPrice || 299;
        document.getElementById('minTopUp').value = data.minTopUp || 50;
        document.getElementById('maxTopUp').value = data.maxTopUp || 500;
        document.getElementById('billingCycle').value = data.billingCycle || 'month';
    } catch (error) {
        console.error('Load prices error:', error);
    }
}

// Save prices
async function savePrices() {
    const sessionData = getSessionData();
    const prices = {
        telegramPrice: parseInt(document.getElementById('telegramPrice').value) || 99,
        fullPrice: parseInt(document.getElementById('fullPrice').value) || 299,
        minTopUp: parseInt(document.getElementById('minTopUp').value) || 50,
        maxTopUp: parseInt(document.getElementById('maxTopUp').value) || 500,
        billingCycle: document.getElementById('billingCycle').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/admin/prices/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...prices,
                token: sessionData?.token,
                telegramId: sessionData?.id
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Цены сохранены', 'success');
        } else {
            showToast(data.error || 'Ошибка сохранения', 'error');
        }
    } catch (error) {
        console.error('Save prices error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Load subscriptions
async function loadSubscriptions() {
    const sessionData = getSessionData();
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: sessionData?.token,
                telegramId: sessionData?.id
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        allSubscriptions = await response.json();
        
        document.getElementById('totalSubscriptions').textContent = allSubscriptions.length;
        document.getElementById('telegramSubscriptions').textContent = allSubscriptions.filter(s => s.subscription_plan === 'telegram').length;
        document.getElementById('fullSubscriptions').textContent = allSubscriptions.filter(s => s.subscription_plan === 'full').length;
        
        renderSubscriptions(allSubscriptions);
    } catch (error) {
        console.error('Load subscriptions error:', error);
    }
}

// Render subscriptions
function renderSubscriptions(subscriptions) {
    const list = document.getElementById('subscriptionsList');
    if (!list) return;

    if (!subscriptions || subscriptions.length === 0) {
        list.innerHTML = '<p class="empty-message">Активных подписок нет</p>';
        return;
    }

    list.innerHTML = subscriptions.map(sub => {
        const icon = sub.subscription_plan === 'telegram' ? '✈️' : '🚀';
        const planName = sub.subscription_plan === 'telegram' ? 'Telegram Proxy' : 'Полный доступ';
        const isActive = sub.subscription_active && sub.subscription_end && new Date(sub.subscription_end) > new Date();
        const endDate = sub.subscription_end ? new Date(sub.subscription_end).toLocaleDateString('ru-RU') : '—';

        return `
            <div class="subscription-card">
                <div class="subscription-info">
                    <span class="subscription-icon">${icon}</span>
                    <div class="subscription-details">
                        <h4>${escapeHtml(sub.first_name || 'Без имени')}</h4>
                        <p>${planName} • До ${endDate}</p>
                    </div>
                </div>
                <span class="subscription-status-badge ${isActive ? 'active' : 'expired'}">${isActive ? 'Активна' : 'Истекла'}</span>
            </div>
        `;
    }).join('');
}

// Load settings
async function loadSettings() {
    const sessionData = getSessionData();
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: sessionData?.token,
                telegramId: sessionData?.id
            })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        settings = await response.json();
        
        document.getElementById('siteEnabled').checked = settings.siteEnabled !== false;
        document.getElementById('maintenanceMessage').value = settings.maintenanceMessage || '';
        document.getElementById('wgConfigUrl').value = settings.wgConfigUrl || '';
        document.getElementById('wgMsiUrl').value = settings.wgMsiUrl || '';
        document.getElementById('proxyServer').value = settings.proxyServer || '';
        document.getElementById('proxyPort').value = settings.proxyPort || '';
        document.getElementById('proxyUser').value = settings.proxyUser || '';
        document.getElementById('proxyPass').value = settings.proxyPass || '';
        document.getElementById('adminIds').value = Array.isArray(settings.adminIds) ? settings.adminIds.join(', ') : '';
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

// Save settings
async function saveSettings() {
    const sessionData = getSessionData();
    
    console.log('=== Save Settings ===');
    console.log('Session:', sessionData);
    
    if (!sessionData || !sessionData.token || !sessionData.id) {
        showToast('Сессия не найдена. Войдите заново.', 'error');
        return;
    }
    
    const newSettings = {
        siteEnabled: document.getElementById('siteEnabled').checked,
        maintenanceMessage: document.getElementById('maintenanceMessage').value,
        wgConfigUrl: document.getElementById('wgConfigUrl').value,
        wgMsiUrl: document.getElementById('wgMsiUrl').value,
        proxyServer: document.getElementById('proxyServer').value,
        proxyPort: document.getElementById('proxyPort').value,
        proxyUser: document.getElementById('proxyUser').value,
        proxyPass: document.getElementById('proxyPass').value,
        adminIds: document.getElementById('adminIds').value
    };
    
    console.log('Settings:', newSettings);

    try {
        const response = await fetch(`${API_BASE_URL}/admin/settings/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...newSettings,
                token: sessionData.token,
                telegramId: sessionData.id
            })
        });
        
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            showToast('Настройки сохранены', 'success');
            settings = newSettings;
        } else {
            showToast(data.error || 'Ошибка сохранения', 'error');
        }
    } catch (error) {
        console.error('Save settings error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Logout
function logout() {
    if (confirm('Выйти из панели администратора?')) {
        sessionStorage.removeItem('adminSession');
        currentAdmin = null;
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('loginError').style.display = 'none';
    }
}

// Toast notification
function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
        <span>${escapeHtml(message)}</span>
    `;
    document.body.appendChild(toast);

    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => toast.remove(), 3000);
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
