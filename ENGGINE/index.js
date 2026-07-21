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
const configPath = path.join(__dirname, '../CONFIG/pusat_config.json');
const SECRET_KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'SFA-SECRET-PUSAT-KEY-2026', 'sfa-salt-pusat', 32);

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
        console.error('❌ Gagal mengdekripsi file config Pusat:', err.message);
        return null;
    }
}

// Initial Default Registered Depos
const defaultDepos = [
    {
        depoId: 'DEPO-SURABAYA-01',
        name: 'Depo Surabaya Central',
        token: 'SFA-TOKEN-DEPO01-2026',
        status: 'connected',
        publicIp: '180.252.12.89',
        activatedAt: new Date().toISOString(),
        lastPing: new Date().toISOString()
    },
    {
        depoId: 'DEPO-JAKARTA-01',
        name: 'Depo Jakarta Barat',
        token: 'SFA-TOKEN-DEPO02-2026',
        status: 'pending',
        publicIp: '-',
        activatedAt: null,
        lastPing: null
    }
];

function getPusatConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const json = JSON.parse(data);
            if (json.encryptedPayload) {
                const decryptedData = decryptPayload(json.encryptedPayload);
                if (decryptedData) {
                    return decryptedData;
                }
            }
            return json;
        }
    } catch (err) {
        console.error('Error reading Pusat config:', err);
    }
    const initialConfig = {
        serverName: 'SFA PUSAT HQ',
        version: '2.0.0',
        depos: defaultDepos,
        database: {
            host: process.env.DB_HOST || 'db',
            port: 5432,
            name: 'sfa_db',
            user: 'postgres',
            password: 'postgres'
        }
    };
    savePusatConfig(initialConfig);
    return initialConfig;
}

function savePusatConfig(configObj) {
    try {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const toSave = {
            updatedAt: new Date().toISOString(),
            encryptedPayload: encryptPayload(configObj)
        };
        fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving Pusat config:', err);
    }
}

// --- DYNAMIC POSTGRESQL POOL ---
let currentPool = null;

function getDbPool() {
    const config = getPusatConfig();
    const dbConf = config.database || {};
    
    const host = process.env.DB_HOST || dbConf.host || 'db';
    const port = parseInt(dbConf.port || process.env.DB_PORT, 10) || 5432;
    const database = dbConf.name || process.env.DB_DATABASE || 'sfa_db';
    const user = dbConf.user || process.env.DB_USER || 'postgres';
    const password = dbConf.password || process.env.DB_PASSWORD || 'postgres';

    if (!currentPool) {
        currentPool = new Pool({ host, port, database, user, password });
        console.log(`🔌 Initialized HQ PostgreSQL Pool -> ${user}@${host}:${port}/${database}`);
    }
    return currentPool;
}

function resetDbPool() {
    if (currentPool) {
        currentPool.end().catch(() => {});
        currentPool = null;
    }
}

// Redirect Root to Dashboard Pusat
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        return res.redirect('/dashboard.html');
    }
    next();
});

// --- API STATUS SFA PUSAT ---
app.get('/api/status', (req, res) => {
    const config = getPusatConfig();
    const activeDepos = config.depos.filter(d => d.status === 'connected').length;
    res.json({
        server: config.serverName,
        status: 'online',
        totalDepos: config.depos.length,
        activeDepos,
        timestamp: new Date().toISOString()
    });
});

// --- API UNTUK SFA DEPO (VERIFIKASI & PING KONEKSI DEPO) ---
app.post('/api/pusat/verify-token', (req, res) => {
    const { token, depoId } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!token) {
        return res.status(400).json({ success: false, message: 'Token activation wajib dikirim!' });
    }

    const config = getPusatConfig();
    const targetDepoIndex = config.depos.findIndex(
        d => d.token && d.token.toUpperCase().trim() === token.toUpperCase().trim()
    );

    if (targetDepoIndex !== -1) {
        const depo = config.depos[targetDepoIndex];

        if (depo.status === 'blocked') {
            return res.status(403).json({
                success: false,
                message: `Depo ${depo.depoId} sedang DIBLOKIR oleh SFA PUSAT.`
            });
        }

        // Update status & IP Depo
        depo.status = 'connected';
        depo.publicIp = clientIp;
        depo.activatedAt = depo.activatedAt || new Date().toISOString();
        depo.lastPing = new Date().toISOString();

        savePusatConfig(config);

        console.log(`✅ [DEPO CONNECTED] Depo ${depo.depoId} terverifikasi dari IP ${clientIp}`);

        return res.json({
            success: true,
            message: 'Aktivasi/Koneksi Depo ke SFA PUSAT Berhasil!',
            depoId: depo.depoId,
            name: depo.name,
            status: depo.status,
            publicIp: depo.publicIp,
            dbConfig: config.database
        });
    }

    return res.status(401).json({
        success: false,
        message: 'Token Aktivasi Depo tidak terdaftar di SFA PUSAT!'
    });
});

app.post('/api/pusat/ping', (req, res) => {
    const { depoId, token } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const config = getPusatConfig();
    const depo = config.depos.find(d => d.depoId === depoId && d.token === token);

    if (depo) {
        if (depo.status === 'blocked') {
            return res.status(403).json({ success: false, message: 'Depo Diblokir' });
        }
        depo.lastPing = new Date().toISOString();
        depo.publicIp = clientIp;
        savePusatConfig(config);
        return res.json({ success: true, status: depo.status });
    }
    res.status(404).json({ success: false, message: 'Depo tidak terdaftar' });
});

app.post('/api/pusat/disconnect', (req, res) => {
    const { depoId, token } = req.body;
    const config = getPusatConfig();
    const depo = config.depos.find(
        d => (depoId && d.depoId.toUpperCase() === depoId.toUpperCase()) || 
             (token && d.token && d.token.toUpperCase().trim() === token.toUpperCase().trim())
    );

    if (depo) {
        if (depo.status !== 'blocked') {
            depo.status = 'pending';
        }
        savePusatConfig(config);
        console.log(`🔌 [DEPO DISCONNECTED] Depo ${depo.depoId} dikembalikan ke status Pending.`);
        return res.json({ success: true, message: `Status Depo ${depo.depoId} berhasil dikembalikan ke Pending.` });
    }
    res.status(404).json({ success: false, message: 'Depo tidak ditemukan.' });
});

// --- API MANAGEMENT DEPO DI PUSAT (HQ DASHBOARD) ---
app.get('/api/pusat/depos', (req, res) => {
    const config = getPusatConfig();
    res.json({ success: true, depos: config.depos });
});

app.post('/api/pusat/generate-token', (req, res) => {
    const { depoId, name } = req.body;
    if (!depoId) {
        return res.status(400).json({ success: false, message: 'ID Depo wajib diisi!' });
    }

    const config = getPusatConfig();
    const exists = config.depos.find(d => d.depoId.toUpperCase() === depoId.toUpperCase());
    if (exists) {
        return res.status(400).json({ success: false, message: 'ID Depo sudah terdaftar!' });
    }

    // Cryptographically secure 96-bit high-entropy token format: SFA-KEY-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
    const randomBlocks = crypto.randomBytes(12).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
    const newToken = `SFA-KEY-${randomBlocks}`;
    const newDepo = {
        depoId: depoId.toUpperCase(),
        name: name || `Depo ${depoId}`,
        token: newToken,
        status: 'pending',
        publicIp: '-',
        activatedAt: null,
        lastPing: null
    };

    config.depos.push(newDepo);
    savePusatConfig(config);

    console.log(`🔑 [TOKEN GENERATED] Token baru dibuat untuk ${depoId}: ${newToken}`);
    res.json({ success: true, message: 'Token Depo berhasil dibuat!', data: newDepo });
});

app.post('/api/pusat/depo/control', (req, res) => {
    const { depoId, action } = req.body; // action: 'block' | 'activate' | 'delete'
    const config = getPusatConfig();
    const index = config.depos.findIndex(d => d.depoId === depoId);

    if (index === -1) {
        return res.status(404).json({ success: false, message: 'Depo tidak ditemukan' });
    }

    if (action === 'block') {
        config.depos[index].status = 'blocked';
    } else if (action === 'activate') {
        config.depos[index].status = 'connected';
    } else if (action === 'delete') {
        config.depos.splice(index, 1);
    }

    savePusatConfig(config);
    res.json({ success: true, message: `Berhasil mengubah status Depo ${depoId}` });
});

// --- API DATA PENJUALAN CENTRAL ---
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
        const countRes = await pool.query('SELECT COUNT(*) FROM sfa_penjualan');
        const totalCount = parseInt(countRes.rows[0].count, 10);

        const result = await pool.query('SELECT * FROM sfa_penjualan ORDER BY tanggal DESC LIMIT 50');
        res.json({ total: totalCount, count: totalCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API RECEIVER SINKRONISASI REALTIME DEPO ---
app.post('/api/pusat/sync-penjualan', async (req, res) => {
    const { depoId, token, items } = req.body;
    const config = getPusatConfig();
    const depo = config.depos.find(d => (depoId && d.depoId.toUpperCase() === depoId.toUpperCase()) || (token && d.token === token));
    
    if (!depo || depo.status === 'blocked') {
        return res.status(403).json({ success: false, message: 'Depo tidak terdaftar atau diblokir.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Data transaksi kosong.' });
    }

    try {
        const pool = getDbPool();
        let syncedCount = 0;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const item of items) {
                await client.query(
                    `INSERT INTO sfa_penjualan (uuid, notransaksi, tanggal, idsales, idpelanggan, grand_total)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (uuid, notransaksi) DO UPDATE SET
                     tanggal = EXCLUDED.tanggal,
                     idsales = EXCLUDED.idsales,
                     idpelanggan = EXCLUDED.idpelanggan,
                     grand_total = EXCLUDED.grand_total`,
                    [item.uuid || crypto.randomUUID(), item.notransaksi, item.tanggal || new Date(), item.idsales || 1, item.idpelanggan || 'CUST-GENERAL', item.grand_total || 0]
                );
                syncedCount++;
            }
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        console.log(`⚡ [REALTIME SYNC HQ] Berhasil menerima ${syncedCount} transaksi dari ${depo.depoId}`);
        res.json({ success: true, count: syncedCount, message: `${syncedCount} Transaksi berhasil disinkronkan ke HQ Pusat.` });
    } catch (err) {
        console.error('❌ Error saving sync data at HQ:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Auto Connection PostgreSQL
async function testDbConnection(retries = 30) {
    while (retries > 0) {
        try {
            const pool = getDbPool();
            const client = await pool.connect();
            console.log('✅ SFA PUSAT connected to PostgreSQL Central Database!');
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
    console.log(`🚀 SFA PUSAT HQ Server running at http://0.0.0.0:${PORT}`);
    testDbConnection();
});

