<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// YooKassa credentials (test)
$YOOKASSA_SHOP_ID = '1293384';
$YOOKASSA_SECRET_KEY = 'test_RuhTK6Gu2CTA-1m_wiLd6rC9pNGfgLncVzgi_0NpaJM';

// Database path
$dbPath = __DIR__ . '/database.db';

// Initialize database
function initDb($dbPath) {
    $db = new SQLite3($dbPath);
    
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            first_name TEXT,
            last_name TEXT,
            username TEXT,
            balance REAL DEFAULT 0,
            subscription_active BOOLEAN DEFAULT 0,
            subscription_plan TEXT,
            subscription_end DATETIME,
            devices_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    $db->exec("
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            yookassa_payment_id TEXT,
            description TEXT,
            payment_type TEXT DEFAULT 'topup',
            subscription_plan TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ");
    
    return $db;
}

$db = initDb($dbPath);

// Helper: Get or create user
function getOrCreateUser($db, $telegramId, $userData = []) {
    $stmt = $db->prepare('SELECT * FROM users WHERE telegram_id = :telegram_id');
    $stmt->bindValue(':telegram_id', $telegramId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$user) {
        $stmt = $db->prepare('INSERT INTO users (telegram_id, first_name, last_name, username, balance) VALUES (:telegram_id, :first_name, :last_name, :username, 0)');
        $stmt->bindValue(':telegram_id', $telegramId, SQLITE3_INTEGER);
        $stmt->bindValue(':first_name', $userData['firstName'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':last_name', $userData['lastName'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':username', $userData['username'] ?? '', SQLITE3_TEXT);
        $stmt->execute();
        
        $stmt = $db->prepare('SELECT * FROM users WHERE telegram_id = :telegram_id');
        $stmt->bindValue(':telegram_id', $telegramId, SQLITE3_INTEGER);
        $result = $stmt->execute();
        $user = $result->fetchArray(SQLITE3_ASSOC);
    }
    
    return $user;
}

// Get request path
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$basePath = '/api';

// Route handling
$action = str_replace($basePath . '/', '', $requestUri);

switch ($action) {
    case 'balance':
        handleBalance($db);
        break;
    case 'subscription/create':
        handleSubscriptionCreate($db, $YOOKASSA_SHOP_ID, $YOOKASSA_SECRET_KEY);
        break;
    case 'subscription/pay':
        handleSubscriptionPay($db);
        break;
    case 'subscription/success':
        handleSubscriptionSuccess($db, $YOOKASSA_SHOP_ID, $YOOKASSA_SECRET_KEY);
        break;
    case 'payment/create':
        handlePaymentCreate($db, $YOOKASSA_SHOP_ID, $YOOKASSA_SECRET_KEY);
        break;
    case 'payment/success':
        handlePaymentSuccess($db, $YOOKASSA_SHOP_ID, $YOOKASSA_SECRET_KEY);
        break;
    case 'payment/webhook':
        handlePaymentWebhook($db);
        break;
    case 'profile':
        handleProfile($db);
        break;
    case 'cards':
        handleCards($db);
        break;
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
}

function handleBalance($db) {
    $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
    
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'userId required']);
        return;
    }
    
    $user = getOrCreateUser($db, $userId);
    
    echo json_encode([
        'balance' => number_format($user['balance'], 2, '.', ''),
        'subscriptionActive' => (bool)$user['subscription_active'],
        'subscriptionPlan' => $user['subscription_plan'],
        'subscriptionEnd' => $user['subscription_end'],
        'devicesCount' => $user['devices_count']
    ]);
}

function handleSubscriptionCreate($db, $shopId, $secretKey) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = $input['userId'] ?? 0;
    $plan = $input['plan'] ?? '';
    $amount = $input['amount'] ?? 0;
    $description = $input['description'] ?? 'Подписка';
    
    if (!$userId || !$plan || !$amount) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid parameters']);
        return;
    }
    
    $validPlans = ['telegram', 'full'];
    if (!in_array($plan, $validPlans)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid plan type']);
        return;
    }
    
    $user = getOrCreateUser($db, $userId);
    $paymentId = uniqid('pay_', true);
    
    $stmt = $db->prepare('INSERT INTO payments (id, user_id, amount, status, description, payment_type, subscription_plan) VALUES (:id, :user_id, :amount, :status, :description, :payment_type, :subscription_plan)');
    $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
    $stmt->bindValue(':user_id', $user['id'], SQLITE3_INTEGER);
    $stmt->bindValue(':amount', $amount, SQLITE3_FLOAT);
    $stmt->bindValue(':status', 'pending', SQLITE3_TEXT);
    $stmt->bindValue(':description', $description, SQLITE3_TEXT);
    $stmt->bindValue(':payment_type', 'subscription', SQLITE3_TEXT);
    $stmt->bindValue(':subscription_plan', $plan, SQLITE3_TEXT);
    $stmt->execute();
    
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $returnUrl = "{$protocol}://{$host}/api/subscription/success?paymentId={$paymentId}";
    
    $yookassaData = [
        'amount' => [
            'value' => number_format($amount, 2, '.', ''),
            'currency' => 'RUB'
        ],
        'confirmation' => [
            'type' => 'redirect',
            'return_url' => $returnUrl
        ],
        'capture' => true,
        'description' => "{$description} - {$plan} для пользователя {$userId}"
    ];
    
    $authString = base64_encode("{$shopId}:{$secretKey}");
    
    $ch = curl_init('https://api.yookassa.ru/v3/payments');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($yookassaData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Idempotence-Key: ' . $paymentId,
        'Authorization: Basic ' . $authString
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $paymentData = json_decode($response, true);
    
    if ($httpCode !== 200) {
        http_response_code(500);
        echo json_encode(['error' => $paymentData['description'] ?? 'YooKassa error']);
        return;
    }
    
    $stmt = $db->prepare('UPDATE payments SET yookassa_payment_id = :yookassa_id, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
    $stmt->bindValue(':yookassa_id', $paymentData['id'], SQLITE3_TEXT);
    $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode([
        'payment_id' => $paymentId,
        'confirmation_url' => $paymentData['confirmation']['confirmation_url'],
        'amount' => $amount,
        'plan' => $plan
    ]);
}

function handleSubscriptionSuccess($db, $shopId, $secretKey) {
    $paymentId = $_GET['paymentId'] ?? '';
    
    if (!$paymentId) {
        http_response_code(400);
        echo json_encode(['error' => 'paymentId required']);
        return;
    }
    
    $stmt = $db->prepare('SELECT * FROM payments WHERE id = :id');
    $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
    $result = $stmt->execute();
    $payment = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$payment) {
        http_response_code(404);
        echo json_encode(['error' => 'Payment not found']);
        return;
    }
    
    if ($payment['status'] === 'succeeded') {
        header('Location: /payment-success.html?paymentId=' . $paymentId . '&status=success&type=subscription');
        exit();
    }

    $authString = base64_encode("{$shopId}:{$secretKey}");

    $ch = curl_init("https://api.yookassa.ru/v3/payments/{$payment['yookassa_payment_id']}");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Basic ' . $authString
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $paymentData = json_decode($response, true);

    if ($paymentData['status'] === 'succeeded') {
        $subscriptionEnd = date('Y-m-d H:i:s', strtotime('+30 days'));

        $db->exec('BEGIN TRANSACTION');

        $stmt = $db->prepare('UPDATE payments SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
        $stmt->bindValue(':status', 'succeeded', SQLITE3_TEXT);
        $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
        $stmt->execute();

        $stmt = $db->prepare('UPDATE users SET subscription_active = 1, subscription_plan = :plan, subscription_end = :end, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id');
        $stmt->bindValue(':plan', $payment['subscription_plan'], SQLITE3_TEXT);
        $stmt->bindValue(':end', $subscriptionEnd, SQLITE3_TEXT);
        $stmt->bindValue(':user_id', $payment['user_id'], SQLITE3_INTEGER);
        $stmt->execute();

        $db->exec('COMMIT');

        header('Location: /payment-success.html?paymentId=' . $paymentId . '&status=success&type=subscription');
        exit();
    } else {
        header('Location: /payment-success.html?paymentId=' . $paymentId . '&status=pending&type=subscription');
        exit();
    }
}

function handleSubscriptionPay($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = $input['userId'] ?? 0;
    $plan = $input['plan'] ?? '';
    $amount = $input['amount'] ?? 0;
    
    if (!$userId || !$plan || !$amount) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid parameters']);
        return;
    }
    
    $validPlans = ['telegram', 'full'];
    if (!in_array($plan, $validPlans)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid plan type']);
        return;
    }
    
    $user = getOrCreateUser($db, $userId);
    
    // Проверяем баланс
    if ($user['balance'] < $amount) {
        http_response_code(400);
        echo json_encode(['error' => 'Недостаточно средств на балансе']);
        return;
    }
    
    // Списываем средства и активируем подписку
    $subscriptionEnd = date('Y-m-d H:i:s', strtotime('+30 days'));
    
    $db->exec('BEGIN TRANSACTION');
    
    // Создаём запись о платеже
    $paymentId = uniqid('pay_', true);
    $stmt = $db->prepare('INSERT INTO payments (id, user_id, amount, status, description, payment_type, subscription_plan) VALUES (:id, :user_id, :amount, :status, :description, :payment_type, :subscription_plan)');
    $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
    $stmt->bindValue(':user_id', $user['id'], SQLITE3_INTEGER);
    $stmt->bindValue(':amount', $amount, SQLITE3_FLOAT);
    $stmt->bindValue(':status', 'succeeded', SQLITE3_TEXT);
    $stmt->bindValue(':description', 'Подписка "' . $plan . '" (оплата с баланса)', SQLITE3_TEXT);
    $stmt->bindValue(':payment_type', 'subscription', SQLITE3_TEXT);
    $stmt->bindValue(':subscription_plan', $plan, SQLITE3_TEXT);
    $stmt->execute();
    
    // Списываем с баланса
    $stmt = $db->prepare('UPDATE users SET balance = balance - :amount, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id');
    $stmt->bindValue(':amount', $amount, SQLITE3_FLOAT);
    $stmt->bindValue(':user_id', $user['id'], SQLITE3_INTEGER);
    $stmt->execute();
    
    // Активируем подписку
    $stmt = $db->prepare('UPDATE users SET subscription_active = 1, subscription_plan = :plan, subscription_end = :end, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id');
    $stmt->bindValue(':plan', $plan, SQLITE3_TEXT);
    $stmt->bindValue(':end', $subscriptionEnd, SQLITE3_TEXT);
    $stmt->bindValue(':user_id', $user['id'], SQLITE3_INTEGER);
    $stmt->execute();
    
    $db->exec('COMMIT');
    
    echo json_encode([
        'success' => true,
        'message' => 'Подписка активирована',
        'plan' => $plan,
        'balance' => number_format($user['balance'] - $amount, 2, '.', '')
    ]);
}

function handlePaymentCreate($db, $shopId, $secretKey) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $userId = $input['userId'] ?? 0;
    $amount = $input['amount'] ?? 0;
    $description = $input['description'] ?? 'Пополнение баланса';
    
    if (!$userId || !$amount || $amount < 50) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid amount (min 50)']);
        return;
    }
    
    $user = getOrCreateUser($db, $userId);
    $paymentId = uniqid('pay_', true);
    
    $stmt = $db->prepare('INSERT INTO payments (id, user_id, amount, status, description) VALUES (:id, :user_id, :amount, :status, :description)');
    $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
    $stmt->bindValue(':user_id', $user['id'], SQLITE3_INTEGER);
    $stmt->bindValue(':amount', $amount, SQLITE3_FLOAT);
    $stmt->bindValue(':status', 'pending', SQLITE3_TEXT);
    $stmt->bindValue(':description', $description, SQLITE3_TEXT);
    $stmt->execute();
    
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $returnUrl = "{$protocol}://{$host}/api/payment/success?paymentId={$paymentId}";
    
    $yookassaData = [
        'amount' => [
            'value' => number_format($amount, 2, '.', ''),
            'currency' => 'RUB'
        ],
        'confirmation' => [
            'type' => 'redirect',
            'return_url' => $returnUrl
        ],
        'capture' => true,
        'description' => "{$description} для пользователя {$userId}"
    ];
    
    $authString = base64_encode("{$shopId}:{$secretKey}");
    
    $ch = curl_init('https://api.yookassa.ru/v3/payments');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($yookassaData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Idempotence-Key: ' . $paymentId,
        'Authorization: Basic ' . $authString
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $paymentData = json_decode($response, true);
    
    if ($httpCode !== 200) {
        http_response_code(500);
        echo json_encode(['error' => $paymentData['description'] ?? 'YooKassa error']);
        return;
    }
    
    $stmt = $db->prepare('UPDATE payments SET yookassa_payment_id = :yookassa_id, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
    $stmt->bindValue(':yookassa_id', $paymentData['id'], SQLITE3_TEXT);
    $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode([
        'payment_id' => $paymentId,
        'confirmation_url' => $paymentData['confirmation']['confirmation_url'],
        'amount' => $amount
    ]);
}

function handlePaymentSuccess($db, $shopId, $secretKey) {
    $paymentId = $_GET['paymentId'] ?? '';
    
    if (!$paymentId) {
        http_response_code(400);
        echo json_encode(['error' => 'paymentId required']);
        return;
    }
    
    $stmt = $db->prepare('SELECT * FROM payments WHERE id = :id');
    $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
    $result = $stmt->execute();
    $payment = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$payment) {
        http_response_code(404);
        echo json_encode(['error' => 'Payment not found']);
        return;
    }
    
    if ($payment['status'] === 'succeeded') {
        header('Location: /payment-success.html?paymentId=' . $paymentId . '&status=success');
        exit();
    }
    
    $authString = base64_encode("{$shopId}:{$secretKey}");
    
    $ch = curl_init("https://api.yookassa.ru/v3/payments/{$payment['yookassa_payment_id']}");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Basic ' . $authString
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $paymentData = json_decode($response, true);
    
    if ($paymentData['status'] === 'succeeded') {
        $db->exec('BEGIN TRANSACTION');
        
        $stmt = $db->prepare('UPDATE payments SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
        $stmt->bindValue(':status', 'succeeded', SQLITE3_TEXT);
        $stmt->bindValue(':id', $paymentId, SQLITE3_TEXT);
        $stmt->execute();
        
        $stmt = $db->prepare('UPDATE users SET balance = balance + :amount, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id');
        $stmt->bindValue(':amount', $payment['amount'], SQLITE3_FLOAT);
        $stmt->bindValue(':user_id', $payment['user_id'], SQLITE3_INTEGER);
        $stmt->execute();
        
        $db->exec('COMMIT');
        
        header('Location: /payment-success.html?paymentId=' . $paymentId . '&status=success');
        exit();
    } else {
        header('Location: /payment-success.html?paymentId=' . $paymentId . '&status=pending');
        exit();
    }
}

function handlePaymentWebhook($db) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input['event'] !== 'payment.succeeded') {
        echo json_encode(['ok' => true]);
        return;
    }
    
    $yookassaPaymentId = $input['object']['id'];
    
    $stmt = $db->prepare('SELECT * FROM payments WHERE yookassa_payment_id = :yookassa_id');
    $stmt->bindValue(':yookassa_id', $yookassaPaymentId, SQLITE3_TEXT);
    $result = $stmt->execute();
    $payment = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$payment || $payment['status'] === 'succeeded') {
        echo json_encode(['ok' => true]);
        return;
    }
    
    $db->exec('BEGIN TRANSACTION');
    
    $stmt = $db->prepare('UPDATE payments SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE yookassa_payment_id = :yookassa_id');
    $stmt->bindValue(':status', 'succeeded', SQLITE3_TEXT);
    $stmt->bindValue(':yookassa_id', $yookassaPaymentId, SQLITE3_TEXT);
    $stmt->execute();
    
    if ($payment['payment_type'] === 'subscription') {
        $subscriptionEnd = date('Y-m-d H:i:s', strtotime('+30 days'));
        
        $stmt = $db->prepare('UPDATE users SET subscription_active = 1, subscription_plan = :plan, subscription_end = :end, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id');
        $stmt->bindValue(':plan', $payment['subscription_plan'], SQLITE3_TEXT);
        $stmt->bindValue(':end', $subscriptionEnd, SQLITE3_TEXT);
        $stmt->bindValue(':user_id', $payment['user_id'], SQLITE3_INTEGER);
        $stmt->execute();
    } else {
        $stmt = $db->prepare('UPDATE users SET balance = balance + :amount, updated_at = CURRENT_TIMESTAMP WHERE id = :user_id');
        $stmt->bindValue(':amount', $payment['amount'], SQLITE3_FLOAT);
        $stmt->bindValue(':user_id', $payment['user_id'], SQLITE3_INTEGER);
        $stmt->execute();
    }
    
    $db->exec('COMMIT');
    
    echo json_encode(['ok' => true]);
}

function handleProfile($db) {
    $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
    
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'userId required']);
        return;
    }
    
    $user = getOrCreateUser($db, $userId);
    
    echo json_encode([
        'id' => $user['id'],
        'telegramId' => $user['telegram_id'],
        'firstName' => $user['first_name'],
        'lastName' => $user['last_name'],
        'username' => $user['username'],
        'balance' => number_format($user['balance'], 2, '.', ''),
        'subscriptionActive' => (bool)$user['subscription_active'],
        'devicesCount' => $user['devices_count'],
        'createdAt' => $user['created_at']
    ]);
}

function handleCards($db) {
    $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : 0;
    
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'userId required']);
        return;
    }
    
    $user = getOrCreateUser($db, $userId);
    $hasFullAccess = $user['subscription_active'] && $user['subscription_plan'] === 'full';
    
    $dataPath = __DIR__ . '/data.json';
    if (!file_exists($dataPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to load cards']);
        return;
    }
    
    $jsonData = json_decode(file_get_contents($dataPath), true);
    
    $filteredCards = array_filter($jsonData['cards'], function($card) use ($hasFullAccess) {
        if ($card['id'] === 'FlowStateProxy') return true;
        if ($card['id'] === 'FlowStateWG') return $hasFullAccess;
        return true;
    });
    
    echo json_encode([
        'cards' => array_values($filteredCards),
        'hasFullAccess' => $hasFullAccess,
        'subscriptionPlan' => $user['subscription_plan']
    ]);
}

$db->close();
