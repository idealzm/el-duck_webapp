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

    // Search
    document.getElementById('searchBtn').addEventListener('click', () => {
        const query = document.getElementById('userSearch').value;
        searchUsers(query);
    });

    document.getElementById('userSearch').addEventListener('input', (e) => {
        searchUsers(e.target.value);
    });

    // User modal close
    document.querySelector('#userModal .modal-close').addEventListener('click', closeUserModal);
    document.getElementById('userModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeUserModal();
    });

    // Balance actions
    document.getElementById('addBalanceBtn').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('editBalance').value);
        if (amount > 0 && selectedUser) {
            updateUserBalance(selectedUser.telegram_id, amount, 'add');
        }
    });

    document.getElementById('subtractBalanceBtn').addEventListener('click', () => {
        const amount = parseFloat(document.getElementById('editBalance').value);
        if (amount > 0 && selectedUser) {
            updateUserBalance(selectedUser.telegram_id, amount, 'subtract');
        }
    });

    // Subscription update
    document.getElementById('updateSubscriptionBtn').addEventListener('click', () => {
        if (selectedUser) {
            const plan = document.getElementById('editSubscriptionPlan').value;
            const endDate = document.getElementById('editSubscriptionEnd').value;
            updateUserSubscription(selectedUser.telegram_id, plan, endDate);
        }
    });

    // Delete user
    document.getElementById('deleteUserBtn').addEventListener('click', () => {
        if (selectedUser) {
            deleteUser(selectedUser.telegram_id);
        }
    });

    // Save prices
    document.getElementById('savePricesBtn').addEventListener('click', savePrices);

    // Save settings
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
});

// Initialize Telegram Login Widget
async function initTelegramLoginWidget() {
    // Get bot username from API
    try {
        const response = await fetch(`${API_BASE_URL}/admin/bot-config`);
        const data = await response.json();
        const botUsername = data.botUsername || 'flowstatevpn_bot';
        
        // Create script element for Telegram widget
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', botUsername);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '14');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        
        const widgetContainer = document.getElementById('telegramLoginWidget');
        widgetContainer.appendChild(script);
    } catch (error) {
        console.error('Error loading bot config:', error);
        // Fallback to default bot username
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', 'flowstatevpn_bot');
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '14');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        
        const widgetContainer = document.getElementById('telegramLoginWidget');
        widgetContainer.appendChild(script);
    }
}

// Telegram auth callback
function onTelegramAuth(user) {
    console.log('Telegram Auth User:', user);
    
    // Send user data to backend for verification
    fetch(`${API_BASE_URL}/admin/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    })
    .then(res => res.json())
    .then(data => {
        console.log('Auth Response:', data);
        if (data.success) {
            // Save session
            sessionStorage.setItem('adminSession', JSON.stringify({
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                photoUrl: user.photo_url,
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
    const session = sessionStorage.getItem('adminSession');
    if (session) {
        const sessionData = JSON.parse(session);
        
        // Verify session with backend
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
                    firstName: sessionData.firstName,
                    lastName: sessionData.lastName,
                    username: sessionData.username
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
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';

    document.getElementById('adminName').textContent = `${currentAdmin.firstName} ${currentAdmin.lastName}`.trim() || currentAdmin.firstName;
    document.getElementById('adminUsername').textContent = currentAdmin.username ? `@${currentAdmin.username}` : '@admin';

    loadAllData();
}

// Show error on login screen
function showError(message) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
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
    const usersList = document.getElementById('usersList');

    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`);
        const data = await response.json();

        allUsers = data.users || [];
        renderUsers(allUsers);
    } catch (error) {
        console.error('Load users error:', error);
        usersList.innerHTML = '<p class="error-message">Ошибка загрузки пользователей</p>';
    }
}

// Render users list
function renderUsers(users) {
    const usersList = document.getElementById('usersList');

    if (users.length === 0) {
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
                    <div class="user-card-left">
                        <div class="user-avatar">${avatarInitial}</div>
                        <div class="user-info">
                            <h4>${escapeHtml(user.first_name || 'Без имени')}</h4>
                            <p>${user.username ? '@' + escapeHtml(user.username) : 'ID: ' + user.telegram_id}</p>
                        </div>
                    </div>
                </div>
                <div class="user-card-stats">
                    <div class="user-stat">
                        <span class="user-stat-label">Баланс</span>
                        <span class="user-stat-value">${parseFloat(user.balance || 0).toFixed(2)} ₽</span>
                    </div>
                    <div class="user-stat">
                        <span class="user-stat-label">Подписка</span>
                        <span class="user-stat-value ${hasSubscription ? 'has-subscription' : 'no-subscription'}">${subscriptionText}</span>
                    </div>
                    <div class="user-stat">
                        <span class="user-stat-label">Устройств</span>
                        <span class="user-stat-value">${user.devices_count || 0}/3</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    usersList.querySelectorAll('.user-card').forEach(card => {
        card.addEventListener('click', () => {
            const userId = card.dataset.userId;
            const user = allUsers.find(u => u.telegram_id == userId);
            if (user) openUserModal(user);
        });
    });
}

// Search users
function searchUsers(query) {
    const filtered = allUsers.filter(user => {
        const searchStr = `${user.telegram_id} ${user.username || ''} ${user.first_name || ''}`.toLowerCase();
        return searchStr.includes(query.toLowerCase());
    });
    renderUsers(filtered);
}

// Open user modal
function openUserModal(user) {
    selectedUser = user;

    document.getElementById('userDetailId').textContent = user.telegram_id;
    document.getElementById('userDetailName').textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Без имени';
    document.getElementById('userDetailUsername').textContent = user.username ? `@${user.username}` : '—';
    document.getElementById('userDetailBalance').textContent = `${parseFloat(user.balance || 0).toFixed(2)} ₽`;

    const subscriptionText = user.subscription_active
        ? (user.subscription_plan === 'telegram' ? 'Telegram Proxy' : 'Полный доступ')
        : 'Нет';
    document.getElementById('userDetailSubscription').textContent = subscriptionText;

    if (user.subscription_end) {
        const date = new Date(user.subscription_end);
        document.getElementById('userDetailSubscriptionEnd').textContent = date.toLocaleDateString('ru-RU');
    } else {
        document.getElementById('userDetailSubscriptionEnd').textContent = '—';
    }

    document.getElementById('userDetailDevices').textContent = `${user.devices_count || 0}/3`;

    if (user.created_at) {
        const date = new Date(user.created_at);
        document.getElementById('userDetailCreatedAt').textContent = date.toLocaleDateString('ru-RU');
    } else {
        document.getElementById('userDetailCreatedAt').textContent = '—';
    }

    // Reset form fields
    document.getElementById('editBalance').value = '';
    document.getElementById('editSubscriptionPlan').value = user.subscription_plan || '';

    if (user.subscription_end) {
        const date = new Date(user.subscription_end);
        document.getElementById('editSubscriptionEnd').value = date.toISOString().split('T')[0];
    } else {
        document.getElementById('editSubscriptionEnd').value = '';
    }

    document.getElementById('userModal').classList.add('active');
}

// Close user modal
function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
    selectedUser = null;
}

// Update user balance
async function updateUserBalance(userId, amount, operation) {
    try {
        const session = sessionStorage.getItem('adminSession');
        const sessionData = session ? JSON.parse(session) : null;
        
        const response = await fetch(`${API_BASE_URL}/admin/user/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                amount: Math.abs(amount),
                operation: operation,
                token: sessionData?.token
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Баланс изменён', 'success');
            loadUsers();
            if (selectedUser) openUserModal(selectedUser);
        } else {
            showToast(data.error || 'Ошибка', 'error');
        }
    } catch (error) {
        console.error('Update balance error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Update user subscription
async function updateUserSubscription(userId, plan, endDate) {
    try {
        const session = sessionStorage.getItem('adminSession');
        const sessionData = session ? JSON.parse(session) : null;
        
        const response = await fetch(`${API_BASE_URL}/admin/user/subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: userId,
                plan: plan,
                endDate: endDate || null,
                token: sessionData?.token
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Подписка обновлена', 'success');
            loadUsers();
            loadSubscriptions();
            closeUserModal();
        } else {
            showToast(data.error || 'Ошибка', 'error');
        }
    } catch (error) {
        console.error('Update subscription error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return;

    try {
        const session = sessionStorage.getItem('adminSession');
        const sessionData = session ? JSON.parse(session) : null;
        
        const response = await fetch(`${API_BASE_URL}/admin/user/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegramId: userId,
                token: sessionData?.token
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Пользователь удалён', 'success');
            loadUsers();
            closeUserModal();
        } else {
            showToast(data.error || 'Ошибка', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Load prices
async function loadPrices() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/prices`);
        const data = await response.json();

        document.getElementById('telegramPrice').value = data.telegramPrice || 99;
        document.getElementById('fullPrice').value = data.fullPrice || 299;
        document.getElementById('minTopUp').value = data.minTopUp || 50;
        document.getElementById('maxTopUp').value = data.maxTopUp || 500;
    } catch (error) {
        console.error('Load prices error:', error);
    }
}

// Save prices
async function savePrices() {
    const prices = {
        telegramPrice: parseInt(document.getElementById('telegramPrice').value) || 99,
        fullPrice: parseInt(document.getElementById('fullPrice').value) || 299,
        minTopUp: parseInt(document.getElementById('minTopUp').value) || 50,
        maxTopUp: parseInt(document.getElementById('maxTopUp').value) || 500
    };

    try {
        const session = sessionStorage.getItem('adminSession');
        const sessionData = session ? JSON.parse(session) : null;
        
        const response = await fetch(`${API_BASE_URL}/admin/prices`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...prices, token: sessionData?.token })
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
    const subscriptionsList = document.getElementById('subscriptionsList');

    try {
        const response = await fetch(`${API_BASE_URL}/admin/subscriptions`);
        const data = await response.json();

        allSubscriptions = data.subscriptions || [];

        // Update stats
        document.getElementById('totalSubscriptions').textContent = allSubscriptions.length;
        document.getElementById('telegramSubscriptions').textContent = allSubscriptions.filter(s => s.subscription_plan === 'telegram').length;
        document.getElementById('fullSubscriptions').textContent = allSubscriptions.filter(s => s.subscription_plan === 'full').length;

        renderSubscriptions(allSubscriptions);
    } catch (error) {
        console.error('Load subscriptions error:', error);
        subscriptionsList.innerHTML = '<p class="error-message">Ошибка загрузки подписок</p>';
    }
}

// Render subscriptions
function renderSubscriptions(subscriptions) {
    const subscriptionsList = document.getElementById('subscriptionsList');

    if (subscriptions.length === 0) {
        subscriptionsList.innerHTML = '<p class="empty-message">Активных подписок нет</p>';
        return;
    }

    subscriptionsList.innerHTML = subscriptions.map(sub => {
        const icon = sub.subscription_plan === 'telegram' ? '✈️' : '🚀';
        const planName = sub.subscription_plan === 'telegram' ? 'Telegram Proxy' : 'Полный доступ';
        const isActive = sub.subscription_active && sub.subscription_end && new Date(sub.subscription_end) > new Date();
        const statusClass = isActive ? 'active' : 'expired';
        const statusText = isActive ? 'Активна' : 'Истекла';

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
                <span class="subscription-status-badge ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// Load settings
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/settings`);
        const data = await response.json();

        settings = data;

        document.getElementById('siteEnabled').checked = data.siteEnabled !== false;
        document.getElementById('maintenanceMessage').value = data.maintenanceMessage || '';
        document.getElementById('wgConfigUrl').value = data.wgConfigUrl || '';
        document.getElementById('wgMsiUrl').value = data.wgMsiUrl || '';
        document.getElementById('proxyServer').value = data.proxyServer || '';
        document.getElementById('proxyPort').value = data.proxyPort || '';
        document.getElementById('proxyUser').value = data.proxyUser || '';
        document.getElementById('proxyPass').value = data.proxyPass || '';
        document.getElementById('adminIds').value = data.adminIds || '';
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

// Save settings
async function saveSettings() {
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

    try {
        const session = sessionStorage.getItem('adminSession');
        const sessionData = session ? JSON.parse(session) : null;
        
        const response = await fetch(`${API_BASE_URL}/admin/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newSettings, token: sessionData?.token })
        });

        const data = await response.json();

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
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);

    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
