// ========================================
// OPTION 1: Node.js with Express
// ========================================

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// User points storage
const userPoints = [];
const artifacts = [
    { id: 1, name: 'Golden Shirt', cost: 20, image: '👕' },
    { id: 2, name: 'Silver Pants', cost: 30, image: '👖' },
    { id: 3, name: 'Diamond Hat', cost: 50, image: '🎩' },
    { id: 4, name: 'Ruby Shoes', cost: 40, image: '👠' }
];

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

// Claim points endpoint
app.post('/claim-points', (req, res) => {
    const { transaction_code } = req.body;
    
    const payment = payments.find(p => p.transaction_code === transaction_code);
    if (!payment) {
        return res.json({ success: false, message: 'Transaction not found' });
    }
    
    // Check if already claimed
    const existingUser = userPoints.find(u => u.transaction_code === transaction_code);
    if (existingUser) {
        return res.json({ success: false, message: 'Points already claimed for this transaction' });
    }
    
    // Calculate points (1 point = 0.5 KSH)
    const points = Math.floor(payment.amount * 2);
    
    const user = {
        transaction_code,
        phone: payment.phone,
        sender_name: payment.sender_name,
        points,
        claimed_at: new Date().toISOString(),
        artifacts_unlocked: []
    };
    
    userPoints.push(user);
    fs.appendFileSync('user_points.log', JSON.stringify(user) + '\n');
    
    console.log(`✨ Points claimed: ${points} points for ${payment.sender_name}`);
    res.json({ success: true, points, user });
});

// Unlock artifact endpoint
app.post('/unlock-artifact', (req, res) => {
    const { transaction_code, artifact_id } = req.body;
    
    const user = userPoints.find(u => u.transaction_code === transaction_code);
    if (!user) {
        return res.json({ success: false, message: 'User not found. Claim points first.' });
    }
    
    const artifact = artifacts.find(a => a.id === parseInt(artifact_id));
    if (!artifact) {
        return res.json({ success: false, message: 'Artifact not found' });
    }
    
    if (user.points < artifact.cost) {
        return res.json({ success: false, message: `Not enough points. Need ${artifact.cost}, have ${user.points}` });
    }
    
    // Check if already unlocked
    if (user.artifacts_unlocked.includes(artifact_id)) {
        return res.json({ success: false, message: 'Artifact already unlocked' });
    }
    
    user.points -= artifact.cost;
    user.artifacts_unlocked.push(artifact_id);
    
    console.log(`🎁 Artifact unlocked: ${artifact.name} by ${user.sender_name}`);
    res.json({ success: true, artifact, remaining_points: user.points });
});

// Get user status
app.get('/user-status/:transaction_code', (req, res) => {
    const user = userPoints.find(u => u.transaction_code === req.params.transaction_code);
    if (!user) {
        return res.json({ found: false });
    }
    
    const unlockedArtifacts = artifacts.filter(a => user.artifacts_unlocked.includes(a.id.toString()));
    res.json({ found: true, user, unlocked_artifacts: unlockedArtifacts });
});

// Get available artifacts
app.get('/artifacts', (req, res) => {
    res.json(artifacts);
});

// Test webhook endpoint
app.post('/test-webhook', (req, res) => {
    console.log('🧪 Test webhook called:', req.body);
    res.json({ status: 'test received', timestamp: new Date().toISOString() });
});

// Get recent payments for debugging
app.get('/recent-payments', (req, res) => {
    const recent = payments.slice(-10).map(p => ({
        transaction_code: p.transaction_code,
        amount: p.amount,
        sender_name: p.sender_name,
        phone: p.phone,
        timestamp: new Date(p.timestamp).toLocaleString()
    }));
    res.json({ total: payments.length, recent });
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