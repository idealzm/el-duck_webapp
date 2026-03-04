const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3000;

// YooKassa credentials (test)
const YOOKASSA_SHOP_ID = '1293384';
const YOOKASSA_SECRET_KEY = 'test_RuhTK6Gu2CTA-1m_wiLd6rC9pNGfgLncVzgi_0NpaJMç';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize database
const db = new sqlite3.Database('database.db');

// Create tables
db.serialize(() => {
    db.run(`
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
    `);

    db.run(`
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
    `);
});

// Helper: Get or create user
function getOrCreateUser(telegramId, userData = {}, callback) {
    db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
        if (err) {
            callback(err, null);
            return;
        }
        
        if (!user) {
            db.run(
                'INSERT INTO users (telegram_id, first_name, last_name, username, balance) VALUES (?, ?, ?, ?, 0)',
                [telegramId, userData.firstName, userData.lastName, userData.username],
                function(err) {
                    if (err) {
                        callback(err, null);
                        return;
                    }
                    db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], callback);
                }
            );
        } else {
            callback(null, user);
        }
    });
}

// API Routes

// Get user balance
app.get('/api/balance', (req, res) => {
    const userId = parseInt(req.query.userId);

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    getOrCreateUser(userId, {}, (err, user) => {
        if (err) {
            console.error('Balance error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        res.json({
            balance: user.balance.toFixed(2),
            subscriptionActive: !!user.subscription_active,
            subscriptionPlan: user.subscription_plan,
            subscriptionEnd: user.subscription_end,
            devicesCount: user.devices_count
        });
    });
});

// Create subscription payment
app.post('/api/subscription/create', async (req, res) => {
    try {
        const { userId, plan, amount, description } = req.body;

        if (!userId || !plan || !amount) {
            return res.status(400).json({ error: 'Invalid parameters' });
        }

        const validPlans = ['telegram', 'full'];
        if (!validPlans.includes(plan)) {
            return res.status(400).json({ error: 'Invalid plan type' });
        }

        // Get or create user
        getOrCreateUser(userId, {}, (err, user) => {
            if (err) {
                console.error('User error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            // Create payment record
            const paymentId = uuidv4();

            db.run(
                'INSERT INTO payments (id, user_id, amount, status, description, payment_type, subscription_plan) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [paymentId, user.id, amount, 'pending', description || 'Подписка', 'subscription', plan],
                async (err) => {
                    if (err) {
                        console.error('Subscription DB error:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    // Create YooKassa payment
                    const yookassaData = {
                        amount: {
                            value: amount.toFixed(2),
                            currency: 'RUB'
                        },
                        confirmation: {
                            type: 'redirect',
                            return_url: `${req.protocol}://${req.get('host')}/api/subscription/success?paymentId=${paymentId}`
                        },
                        capture: true,
                        description: description || `Подписка ${plan} для пользователя ${userId}`
                    };

                    const authString = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

                    try {
                        const response = await fetch('https://api.yookassa.ru/v3/payments', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Idempotence-Key': paymentId,
                                'Authorization': `Basic ${authString}`
                            },
                            body: JSON.stringify(yookassaData)
                        });

                        const paymentData = await response.json();

                        if (!response.ok) {
                            console.error('YooKassa error:', paymentData);
                            return res.status(500).json({ error: paymentData.description || 'YooKassa error' });
                        }

                        // Update payment with YooKassa ID
                        db.run(
                            'UPDATE payments SET yookassa_payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [paymentData.id, paymentId],
                            (err) => {
                                if (err) console.error('Update payment error:', err);
                            }
                        );

                        res.json({
                            payment_id: paymentId,
                            confirmation_url: paymentData.confirmation.confirmation_url,
                            amount: amount,
                            plan: plan
                        });
                    } catch (error) {
                        console.error('Subscription creation error:', error);
                        res.status(500).json({ error: 'Internal server error' });
                    }
                }
            );
        });

    } catch (error) {
        console.error('Subscription creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Subscription success callback
app.get('/api/subscription/success', async (req, res) => {
    try {
        const { paymentId } = req.query;

        if (!paymentId) {
            return res.status(400).json({ error: 'paymentId required' });
        }

        db.get('SELECT * FROM payments WHERE id = ?', [paymentId], async (err, payment) => {
            if (err) {
                console.error('Payment lookup error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (payment.status === 'succeeded') {
                return res.json({ success: true, message: 'Subscription already active' });
            }

            // Check payment status with YooKassa
            const authString = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

            try {
                const response = await fetch(`https://api.yookassa.ru/v3/payments/${payment.yookassa_payment_id}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${authString}`
                    }
                });

                const paymentData = await response.json();

                if (paymentData.status === 'succeeded') {
                    // Activate subscription (30 days)
                    const subscriptionEnd = new Date();
                    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');

                        db.run(
                            'UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            ['succeeded', paymentId],
                            (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    console.error('Update payment status error:', err);
                                    return;
                                }

                                db.run(
                                    `UPDATE users SET subscription_active = 1, subscription_plan = ?, subscription_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                                    [payment.subscription_plan, subscriptionEnd.toISOString(), payment.user_id],
                                    (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            console.error('Update subscription error:', err);
                                            return;
                                        }

                                        db.run('COMMIT', (err) => {
                                            if (err) {
                                                console.error('Commit error:', err);
                                                return;
                                            }
                                            console.log(`Subscription ${paymentId} activated for user ${payment.user_id}`);
                                        });
                                    }
                                );
                            }
                        );
                    });

                    res.json({ success: true, message: 'Subscription activated', plan: payment.subscription_plan });
                } else {
                    res.json({ success: false, message: 'Payment not completed', status: paymentData.status });
                }
            } catch (error) {
                console.error('YooKassa status check error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

    } catch (error) {
        console.error('Subscription success error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create YooKassa payment
app.post('/api/payment/create', async (req, res) => {
    try {
        const { userId, amount, description } = req.body;
        
        if (!userId || !amount || amount < 50) {
            return res.status(400).json({ error: 'Invalid amount (min 50)' });
        }
        
        // Get or create user
        getOrCreateUser(userId, {}, (err, user) => {
            if (err) {
                console.error('User error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            
            // Create payment record
            const paymentId = uuidv4();
            
            db.run(
                'INSERT INTO payments (id, user_id, amount, status, description) VALUES (?, ?, ?, ?, ?)',
                [paymentId, user.id, amount, 'pending', description || 'Пополнение баланса'],
                async (err) => {
                    if (err) {
                        console.error('Payment DB error:', err);
                        return res.status(500).json({ error: 'Internal server error' });
                    }
                    
                    // Create YooKassa payment
                    const yookassaData = {
                        amount: {
                            value: amount.toFixed(2),
                            currency: 'RUB'
                        },
                        confirmation: {
                            type: 'redirect',
                            return_url: `${req.protocol}://${req.get('host')}/api/payment/success?paymentId=${paymentId}`
                        },
                        capture: true,
                        description: description || `Пополнение баланса для пользователя ${userId}`
                    };

                    const authString = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

                    try {
                        const response = await fetch('https://api.yookassa.ru/v3/payments', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Idempotence-Key': paymentId,
                                'Authorization': `Basic ${authString}`
                            },
                            body: JSON.stringify(yookassaData)
                        });
                        
                        const paymentData = await response.json();
                        
                        if (!response.ok) {
                            console.error('YooKassa error:', paymentData);
                            return res.status(500).json({ error: paymentData.description || 'YooKassa error' });
                        }
                        
                        // Update payment with YooKassa ID
                        db.run(
                            'UPDATE payments SET yookassa_payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [paymentData.id, paymentId],
                            (err) => {
                                if (err) console.error('Update payment error:', err);
                            }
                        );
                        
                        res.json({
                            payment_id: paymentId,
                            confirmation_url: paymentData.confirmation.confirmation_url,
                            amount: amount
                        });
                    } catch (error) {
                        console.error('Payment creation error:', error);
                        res.status(500).json({ error: 'Internal server error' });
                    }
                }
            );
        });
        
    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Payment success callback
app.get('/api/payment/success', async (req, res) => {
    try {
        const { paymentId } = req.query;

        if (!paymentId) {
            return res.status(400).json({ error: 'paymentId required' });
        }

        db.get('SELECT * FROM payments WHERE id = ?', [paymentId], async (err, payment) => {
            if (err) {
                console.error('Payment lookup error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }

            if (payment.status === 'succeeded') {
                // Redirect to success page
                return res.redirect(`/payment-success.html?paymentId=${paymentId}&status=success`);
            }

            // Check payment status with YooKassa
            const authString = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

            try {
                const response = await fetch(`https://api.yookassa.ru/v3/payments/${payment.yookassa_payment_id}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${authString}`
                    }
                });
                
                const paymentData = await response.json();
                
                if (paymentData.status === 'succeeded') {
                    // Update payment status and user balance in transaction
                    db.serialize(() => {
                        db.run('BEGIN TRANSACTION');
                        
                        db.run(
                            'UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            ['succeeded', paymentId],
                            (err) => {
                                if (err) {
                                    db.run('ROLLBACK');
                                    console.error('Update payment status error:', err);
                                    return;
                                }
                                
                                db.run(
                                    'UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                    [payment.amount, payment.user_id],
                                    (err) => {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            console.error('Update balance error:', err);
                                            return;
                                        }
                                        
                                        db.run('COMMIT', (err) => {
                                            if (err) {
                                                console.error('Commit error:', err);
                                                return;
                                            }
                                            console.log(`Payment ${paymentId} succeeded, balance updated`);
                                        });
                                    }
                                );
                            }
                        );
                    });
                    
                    res.redirect(`/payment-success.html?paymentId=${paymentId}&status=success`);
                } else {
                    res.redirect(`/payment-success.html?paymentId=${paymentId}&status=pending`);
                }
            } catch (error) {
                console.error('YooKassa status check error:', error);
                res.redirect(`/payment-success.html?paymentId=${paymentId}&status=error`);
            }
        });

    } catch (error) {
        console.error('Payment success error:', error);
        res.redirect(`/payment-success.html?paymentId=${paymentId}&status=error`);
    }
});

// YooKassa webhook notification
app.post('/api/payment/webhook', async (req, res) => {
    try {
        const notification = req.body;
        console.log('YooKassa webhook:', notification);

        if (notification.event !== 'payment.succeeded') {
            return res.status(200).json({ ok: true });
        }

        const paymentId = notification.object.id;

        db.get('SELECT * FROM payments WHERE yookassa_payment_id = ?', [paymentId], async (err, payment) => {
            if (err) {
                console.error('Webhook lookup error:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (!payment || payment.status === 'succeeded') {
                return res.status(200).json({ ok: true });
            }

            // Update payment status
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                db.run(
                    'UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE yookassa_payment_id = ?',
                    ['succeeded', paymentId],
                    (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('Webhook update payment error:', err);
                            return;
                        }

                        if (payment.payment_type === 'subscription') {
                            // Activate subscription (30 days)
                            const subscriptionEnd = new Date();
                            subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

                            db.run(
                                `UPDATE users SET subscription_active = 1, subscription_plan = ?, subscription_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                                [payment.subscription_plan, subscriptionEnd.toISOString(), payment.user_id],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        console.error('Webhook update subscription error:', err);
                                        return;
                                    }

                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Webhook commit error:', err);
                                            return;
                                        }
                                        console.log(`Webhook: Subscription ${paymentId} activated for user ${payment.user_id}`);
                                    });
                                }
                            );
                        } else {
                            // Top up balance
                            db.run(
                                'UPDATE users SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                [payment.amount, payment.user_id],
                                (err) => {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        console.error('Webhook update balance error:', err);
                                        return;
                                    }

                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Webhook commit error:', err);
                                            return;
                                        }
                                        console.log(`Webhook: Payment ${paymentId} succeeded, balance updated`);
                                    });
                                }
                            );
                        }
                    }
                );
            });

            res.status(200).json({ ok: true });

        });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile
app.get('/api/profile', (req, res) => {
    const userId = parseInt(req.query.userId);
    
    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }
    
    getOrCreateUser(userId, {}, (err, user) => {
        if (err) {
            console.error('Profile error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        res.json({
            id: user.id,
            telegramId: user.telegram_id,
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.username,
            balance: user.balance.toFixed(2),
            subscriptionActive: !!user.subscription_active,
            devicesCount: user.devices_count,
            createdAt: user.created_at
        });
    });
});

// Get VPN cards (with subscription check)
app.get('/api/cards', (req, res) => {
    const userId = parseInt(req.query.userId);

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    getOrCreateUser(userId, {}, (err, user) => {
        if (err) {
            console.error('Cards error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        // Check if user has full subscription
        const hasFullAccess = user.subscription_active && user.subscription_plan === 'full';

        // Load cards from file
        const fs = require('fs');
        const path = require('path');

        fs.readFile(path.join(__dirname, 'data.json'), 'utf8', (err, data) => {
            if (err) {
                console.error('Read data.json error:', err);
                return res.status(500).json({ error: 'Failed to load cards' });
            }

            try {
                const jsonData = JSON.parse(data);

                // Filter cards based on subscription
                const filteredCards = jsonData.cards.filter(card => {
                    // Telegram Proxy is always available
                    if (card.id === 'FlowStateProxy') return true;

                    // VPN cards require full subscription
                    if (card.id === 'FlowStateWG') return hasFullAccess;

                    return true;
                });

                res.json({
                    cards: filteredCards,
                    hasFullAccess: hasFullAccess,
                    subscriptionPlan: user.subscription_plan
                });
            } catch (parseError) {
                console.error('Parse data.json error:', parseError);
                res.status(500).json({ error: 'Invalid data format' });
            }
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`💰 YooKassa ShopID: ${YOOKASSA_SHOP_ID}`);
    console.log(`📊 Database: database.db`);
});
