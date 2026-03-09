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

    // Tab switching (sidebar nav items)
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Save prices
    document.getElementById('savePricesBtn').addEventListener('click', savePrices);

    // Save settings
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    // Search
    document.getElementById('searchBtn').addEventListener('click', () => searchUsers());
    document.getElementById('userSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });

    // Modal close
    document.querySelector('.modal-close')?.addEventListener('click', closeModal);
    document.getElementById('userModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'userModal') closeModal();
    });

    // User modal actions
    document.getElementById('addBalanceBtn')?.addEventListener('click', () => updateBalance('add'));
    document.getElementById('subtractBalanceBtn')?.addEventListener('click', () => updateBalance('subtract'));
    document.getElementById('updateSubscriptionBtn')?.addEventListener('click', updateSubscription);
    document.getElementById('deleteUserBtn')?.addEventListener('click', deleteUser);
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
                username: user.username || 'admin',
                photoUrl: user.photo_url || ''
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
                username: sessionData.username || 'admin',
                photoUrl: sessionData.photoUrl || ''
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
    
    // Set avatar initial
    const avatarInitial = (currentAdmin.firstName || 'A').charAt(0).toUpperCase();
    document.getElementById('adminAvatar').textContent = avatarInitial;

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

    document.querySelectorAll('.nav-item').forEach(btn => {
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
        allUsers = Array.isArray(data) ? data : [];
        console.log('Loaded users:', allUsers);
        renderUsers(allUsers);
    } catch (error) {
        console.error('Load users error:', error);
        showToast('Ошибка загрузки пользователей', 'error');
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
        // Parse user data safely (API returns camelCase)
        const telegramId = user.telegramId || user.telegram_id || user.id || 'N/A';
        const firstName = user.firstName || user.first_name || 'Без имени';
        const lastName = user.lastName || user.last_name || '';
        const username = user.username || null;
        const balance = typeof user.balance === 'number' ? user.balance : 0;
        const subscriptionActive = user.subscriptionActive === 1 || user.subscriptionActive === true || user.subscription_active === 1 || user.subscription_active === true;
        const subscriptionPlan = user.subscriptionPlan || user.subscription_plan || '';

        const avatarInitial = (firstName !== 'Без имени' ? firstName.charAt(0) : 'U').toUpperCase();
        
        // Subscription status
        let subscriptionText = 'Нет';
        let subscriptionClass = 'no-subscription';
        if (subscriptionActive) {
            subscriptionText = subscriptionPlan === 'telegram' ? 'Telegram' : 'Full';
            subscriptionClass = 'has-subscription';
        }

        // Display name: first_name + last_name or just first_name
        const displayName = firstName && firstName !== 'Без имени'
            ? `${escapeHtml(firstName)} ${escapeHtml(lastName)}`.trim()
            : 'Без имени';

        // Display username: @username or Telegram ID
        const displayUsername = username ? `@${escapeHtml(username)}` : `ID: ${telegramId}`;

        return `
            <div class="user-card" data-user-id="${telegramId}">
                <div class="user-card-header">
                    <div class="user-card-left">
                        <div class="user-avatar">${avatarInitial}</div>
                        <div class="user-info">
                            <h4>${displayName}</h4>
                            <p>${displayUsername}</p>
                        </div>
                    </div>
                </div>
                <div class="user-card-stats">
                    <div class="user-stat">
                        <span class="user-stat-label">Баланс</span>
                        <span class="user-stat-value">${balance} ₽</span>
                    </div>
                    <div class="user-stat">
                        <span class="user-stat-label">Подписка</span>
                        <span class="user-stat-value ${subscriptionClass}">${subscriptionText}</span>
                    </div>
                </div>
                <button class="btn-user-action" onclick="openUserModal('${telegramId}')">
                    Подробнее
                </button>
            </div>
        `;
    }).join('');
}

// Search users
function searchUsers() {
    const query = document.getElementById('userSearch').value.toLowerCase().trim();
    
    if (!query) {
        renderUsers(allUsers);
        return;
    }

    const filtered = allUsers.filter(user => {
        const telegramId = String(user.telegram_id || user.id || '');
        const username = (user.username || '').toLowerCase();
        const firstName = (user.first_name || '').toLowerCase();
        const lastName = (user.last_name || '').toLowerCase();
        
        return telegramId.includes(query) || 
               username.includes(query) || 
               firstName.includes(query) || 
               lastName.includes(query);
    });

    renderUsers(filtered);
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
        const firstName = sub.first_name || 'Без имени';

        return `
            <div class="subscription-item">
                <div class="subscription-info">
                    <div class="subscription-user">${icon} ${escapeHtml(firstName)}</div>
                    <div class="subscription-details">${planName} • До ${endDate}</div>
                </div>
                <span class="subscription-status ${isActive ? 'active' : 'expired'}">${isActive ? 'Активна' : 'Истекла'}</span>
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
        document.getElementById('adminIds').value = Array.isArray(settings.adminIds) ? settings.adminIds.join(', ') : (settings.adminIds || '');
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

    const adminIdsRaw = document.getElementById('adminIds').value;
    const adminIdsArray = adminIdsRaw
        .split(',')
        .map(id => id.trim())
        .filter(id => id && !isNaN(Number(id)))
        .map(id => Number(id));

    const newSettings = {
        siteEnabled: document.getElementById('siteEnabled').checked,
        maintenanceMessage: document.getElementById('maintenanceMessage').value,
        wgConfigUrl: document.getElementById('wgConfigUrl').value,
        wgMsiUrl: document.getElementById('wgMsiUrl').value,
        proxyServer: document.getElementById('proxyServer').value,
        proxyPort: document.getElementById('proxyPort').value,
        proxyUser: document.getElementById('proxyUser').value,
        proxyPass: document.getElementById('proxyPass').value,
        adminIds: adminIdsArray
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

// Open user modal
async function openUserModal(telegramId) {
    console.log('Opening modal for user:', telegramId);

    const user = allUsers.find(u => String(u.telegramId || u.telegram_id || u.id) === String(telegramId));
    if (!user) {
        showToast('Пользователь не найден', 'error');
        return;
    }

    selectedUser = user;

    // Fill user details (API returns camelCase)
    document.getElementById('userDetailId').textContent = user.telegramId || user.telegram_id || user.id || 'N/A';

    const firstName = user.firstName || user.first_name || 'Без имени';
    const lastName = user.lastName || user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Без имени';

    document.getElementById('userDetailName').textContent = fullName;
    document.getElementById('userDetailUsername').textContent = user.username ? `@${user.username}` : '—';
    document.getElementById('userDetailBalance').textContent = `${user.balance || 0} ₽`;

    const subscriptionActive = user.subscriptionActive === 1 || user.subscriptionActive === true || user.subscription_active === 1 || user.subscription_active === true;
    const subscriptionPlan = user.subscriptionPlan || user.subscription_plan || '';
    
    const subscriptionText = subscriptionActive
        ? (subscriptionPlan === 'telegram' ? 'Telegram Proxy' : 'Полный доступ')
        : 'Нет';
    document.getElementById('userDetailSubscription').textContent = subscriptionText;

    document.getElementById('userDetailSubscriptionEnd').textContent = user.subscription_end
        ? new Date(user.subscription_end).toLocaleDateString('ru-RU')
        : '—';

    document.getElementById('userDetailDevices').textContent = user.devices_count || user.devicesCount || 0;
    document.getElementById('userDetailCreatedAt').textContent = user.created_at
        ? new Date(user.created_at).toLocaleDateString('ru-RU')
        : '—';

    // Reset form fields
    document.getElementById('editBalance').value = '';
    
    // If subscription is active but plan is empty/null, default to 'full'
    const planValue = subscriptionActive && (!subscriptionPlan || subscriptionPlan === '')
        ? 'full'
        : (subscriptionPlan || '');
    document.getElementById('editSubscriptionPlan').value = planValue;
    
    document.getElementById('editSubscriptionEnd').value = user.subscription_end
        ? new Date(user.subscription_end).toISOString().split('T')[0]
        : '';

    document.getElementById('userModal').classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('userModal').classList.remove('active');
    selectedUser = null;
}

// Update balance
async function updateBalance(action) {
    if (!selectedUser) return;

    const amount = parseFloat(document.getElementById('editBalance').value);
    if (isNaN(amount) || amount <= 0) {
        showToast('Введите корректную сумму', 'error');
        return;
    }

    const sessionData = getSessionData();
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/user/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: sessionData?.token,
                telegramId: selectedUser.telegramId || selectedUser.telegram_id || selectedUser.id,
                amount: amount,
                operation: action
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Баланс изменён на ${action === 'add' ? '+' : '-'}${amount} ₽`, 'success');
            closeModal();
            loadUsers();
        } else {
            showToast(data.error || 'Ошибка изменения баланса', 'error');
        }
    } catch (error) {
        console.error('Update balance error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Update subscription
async function updateSubscription() {
    if (!selectedUser) return;

    const plan = document.getElementById('editSubscriptionPlan').value;
    const endDate = document.getElementById('editSubscriptionEnd').value;

    const sessionData = getSessionData();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/user/subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: sessionData?.token,
                telegramId: selectedUser.telegramId || selectedUser.telegram_id || selectedUser.id,
                plan: plan === '' ? null : plan,
                endDate: endDate || null
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Подписка обновлена', 'success');
            closeModal();
            loadUsers();
            loadSubscriptions();
        } else {
            showToast(data.error || 'Ошибка обновления подписки', 'error');
        }
    } catch (error) {
        console.error('Update subscription error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Delete user
async function deleteUser() {
    if (!selectedUser) return;

    if (!confirm(`Удалить пользователя ${selectedUser.firstName || selectedUser.first_name || 'ID: ' + (selectedUser.telegramId || selectedUser.telegram_id || selectedUser.id)}?`)) {
        return;
    }

    const sessionData = getSessionData();
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin/user/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: sessionData?.token,
                telegramId: selectedUser.telegramId || selectedUser.telegram_id || selectedUser.id
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Пользователь удалён', 'success');
            closeModal();
            loadUsers();
        } else {
            showToast(data.error || 'Ошибка удаления', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
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
