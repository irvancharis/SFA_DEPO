const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIG PATH & AES-256-GCM ENCRYPTION KEY ---
const configPath = path.join(__dirname, '../CONFIG/activation.json');
const SECRET_KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'SFA-SECRET-MACHINE-KEY-2026', 'sfa-salt', 32);

// Encrypt sensitive payload
function encryptPayload(dataObj) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);
    let encrypted = cipher.update(JSON.stringify(dataObj), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return { iv: iv.toString('hex'), authTag, content: encrypted };
}

// Decrypt sensitive payload
function decryptPayload(encryptedObj) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', SECRET_KEY, Buffer.from(encryptedObj.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
        let decrypted = decipher.update(encryptedObj.content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (err) {
        console.error('❌ Gagal mengdekripsi file config (Kunci Salah / File Diubah):', err.message);
        return null;
    }
}

function getActivationState() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const json = JSON.parse(data);
            if (json.encryptedPayload) {
                const decryptedData = decryptPayload(json.encryptedPayload);
                if (decryptedData) {
                    return {
                        status: json.status || 'pending',
                        ...decryptedData
                    };
                }
            }
            return json;
        }
    } catch (err) {
        console.error('Error reading activation config:', err);
    }
    return {
        status: 'pending',
        token: null,
        validDummyToken: 'SFA-TOKEN-DEPO01-2026',
        depoId: 'DEPO-SURABAYA-01',
        publicIp: '180.252.12.89',
        activatedAt: null,
        database: {
            host: process.env.DB_HOST || 'db',
            port: 5432,
            name: 'sfa_db',
            user: 'postgres',
            password: 'postgres'
        }
    };
}

function saveActivationState(state) {
    try {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Pisahkan status dan enkripsi SELURUH data sensitif (token, depoId, publicIp, database, activatedAt, validDummyToken)
        const sensitiveData = {
            token: state.token,
            validDummyToken: state.validDummyToken || 'SFA-TOKEN-DEPO01-2026',
            depoId: state.depoId || 'DEPO-SURABAYA-01',
            publicIp: state.publicIp || '180.252.12.89',
            activatedAt: state.activatedAt,
            database: state.database || {
                host: process.env.DB_HOST || 'db',
                port: 5432,
                name: 'sfa_db',
                user: 'postgres',
                password: 'postgres'
            }
        };

        const toSave = {
            status: state.status,
            encryptedPayload: encryptPayload(sensitiveData)
        };
        
        fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving activation config:', err);
    }
}

// --- DYNAMIC POSTGRESQL POOL FROM CONFIG ---
let currentPool = null;

function getDbPool() {
    const state = getActivationState();
    const dbConf = state.database || {};
    
    const host = process.env.DB_HOST || dbConf.host || 'db';
    const port = parseInt(dbConf.port || process.env.DB_PORT, 10) || 5432;
    const database = dbConf.name || process.env.DB_DATABASE || 'sfa_db';
    const user = dbConf.user || process.env.DB_USER || 'postgres';
    const password = dbConf.password || process.env.DB_PASSWORD || 'postgres';

    if (!currentPool) {
        currentPool = new Pool({ host, port, database, user, password });
        console.log(`🔌 Initialized PostgreSQL Pool from CONFIG -> ${user}@${host}:${port}/${database}`);
    }
    return currentPool;
}

function resetDbPool() {
    if (currentPool) {
        currentPool.end().catch(() => {});
        currentPool = null;
    }
}

// --- MIDDLEWARE CEK ACTIVATION TOKEN ---
app.use((req, res, next) => {
    const state = getActivationState();
    if (req.path === '/' || req.path === '/index.html') {
        if (state.status === 'connected') {
            return res.redirect('/dashboard.html');
        } else {
            return res.redirect('/activate.html');
        }
    }
    next();
});

// --- API TOKEN ACTIVATION & STATUS ---
app.get('/api/status', (req, res) => {
    const state = getActivationState();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || state.publicIp;
    res.json({
        status: state.status,
        depoId: state.depoId,
        publicIp: state.status === 'connected' ? state.publicIp : clientIp,
        activatedAt: state.activatedAt,
        validTokenHint: 'SFA-TOKEN-DEPO01-2026',
        databaseConfigured: !!state.database
    });
});

app.post('/api/activate', (req, res) => {
    const { token } = req.body;
    const state = getActivationState();

    if (!token) {
        return res.status(400).json({ success: false, message: 'Token tidak boleh kosong!' });
    }

    if (token.toUpperCase().trim() === state.validDummyToken) {
        state.status = 'connected';
        state.token = token;
        state.activatedAt = new Date().toISOString();

        // SIMULASI KONFIGURASI DATABASE PUSAT SAAT TOKENS VALID
        state.database = {
            host: process.env.DB_HOST || 'db',
            port: 5432,
            name: 'sfa_db',
            user: 'postgres',
            password: 'postgres'
        };

        saveActivationState(state);
        resetDbPool(); // Refresh koneksi DB dengan config baru dari pusat

        console.log(`✅ [ACTIVATION SUCCESS] Depo ${state.depoId} Terkunci di IP ${state.publicIp} & DB Configured from HQ!`);
        return res.json({
            success: true,
            message: 'Aktivasi berhasil! Konfigurasi database & user/password dari pusat telah diterapkan.',
            data: state
        });
    } else {
        return res.status(401).json({
            success: false,
            message: 'Token tidak valid! Gunakan token: SFA-TOKEN-DEPO01-2026'
        });
    }
});

app.post('/api/reset', (req, res) => {
    const state = getActivationState();
    state.status = 'pending';
    state.token = null;
    state.activatedAt = null;

    saveActivationState(state);
    resetDbPool();

    console.log('🔒 [ACTIVATION RESET] Token dikembalikan ke status Pending.');
    res.json({ success: true, message: 'Token berhasil di-reset ke status pending.' });
});

// --- API BUSINESS ENDPOINTS (POSTGRESQL DATA VIA CONFIG POOL) ---
app.get('/api/produk', async (req, res) => {
    try {
        const pool = getDbPool();
        const result = await pool.query('SELECT * FROM master_sfa_produk LIMIT 50');
        res.json({ count: result.rowCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pelanggan', async (req, res) => {
    try {
        const pool = getDbPool();
        const result = await pool.query('SELECT * FROM master_pelanggan LIMIT 50');
        res.json({ count: result.rowCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/penjualan', async (req, res) => {
    try {
        const pool = getDbPool();
        const result = await pool.query('SELECT * FROM sfa_penjualan ORDER BY tanggal DESC LIMIT 50');
        res.json({ count: result.rowCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Auto Retry PostgreSQL Connection
async function testDbConnection(retries = 30) {
    while (retries > 0) {
        try {
            const pool = getDbPool();
            const client = await pool.connect();
            console.log('✅ Connected to PostgreSQL Database via Config!');
            client.release();
            return;
        } catch (err) {
            console.log(`⚠️ Database PostgreSQL belum siap (${err.message}). Retries remaining: ${retries}`);
            resetDbPool();
            retries--;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

app.listen(PORT, () => {
    console.log(`🚀 SFA Depo Engine Server running at http://0.0.0.0:${PORT}`);
    testDbConnection();
});
