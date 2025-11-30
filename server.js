// ========================================
// OPTION 1: Node.js with Express
// ========================================

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

// Log all incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Store for pending payments (in production, use a database)
const payments = [];

// Webhook endpoint to receive M-Pesa notifications
app.post('/mpesa-webhook', (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] === INCOMING REQUEST ===`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('Raw body:', req.body);

    const { raw_message, amount, phone, transaction_code, timestamp: paymentTimestamp } = req.body;

    // Extract name from raw message
    let senderName = 'unknown';
    if (raw_message) {
        const nameMatch = raw_message.match(/from ([A-Za-z\s]+)\s+\d{10}/);
        if (nameMatch) {
            senderName = nameMatch[1].trim();
        }
    }

    // Check if it's a test message
    if (req.body.test === 'true') {
        const testResponse = { status: 'success', message: 'Test received' };
        console.log('Test message received successfully!');
        console.log(`[${new Date().toISOString()}] === TEST RESPONSE ===`);
        console.log('Response:', JSON.stringify(testResponse, null, 2));
        return res.json(testResponse);
    }

    // Handle SMS fragments (incomplete messages)
    if (!amount || !transaction_code) {
        console.log('SMS fragment received (incomplete data) - ignoring');
        return res.json({ status: 'ignored', message: 'SMS fragment' });
    }

    // Store payment
    const payment = {
        id: Date.now(),
        amount: parseFloat(amount),
        phone: phone || 'unknown',
        sender_name: senderName,
        transaction_code,
        raw_message,
        timestamp: paymentTimestamp || Date.now(),
        processed: false
    };

    console.log(`💰 Payment from: ${senderName} (${phone}) - Ksh${amount} - ${transaction_code}`);

    payments.push(payment);

    // Log to file
    fs.appendFileSync('payments.log', JSON.stringify(payment) + '\n');

    // Process payment (unlock music)
    processPayment(payment);

    const response = { status: 'success', payment_id: payment.id };
    console.log(`[${new Date().toISOString()}] === OUTGOING RESPONSE ===`);
    console.log('Response:', JSON.stringify(response, null, 2));
    res.json(response);
});

// Function to process payment and unlock music
function processPayment(payment) {
    console.log(`Processing payment: ${payment.transaction_code}`);

    // Example: If payment is 100 KES, unlock specific music
    if (payment.amount === 100) {
        unlockMusic(payment.phone, 'song_id_123');
    } else if (payment.amount === 200) {
        unlockMusic(payment.phone, 'album_id_456');
    }

    payment.processed = true;
}

// Function to unlock music for a user
function unlockMusic(phone, musicId) {
    console.log(`Unlocking music ${musicId} for ${phone}`);

    // Your logic here:
    // 1. Update database to give user access
    // 2. Send email/SMS with download link
    // 3. Generate temporary access token
    // 4. Update user's account

    // Example database update (pseudo-code):
    // db.query('INSERT INTO user_access (phone, music_id, expires) VALUES (?, ?, ?)', 
    //          [phone, musicId, Date.now() + 30*24*60*60*1000]);

    console.log(`✓ Music unlocked successfully for ${phone}`);
}

// Endpoint to check payment status
app.get('/check-payment/:transaction_code', (req, res) => {
    const payment = payments.find(p => p.transaction_code === req.params.transaction_code);

    if (payment) {
        res.json({
            status: 'found',
            processed: payment.processed,
            amount: payment.amount
        });
    } else {
        res.json({ status: 'not_found' });
    }
});

// Endpoint to list all payments (for testing)
app.get('/payments', (req, res) => {
    res.json({ total: payments.length, payments });
});

// Catch-all route for debugging
app.use((req, res) => {
    console.log(`[${new Date().toISOString()}] === UNHANDLED REQUEST ===`);
    console.log(`${req.method} ${req.path}`);
    res.status(404).json({ error: 'Endpoint not found', available_endpoints: ['/mpesa-webhook', '/payments', '/check-payment/:code'] });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`M-Pesa webhook server running on port ${PORT}`);
    console.log(`Webhook URL: http://your-server.com:${PORT}/mpesa-webhook`);
});