// Telegram Web App initialization
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

// API Configuration
const API_BASE_URL = '/api'; // PHP Backend API URL
const YOOKASSA_SHOP_ID = '1293384';

// Store instructions data
let instructionsData = {};

// User state
let currentUser = null;

// Payment polling state
let activePaymentId = null;
let paymentCheckInterval = null;
let paymentCheckTimeout = null;
let balanceBeforePayment = null;

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize Telegram Web App
function initTelegram() {
    if (!tg) {
        console.log('Telegram WebApp not available');
        return false;
    }

    // Expand to full height
    tg.expand();

    // Set header color (if supported)
    if (typeof tg.setHeaderColor === 'function') {
        try {
            tg.setHeaderColor('#111111');
        } catch (e) {
            // Ignore if not supported in older versions
        }
    }

    // Set background color
    tg.setBackgroundColor('#111111');

    // Enable closing confirmation
    tg.enableClosingConfirmation();

    // Listen for visibility changes (when user returns from payment)
    tg.onEvent('visibilityChanged', function(isVisible) {
        if (isVisible && currentUser) {
            console.log('WebApp became visible, refreshing balance...');
            // Refresh balance when user returns to the app
            setTimeout(() => {
                loadUserBalance();
                showToast('Баланс обновлён', 'success');
            }, 500);
        }
    });

    // Listen for messages from payment success page
    tg.onEvent('messageReceived', function(eventData) {
        console.log('Message received:', eventData);
        if (eventData.type === 'payment_success') {
            console.log('Payment success received, refreshing balance...');
            setTimeout(() => {
                loadUserBalance();
                showToast('Баланс обновлён', 'success');
            }, 500);
        }
    });

    console.log('Telegram WebApp initialized');

    return true;
}

// Get user data from Telegram
function initUser() {
    console.log('=== Init User ===');
    console.log('Telegram object:', tg);
    
    if (tg && tg.initDataUnsafe) {
        console.log('initDataUnsafe:', tg.initDataUnsafe);
        console.log('initDataUnsafe.user:', tg.initDataUnsafe.user);
    }
    
    // Проверяем наличие данных пользователя от Telegram
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const tgUser = tg.initDataUnsafe.user;
        console.log('Telegram user data:', tgUser);
        
        currentUser = {
            id: tgUser.id,
            firstName: tgUser.first_name || 'Пользователь',
            lastName: tgUser.last_name || '',
            username: tgUser.username || '',
            avatarUrl: tgUser.photo_url || null
        };

        console.log('Created currentUser:', currentUser);

        // Update profile UI
        updateProfileUI();

        // Load balance from backend
        loadUserBalance();
        
        console.log('Telegram user initialized successfully');
    } else {
        // Demo mode - no Telegram
        console.log('No Telegram user data, using demo mode');
        
        currentUser = {
            id: 123456,
            firstName: 'Демо',
            lastName: 'Пользователь',
            username: 'demo_user',
            avatarUrl: null
        };
        updateProfileUI();
        loadUserBalance();
    }
}

// Update profile UI with user data
function updateProfileUI() {
    if (!currentUser) return;

    const profileName = document.getElementById('profileName');
    const profileUsername = document.getElementById('profileUsername');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileAvatarImg = document.getElementById('profileAvatarImg');
    const profileAvatarText = document.getElementById('profileAvatarText');

    if (profileName) {
        profileName.textContent = `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.firstName;
    }

    if (profileUsername) {
        profileUsername.textContent = currentUser.username ? `@${currentUser.username}` : 'Без username';
    }

    if (profileAvatar && profileAvatarImg && profileAvatarText) {
        if (currentUser.avatarUrl) {
            profileAvatarImg.src = currentUser.avatarUrl;
            profileAvatarImg.style.display = 'block';
            profileAvatarText.style.display = 'none';
        } else {
            profileAvatarImg.style.display = 'none';
            profileAvatarText.style.display = 'block';
            const initial = (currentUser.firstName || 'U').charAt(0).toUpperCase();
            profileAvatarText.textContent = initial;
        }
    }
}

// Load user balance from backend
async function loadUserBalance() {
    const balanceValue = document.getElementById('balanceValue');
    const devicesCount = document.getElementById('devicesCount');
    const subscriptionEnd = document.getElementById('subscriptionEnd');

    if (!currentUser || !balanceValue) return;

    try {
        const response = await fetch(`${API_BASE_URL}/balance?userId=${currentUser.id}`);

        if (response.ok) {
            const data = await response.json();
            balanceValue.textContent = parseFloat(data.balance || 0).toFixed(2);

            if (devicesCount) {
                devicesCount.textContent = `${data.devicesCount || 0}/3`;
            }

            // Update subscription UI
            updateSubscriptionUI(data);
        } else {
            // Backend not available - use demo mode
            if (balanceValue) balanceValue.textContent = '0.00';
            updateSubscriptionUI({ subscriptionActive: false, subscriptionPlan: null, subscriptionEnd: null });
        }
    } catch (error) {
        console.warn('Backend not available, using demo mode:', error);
        if (balanceValue) balanceValue.textContent = '0.00';
        updateSubscriptionUI({ subscriptionActive: false, subscriptionPlan: null, subscriptionEnd: null });
    }
}

// Check if we returned after payment
function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('paymentId');
    const status = urlParams.get('status');

    if (paymentId && status === 'success') {
        console.log('Returned after payment, refreshing balance...');
        // Refresh balance after return
        setTimeout(() => {
            loadUserBalance();
            showToast('Баланс обновлён', 'success');
        }, 500);

        // Clean URL
        if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

// Start payment status polling
function startPaymentCheck(paymentId, type) {
    // Stop any existing check
    stopPaymentCheck();
    
    activePaymentId = paymentId;
    
    // Get balance before payment for comparison
    balanceBeforePayment = null;
    
    console.log('Starting payment check for:', paymentId, type);
    
    // Show persistent notification
    showPaymentWaiting(type);
    
    // First, get current balance
    getBalance().then(balance => {
        balanceBeforePayment = balance;
        console.log('Balance before payment:', balanceBeforePayment);
        
        // Check immediately after 3 seconds
        paymentCheckTimeout = setTimeout(() => {
            checkPaymentStatus(paymentId, type);
            
            // Then check every 3 seconds for up to 3 minutes
            paymentCheckInterval = setInterval(() => {
                checkPaymentStatus(paymentId, type);
            }, 3000);
            
            // Stop after 3 minutes
            setTimeout(() => {
                stopPaymentCheck();
                showToast('⚠️ Превышено время ожидания. Если средства были списаны, они поступят в течение нескольких минут.', 'error');
            }, 180000);
        }, 3000);
    });
}

// Show persistent payment waiting notification
function showPaymentWaiting(type) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast.payment-wait');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast payment-wait';
    toast.innerHTML = `
        <span class="toast-icon">⏳</span>
        <span>${type === 'subscription' ? 'Ожидание активации подписки...' : 'Ожидание подтверждения платежа...'}</span>
    `;
    document.body.appendChild(toast);
    
    toast.offsetHeight;
    toast.classList.add('show');
    
    // Auto-hide after 10 seconds, but polling continues
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 10000);
}

// Stop payment status polling
function stopPaymentCheck() {
    if (paymentCheckTimeout) {
        clearTimeout(paymentCheckTimeout);
        paymentCheckTimeout = null;
    }
    if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
    }
    activePaymentId = null;
    balanceBeforePayment = null;
}

// Get current balance
async function getBalance() {
    if (!currentUser) return 0;
    
    try {
        const response = await fetch(`${API_BASE_URL}/balance?userId=${currentUser.id}`);
        if (response.ok) {
            const data = await response.json();
            return parseFloat(data.balance || 0);
        }
    } catch (error) {
        console.error('Get balance error:', error);
    }
    return 0;
}

// Check payment status
async function checkPaymentStatus(paymentId, type) {
    if (!paymentId || !currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/balance?userId=${currentUser.id}`);
        
        if (response.ok) {
            const data = await response.json();
            const currentBalance = parseFloat(data.balance || 0);
            
            // Check if subscription is now active or balance increased
            if (type === 'subscription') {
                if (data.subscriptionActive) {
                    stopPaymentCheck();
                    console.log('Subscription activated!');
                    showToast('✅ Подписка активирована!', 'success');
                    loadUserBalance();
                    return;
                }
            } else {
                // For balance top-up, check if balance increased
                if (balanceBeforePayment !== null && currentBalance > balanceBeforePayment) {
                    stopPaymentCheck();
                    console.log('Payment confirmed! Balance:', balanceBeforePayment, '->', currentBalance);
                    showToast('✅ Оплата подтверждена! Баланс обновлён', 'success');
                    loadUserBalance();
                    return;
                }
            }
            
            // Log that check is ongoing
            console.log('Payment check ongoing...', paymentId);
        }
    } catch (error) {
        console.error('Payment status check error:', error);
    }
}

// Manual payment status check (for button)
async function manualPaymentCheck() {
    if (activePaymentId) {
        showToast('🔄 Проверка статуса...', 'info');
        await checkPaymentStatus(activePaymentId, 'balance');
    }
}

// Update subscription UI
function updateSubscriptionUI(data) {
    const statusBlock = document.getElementById('subscriptionStatusBlock');
    const subscriptionEnd = document.getElementById('subscriptionEnd');
    
    if (!statusBlock) return;
    
    const isActive = data.subscriptionActive;
    const plan = data.subscriptionPlan;
    const endDate = data.subscriptionEnd;
    
    if (isActive) {
        statusBlock.classList.add('active');
        statusBlock.querySelector('.status-icon').textContent = '✅';
        
        const planName = plan === 'telegram' ? 'Telegram' : 'Полный';
        statusBlock.querySelector('.status-text').textContent = `${planName} доступ`;
        
        if (subscriptionEnd) {
            const date = new Date(endDate);
            subscriptionEnd.textContent = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        } else {
            subscriptionEnd.textContent = '—';
        }
    } else {
        statusBlock.classList.remove('active');
        statusBlock.querySelector('.status-icon').textContent = '❌';
        statusBlock.querySelector('.status-text').textContent = 'Не активна';
        
        if (subscriptionEnd) {
            subscriptionEnd.textContent = '—';
        }
    }
}

// Refresh balance
async function refreshBalance() {
    const refreshBtn = document.getElementById('refreshBalance');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            refreshBtn.style.transform = '';
        }, 500);
    }
    
    await loadUserBalance();
    showToast('Баланс обновлён', 'success');
}

// Parse markdown
function parseMarkdown(text) {
    if (!text) return '';

    let html = String(text)
        .replace(/### (.+?)$/gm, '<h5>$1</h5>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/__(.+?)__/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/_(.+?)_/g, '<i>$1</i>')
        .replace(/==(.+?)==/g, '<mark>$1</mark>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    return html;
}

// Navigation
function switchSection(sectionName) {
    const sections = document.querySelectorAll('.section');
    const navItems = document.querySelectorAll('.nav-item');

    sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${sectionName}-section`) {
            section.classList.add('active');
            
            // Если переключились на VPN вкладку - обновляем карточки
            if (sectionName === 'vpn') {
                loadCards();
            }
        }
    });

    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Haptic feedback
    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Top Up Modal
let selectedAmount = null;

function openTopUpModal() {
    const modal = document.getElementById('topUpModal');
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        selectedAmount = null;
        updateSelectedAmount();
    }
    
    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
        tg.HapticFeedback.impactOccurred('light');
    }
}

function closeTopUpModal() {
    const modal = document.getElementById('topUpModal');
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.add('closing');
    }

    setTimeout(() => {
        modal.classList.remove('active');
        if (modalContent) {
            modalContent.classList.remove('closing');
        }
        document.body.classList.remove('modal-open');
    }, 300);
}

// Subscription Modal
let selectedPlan = null;
let currentPrices = {
    telegramPrice: 99,
    fullPrice: 299,
    minTopUp: 50,
    maxTopUp: 500,
    billingCycle: 'month'
};

// Словарь периодов подписки
const billingCycleLabels = {
    'day': 'день',
    'week': 'неделю',
    'month': 'месяц',
    'year': 'год'
};

// Загрузка цен из API
async function loadPrices() {
    try {
        const response = await fetch(`${API_BASE_URL}/prices`);
        if (response.ok) {
            const data = await response.json();
            currentPrices = {
                telegramPrice: data.telegramPrice || 99,
                fullPrice: data.fullPrice || 299,
                minTopUp: data.minTopUp || 50,
                maxTopUp: data.maxTopUp || 500,
                billingCycle: data.billingCycle || 'month'
            };
            // Обновляем цены в модальном окне
            updatePricesInModal();
            // Обновляем placeholder и атрибуты input
            updateTopUpLimits();
        }
    } catch (error) {
        console.error('Load prices error:', error);
    }
}

// Обновление лимитов пополнения
function updateTopUpLimits() {
    const customAmount = document.getElementById('customAmount');
    if (customAmount) {
        customAmount.min = currentPrices.minTopUp;
        customAmount.max = currentPrices.maxTopUp;
        customAmount.placeholder = `Мин. ${currentPrices.minTopUp} ₽`;
    }
    
    // Обновляем текст в payment-info (для модального окна пополнения)
    const topUpPaymentNote = document.querySelector('#topUpModal .payment-info .payment-note');
    if (topUpPaymentNote) {
        topUpPaymentNote.textContent = `Минимальная сумма: ${currentPrices.minTopUp} ₽ | Максимальная: ${currentPrices.maxTopUp} ₽`;
    }
    
    // Обновляем текст о периоде списания (для модального окна подписки)
    const subscriptionPaymentNote = document.querySelector('#subscriptionModal .payment-info .payment-note');
    if (subscriptionPaymentNote) {
        const periodLabel = billingCycleLabels[currentPrices.billingCycle] || 'месяц';
        const daysLabel = {
            'day': '1 день',
            'week': '7 дней',
            'month': '30 дней',
            'year': '365 дней'
        };
        subscriptionPaymentNote.textContent = `Списание каждые ${daysLabel[currentPrices.billingCycle] || '30 дней'}`;
    }
}

// Обновление цен в модальном окне
function updatePricesInModal() {
    const telegramPriceEl = document.querySelector('.plan-card[data-plan="telegram"] .price-value');
    const telegramPeriodEl = document.querySelector('.plan-card[data-plan="telegram"] .price-period');
    const telegramBtn = document.querySelector('.btn-plan-select[data-plan="telegram"]');
    const fullPriceEl = document.querySelector('.plan-card[data-plan="full"] .price-value');
    const fullPeriodEl = document.querySelector('.plan-card[data-plan="full"] .price-period');
    const fullBtn = document.querySelector('.btn-plan-select[data-plan="full"]');

    const periodLabel = billingCycleLabels[currentPrices.billingCycle] || 'месяц';

    if (telegramPriceEl) {
        telegramPriceEl.textContent = currentPrices.telegramPrice;
    }
    if (telegramPeriodEl) {
        telegramPeriodEl.textContent = `₽/${periodLabel}`;
    }
    if (telegramBtn) {
        telegramBtn.setAttribute('data-price', currentPrices.telegramPrice);
    }
    if (fullPriceEl) {
        fullPriceEl.textContent = currentPrices.fullPrice;
    }
    if (fullPeriodEl) {
        fullPeriodEl.textContent = `₽/${periodLabel}`;
    }
    if (fullBtn) {
        fullBtn.setAttribute('data-price', currentPrices.fullPrice);
    }
}

function openSubscriptionModal() {
    const modal = document.getElementById('subscriptionModal');
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        selectedPlan = null;

        // Загружаем баланс и цены при открытии модального окна
        loadBalanceForSubscription();
        loadPrices();
    }

    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Загрузка баланса для отображения в модальном окне
async function loadBalanceForSubscription() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE_URL}/balance?userId=${currentUser.id}`);
        if (response.ok) {
            const data = await response.json();
            const balanceInfo = document.getElementById('balanceInfo');
            const currentBalance = document.getElementById('currentBalance');
            if (balanceInfo && currentBalance) {
                currentBalance.textContent = parseFloat(data.balance || 0).toFixed(2);
            }
            
            // Обновляем кнопки подписки с учётом текущей подписки
            updateSubscriptionButtons(data);
        }
    } catch (error) {
        console.error('Load balance error:', error);
    }
}

// Обновление кнопок подписки с учётом текущей
function updateSubscriptionButtons(balanceData) {
    const telegramBtn = document.querySelector('.btn-plan-select[data-plan="telegram"]');
    const fullBtn = document.querySelector('.btn-plan-select[data-plan="full"]');
    
    if (!telegramBtn || !fullBtn) return;
    
    const currentPlan = balanceData.subscriptionPlan;
    const subscriptionActive = balanceData.subscriptionActive;
    
    // Сбрасываем состояния
    telegramBtn.disabled = false;
    fullBtn.disabled = false;
    telegramBtn.textContent = 'Оплатить с баланса';
    fullBtn.textContent = 'Оплатить с баланса';
    
    // Если уже есть подписка
    if (subscriptionActive && currentPlan) {
        if (currentPlan === 'telegram') {
            // Можно повысить до full
            telegramBtn.disabled = true;
            telegramBtn.textContent = 'У вас оформлена';
            fullBtn.textContent = 'Повысить до Full';
        } else if (currentPlan === 'full') {
            // Уже максимальная
            telegramBtn.disabled = true;
            fullBtn.disabled = true;
            telegramBtn.textContent = 'У вас оформлена';
            fullBtn.textContent = 'У вас оформлена';
        }
    }
}

function closeSubscriptionModal() {
    const modal = document.getElementById('subscriptionModal');
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.add('closing');
    }

    setTimeout(() => {
        modal.classList.remove('active');
        if (modalContent) {
            modalContent.classList.remove('closing');
        }
        document.body.classList.remove('modal-open');
    }, 300);
}

function createSubscriptionPayment(plan, price) {
    if (!currentUser) {
        showToast('Ошибка авторизации', 'error');
        return;
    }

    const payBtn = document.querySelector(`.btn-plan-select[data-plan="${plan}"]`);
    if (!payBtn) return;

    // Оплата с баланса
    payBalanceSubscription(plan, parseFloat(price), payBtn);
}

// Оплата подписки с баланса
function payBalanceSubscription(plan, price, payBtn) {
    if (!payBtn) return;

    payBtn.disabled = true;
    payBtn.classList.add('loading');

    fetch(`${API_BASE_URL}/subscription/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            plan: plan,
            amount: price
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Подписка активирована!', 'success');
            
            closeSubscriptionModal();
            
            // Обновляем все данные
            loadUserBalance(); // Обновить баланс в профиле
            loadCards(); // Обновить карточки (убрать плашку если есть подписка)
            
            console.log('Subscription updated:', data);
        } else {
            showToast(data.error || 'Ошибка оплаты', 'error');
            payBtn.disabled = false;
        }
    })
    .catch(error => {
        console.error('Balance subscription error:', error);
        showToast('Ошибка соединения с сервером', 'error');
        payBtn.disabled = false;
    })
    .finally(() => {
        payBtn.classList.remove('loading');
    });
}

function updateSelectedAmount() {
    const presets = document.querySelectorAll('.amount-preset');
    const customInput = document.getElementById('customAmount');
    
    presets.forEach(preset => {
        preset.classList.remove('selected');
        if (selectedAmount && preset.dataset.amount === selectedAmount.toString()) {
            preset.classList.add('selected');
            customInput.value = '';
        }
    });
    
    if (customInput.value && customInput.value !== selectedAmount?.toString()) {
        presets.forEach(p => p.classList.remove('selected'));
    }
}

function getSelectedAmount() {
    const customInput = document.getElementById('customAmount');
    const customValue = parseFloat(customInput.value);

    if (customValue && customValue >= currentPrices.minTopUp) {
        return customValue;
    }

    return selectedAmount || 0;
}

// Create YooKassa payment
async function createPayment(amount) {
    const payBtn = document.getElementById('payBtn');

    if (!payBtn) {
        return;
    }

    // Проверка минимальной и максимальной суммы из настроек
    if (amount < currentPrices.minTopUp) {
        showToast(`Минимальная сумма: ${currentPrices.minTopUp} ₽`, 'error');
        return;
    }

    if (amount > currentPrices.maxTopUp) {
        showToast(`Максимальная сумма: ${currentPrices.maxTopUp} ₽`, 'error');
        return;
    }
    
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/payment/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                amount: amount,
                description: `Пополнение баланса для пользователя ${currentUser.id}`
            })
        });
        
        if (response.ok) {
            const data = await response.json();

            if (data.confirmation_url) {
                console.log('Opening payment URL:', data.confirmation_url);

                // Открываем ссылку внутри Telegram
                if (tg && tg.openLink && typeof tg.openLink === 'function') {
                    tg.openLink(data.confirmation_url);
                } else {
                    // В браузере - открываем в новой вкладке
                    window.open(data.confirmation_url, '_blank');
                }
                
                // Запускаем проверку статуса платежа
                if (data.payment_id) {
                    startPaymentCheck(data.payment_id, 'balance');
                }

                showToast('Переход к оплате...', 'success');
                closeTopUpModal();
            } else {
                console.error('No confirmation_url in response:', data);
                showToast('Ошибка создания платежа', 'error');
            }
        } else {
            const error = await response.json();
            console.error('Payment API error:', error);
            showToast(error.message || 'Ошибка платежа', 'error');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Ошибка соединения с сервером', 'error');
    } finally {
        payBtn.classList.remove('loading');
        payBtn.disabled = false;
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

    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === 'function') {
        tg.HapticFeedback.notificationOccurred(type === 'success' ? 'success' : 'error');
    }

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Load cards from API (with subscription check)
async function loadCards() {
    const container = document.getElementById('cardsContainer');

    if (!container) {
        console.error('cardsContainer not found');
        return;
    }

    try {
        // Try to load from API with user ID
        let data;
        
        if (currentUser && currentUser.id) {
            const response = await fetch(`${API_BASE_URL}/cards?userId=${currentUser.id}`);

            if (response.ok) {
                data = await response.json();
            } else {
                // Fallback to local file
                data = await loadCardsFromLocal();
            }
        } else {
            // No user - load from local
            data = await loadCardsFromLocal();
        }

        container.innerHTML = '';

        if (!data || !data.cards || !Array.isArray(data.cards)) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Ошибка: неверный формат данных</p>';
            return;
        }

        // Проверка подписки для показа плашки
        const hasSubscription = data.hasFullAccess || data.hasTelegramAccess;
        
        // Если нет подписки вообще - показываем плашку
        if (!hasSubscription) {
            const noSubscriptionBanner = document.createElement('div');
            noSubscriptionBanner.className = 'no-subscription-banner';
            noSubscriptionBanner.innerHTML = `
                <div class="banner-icon">🔒</div>
                <div class="banner-title">Нет активной подписки</div>
                <div class="banner-text">Оформите подписку для доступа к VPN и Telegram Proxy</div>
                <button class="btn btn-primary" onclick="openSubscriptionModal()">Оформить подписку</button>
            `;
            container.appendChild(noSubscriptionBanner);
        }

        const sortedCards = [...data.cards].sort((a, b) => {
            const aHasNew = a.title && a.title.includes('NEW!');
            const bHasNew = b.title && b.title.includes('NEW!');

            if (aHasNew && !bHasNew) return -1;
            if (!aHasNew && bHasNew) return 1;
            return 0;
        });

        sortedCards.forEach(card => {
            // Фильтрация карточек по подписке
            if (card.id === 'FlowStateWG' && !data.hasFullAccess) {
                return; // Пропускаем AmneziaWG без full подписки
            }
            if (card.id === 'FlowStateProxy' && !data.hasTelegramAccess) {
                return; // Пропускаем Telegram Proxy без telegram/full подписки
            }

            if (card.instruction) {
                instructionsData[card.id] = card.instruction;
            }

            const cardElement = document.createElement('div');
            cardElement.className = 'card';

            const hasBadge = card.title && card.title.includes('NEW!');
            const titleHtml = hasBadge
                ? `<span class="new-badge">NEW!</span> ${escapeHtml(card.title.replace('NEW! ', ''))}`
                : escapeHtml(card.title);

            let buttonsHtml = '';
            if (card.buttonText && card.buttonAction) {
                buttonsHtml += `<button class="btn btn-primary" data-action="${escapeHtml(card.buttonAction)}" data-card-id="${escapeHtml(card.id)}">${escapeHtml(card.buttonText)}</button>`;
            }
            if (card.websiteUrl && card.websiteText) {
                buttonsHtml += `<a href="${escapeHtml(card.websiteUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">${parseMarkdown(card.websiteText)}</a>`;
            }

            cardElement.innerHTML = `
                <div class="card-header">
                    <h3>${titleHtml}</h3>
                </div>
                <p>${parseMarkdown(card.description)}</p>
                <div class="card-actions">${buttonsHtml}</div>
            `;

            container.appendChild(cardElement);
        });

        container.querySelectorAll('[data-action="openInstruction"]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
                    tg.HapticFeedback.impactOccurred('light');
                }
                openInstruction(btn.getAttribute('data-card-id'));
            });
        });

        container.querySelectorAll('.btn-secondary').forEach(btn => {
            btn.addEventListener('click', () => {
                if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
                    tg.HapticFeedback.impactOccurred('light');
                }
            });
        });
    } catch (error) {
        console.error('Error loading cards:', error);
        if (container) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Ошибка загрузки данных</p>';
        }
    }
}

// Load cards from local file (fallback)
async function loadCardsFromLocal() {
    const response = await fetch('data.json', {
        cache: 'no-cache',
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    try {
        return await response.json();
    } catch (jsonError) {
        throw new Error('Invalid JSON format in data.json');
    }
}

// Open instruction modal
function openInstruction(cardId) {
    const instruction = instructionsData[cardId];
    if (!instruction) {
        console.warn(`Instruction not found for cardId: ${cardId}`);
        return;
    }

    const instructionTitle = document.getElementById('instructionTitle');
    const instructionBody = document.getElementById('instructionBody');

    if (!instructionTitle || !instructionBody) {
        console.error('Modal elements not found');
        return;
    }

    instructionTitle.textContent = instruction.title || 'Инструкция';

    let stepsHtml = '';

    if (!instruction.steps || !Array.isArray(instruction.steps)) {
        stepsHtml = '<p>Инструкция недоступна</p>';
    } else {
        instruction.steps.forEach((step, index) => {
            if (!step) return;

            if (step.type === 'links' && step.links) {
                const linkButtons = step.links
                    .filter(link => link && link.url)
                    .map(link => {
                        const url = escapeHtml(link.url);
                        const name = escapeHtml(link.name);
                        const isRawGithub = url.includes('raw.githubusercontent.com');
                        const isGithubRelease = url.includes('/releases/download/');
                        const hasDownload = instruction.download === true || link.download === true || isRawGithub || isGithubRelease;
                        const downloadAttr = hasDownload ? ' download' : '';
                        const targetAttr = hasDownload ? '' : ' target="_blank" rel="noopener noreferrer"';
                        return `<a href="${url}"${downloadAttr}${targetAttr} class="platform-btn">${name}</a>`;
                    })
                    .join('');

                stepsHtml += `
                    <h4>${escapeHtml(step.title)}</h4>
                    ${step.text ? `<p class="platform-text">${parseMarkdown(step.text)}</p>` : ''}
                    <div class="platforms-grid">${linkButtons}</div>
                `;
            }
            else if (step.type === 'copy' && step.items) {
                const copyButtons = step.items
                    .filter(item => item && item.text)
                    .map((item) => {
                        const copyText = item.text;
                        const buttonLabel = item.label ? escapeHtml(item.label) : 'Скопировать';
                        const encodedText = encodeURIComponent(copyText);
                        return `<button class="copy-btn" data-copy="${encodedText}"><span class="icon">📋</span>${buttonLabel}</button>`;
                    })
                    .join('');

                stepsHtml += `
                    <h4>${escapeHtml(step.title)}</h4>
                    ${step.text ? `<p class="platform-text">${parseMarkdown(step.text)}</p>` : ''}
                    <div class="platforms-grid">${copyButtons}</div>
                `;
            }
            else if (step.type === 'list' || step.items) {
                let listHtml = '';
                let currentSection = [];
                let currentSubtitle = '';

                (step.items || []).forEach(item => {
                    if (!item) return;

                    const subtitleMatch = item.match(/^### (.+)$/);
                    if (subtitleMatch) {
                        if (currentSection.length > 0) {
                            listHtml += `<ol>${currentSection.map(i => `<li>${parseMarkdown(i || '')}</li>`).join('')}</ol>`;
                            currentSection = [];
                        }
                        currentSubtitle = subtitleMatch[1];
                        listHtml += `<h5>${escapeHtml(currentSubtitle)}</h5>`;
                    } else {
                        currentSection.push(item);
                    }
                });

                if (currentSection.length > 0) {
                    listHtml += `<ol>${currentSection.map(i => `<li>${parseMarkdown(i || '')}</li>`).join('')}</ol>`;
                }

                stepsHtml += `
                    <h4>${escapeHtml(step.title)}</h4>
                    ${listHtml}
                `;
            }
            else if (step.type === 'text') {
                stepsHtml += `
                    <h4>${escapeHtml(step.title)}</h4>
                    <p>${parseMarkdown(step.text || '')}</p>
                `;
            }
        });
    }

    let footerHtml = '';
    if (instruction.footer) {
        if (typeof instruction.footer === 'string') {
            footerHtml = `<p class="instruction-footer-text">${escapeHtml(instruction.footer)}</p>`;
        } else if (typeof instruction.footer === 'object') {
            footerHtml = `
                <p class="instruction-footer-text">${escapeHtml(instruction.footer.text || '')}</p>
                ${instruction.footer.buttonText ? `<button class="btn btn-footer" onclick="finishInstruction()">${escapeHtml(instruction.footer.buttonText)}</button>` : ''}
            `;
        }
    }

    instructionBody.innerHTML = `${stepsHtml}${footerHtml}`;

    instructionBody.querySelectorAll('.platform-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
    });

    instructionBody.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
                tg.HapticFeedback.impactOccurred('light');
            }
            const encodedText = btn.getAttribute('data-copy');
            if (encodedText) {
                copyToClipboard(decodeURIComponent(encodedText));
            }
        });
    });

    const footerBtn = instructionBody.querySelector('.btn-footer');
    if (footerBtn) {
        footerBtn.addEventListener('click', () => {
            if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
                tg.HapticFeedback.impactOccurred('light');
            }
        });
    }

    const modal = document.getElementById('instructionModal');
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }

    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
        tg.HapticFeedback.impactOccurred('light');
    }
}

function finishInstruction() {
    if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === 'function') {
        tg.HapticFeedback.notificationOccurred('success');
    }

    setTimeout(() => {
        closeInstruction();
    }, 500);
}

function closeInstruction() {
    const modal = document.getElementById('instructionModal');
    if (!modal) return;

    const modalContent = modal.querySelector('.modal-content');

    if (modalContent) {
        modalContent.classList.add('closing');
    }

    setTimeout(() => {
        modal.classList.remove('active');
        if (modalContent) {
            modalContent.classList.remove('closing');
        }

        document.body.classList.remove('modal-open');

        if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
            tg.HapticFeedback.impactOccurred('light');
        }
    }, 300);

    const confettiContainer = document.getElementById('confettiContainer');
    if (confettiContainer) {
        confettiContainer.innerHTML = '';
    }
}

function copyToClipboard(text) {
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showToastCopy).catch(fallbackCopy);
    } else {
        fallbackCopy();
    }

    function fallbackCopy() {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToastCopy();
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
        document.body.removeChild(textArea);
    }

    function showToastCopy() {
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast show success';
        toast.innerHTML = '<span class="toast-icon">✓</span><span>Скопировано</span>';
        document.body.appendChild(toast);

        if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.notificationOccurred === 'function') {
            tg.HapticFeedback.notificationOccurred('success');
        }

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

// Modal close handlers
window.onclick = function(event) {
    const instructionModal = document.getElementById('instructionModal');
    const topUpModal = document.getElementById('topUpModal');
    const subscriptionModal = document.getElementById('subscriptionModal');

    if (event.target === instructionModal) {
        closeInstruction();
    }
    if (event.target === topUpModal) {
        closeTopUpModal();
    }
    if (event.target === subscriptionModal) {
        closeSubscriptionModal();
    }
};

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
            tg.HapticFeedback.impactOccurred('light');
        }
        const modal = btn.closest('.modal');
        if (modal && modal.id === 'instructionModal') {
            closeInstruction();
        } else if (modal && modal.id === 'topUpModal') {
            closeTopUpModal();
        } else if (modal && modal.id === 'subscriptionModal') {
            closeSubscriptionModal();
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeInstruction();
        closeTopUpModal();
        closeSubscriptionModal();
    }
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Telegram WebApp first
    initTelegram();

    // Notify Telegram that app is ready
    if (tg && tg.ready && typeof tg.ready === 'function') {
        tg.ready();
    }

    // Initialize user
    initUser();

    // Load cards and prices
    loadCards();
    loadPrices();

    // Проверяем, не вернулись ли мы после оплаты
    checkPaymentReturn();
    
    // Navigation handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchSection(item.dataset.section);
        });
    });

    // Back to VPN button
    const backToVpnBtn = document.getElementById('backToVpnBtn');
    if (backToVpnBtn) {
        backToVpnBtn.addEventListener('click', () => {
            switchSection('vpn');
        });
    }
    
    // Top up button
    const topUpBtn = document.getElementById('topUpBtn');
    if (topUpBtn) {
        topUpBtn.addEventListener('click', openTopUpModal);
    }

    // Subscribe button
    const subscribeBtn = document.getElementById('subscribeBtn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', openSubscriptionModal);
    }

    // Plan select buttons
    document.querySelectorAll('.btn-plan-select').forEach(btn => {
        btn.addEventListener('click', () => {
            if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
                tg.HapticFeedback.impactOccurred('light');
            }
            const plan = btn.dataset.plan;
            const price = btn.dataset.price;
            createSubscriptionPayment(plan, price);
        });
    });

    // Refresh balance
    const refreshBalanceBtn = document.getElementById('refreshBalance');
    if (refreshBalanceBtn) {
        refreshBalanceBtn.addEventListener('click', refreshBalance);
    }
    
    // Amount presets
    document.querySelectorAll('.amount-preset').forEach(preset => {
        preset.addEventListener('click', () => {
            if (tg && tg.HapticFeedback && typeof tg.HapticFeedback.impactOccurred === 'function') {
                tg.HapticFeedback.impactOccurred('light');
            }
            selectedAmount = parseInt(preset.dataset.amount);
            updateSelectedAmount();
        });
    });
    
    // Custom amount input
    const customAmountInput = document.getElementById('customAmount');
    if (customAmountInput) {
        customAmountInput.addEventListener('input', () => {
            selectedAmount = null;
            document.querySelectorAll('.amount-preset').forEach(p => p.classList.remove('selected'));
        });
    }
    
    // Pay button
    const payBtn = document.getElementById('payBtn');
    if (payBtn) {
        payBtn.addEventListener('click', () => {
            const amount = getSelectedAmount();
            createPayment(amount);
        });
    }
    
    // Support button
    const supportBtn = document.getElementById('supportBtn');
    if (supportBtn) {
        supportBtn.addEventListener('click', () => {
            if (tg && tg.openLink && typeof tg.openLink === 'function') {
                tg.openLink('https://t.me/your_support_username');
            } else {
                window.open('https://t.me/your_support_username', '_blank');
            }
        });
    }
    
    // Touch/mouse handlers for modals
    const modalEl = document.getElementById('instructionModal');
    let touchStartY = 0;
    let touchEndY = 0;

    if (modalEl) {
        modalEl.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        modalEl.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
            const modalBody = e.target.closest('.modal-body');

            if (!modalBody) {
                e.preventDefault();
                return;
            }

            const atTop = modalBody.scrollTop === 0;
            const atBottom = modalBody.scrollTop + modalBody.clientHeight >= modalBody.scrollHeight;

            if ((atTop && touchEndY > touchStartY) || (atBottom && touchEndY < touchStartY)) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // TopUp modal touch handlers
    const topUpModalEl = document.getElementById('topUpModal');
    if (topUpModalEl) {
        topUpModalEl.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        topUpModalEl.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
            const modalBody = e.target.closest('.modal-body');

            if (!modalBody) {
                e.preventDefault();
                return;
            }

            const atTop = modalBody.scrollTop === 0;
            const atBottom = modalBody.scrollTop + modalBody.clientHeight >= modalBody.scrollHeight;

            if ((atTop && touchEndY > touchStartY) || (atBottom && touchEndY < touchStartY)) {
                e.preventDefault();
            }
        }, { passive: false });
    }
});

console.log('Telegram Web App initialized');
