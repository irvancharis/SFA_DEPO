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

// --- DUAL POSTGRESQL POOLS (HQ MAIN RECEIVER DB + REPORTING/CALCULATION DB) ---
let mainDbPool = null;
let reportDbPool = null;

function getDbMainPool() {
    const config = getPusatConfig();
    const dbConf = config.database || {};
    
    const host = process.env.DB_HOST || 'db_main';
    const port = parseInt(process.env.DB_PORT || dbConf.port, 10) || 5432;
    const database = process.env.DB_DATABASE || dbConf.name || 'sfa_db';
    const user = process.env.DB_USER || dbConf.user || 'postgres';
    const password = process.env.DB_PASSWORD || dbConf.password || 'postgres';

    if (!mainDbPool) {
        mainDbPool = new Pool({ host, port, database, user, password });
        console.log(`🔌 [HQ DB MAIN] Initialized Receiver Pool -> ${user}@${host}:${port}/${database}`);
    }
    return mainDbPool;
}

function getDbReportPool() {
    const host = process.env.DB_REPORT_HOST || 'db_report';
    const port = parseInt(process.env.DB_REPORT_PORT, 10) || 5432;
    const database = process.env.DB_REPORT_DATABASE || 'sfa_db_report';
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || 'postgres';

    if (!reportDbPool) {
        reportDbPool = new Pool({ host, port, database, user, password });
        console.log(`🔌 [HQ DB REPORT] Initialized Reporting/Calculation Pool -> ${user}@${host}:${port}/${database}`);
    }
    return reportDbPool;
}

function getDbPool() {
    return getDbMainPool();
}

function resetDbPool() {
    if (mainDbPool) {
        mainDbPool.end().catch(() => {});
        mainDbPool = null;
    }
    if (reportDbPool) {
        reportDbPool.end().catch(() => {});
        reportDbPool = null;
    }
}

// Redirect Root to Dashboard Pusat
app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        return res.redirect('/dashboard.html');
    }
    next();
});

// --- IN-MEMORY SYNC & DATA PROCESSING MONITORING STATUS ---
let syncStatus = {
    isSyncing: false,
    lastSyncAt: null,
    lastSyncCount: 0,
    lastDepoId: '-'
};

// --- API STATUS SFA PUSAT ---
app.get('/api/status', (req, res) => {
    const config = getPusatConfig();
    const activeDepos = config.depos.filter(d => d.status === 'connected').length;
    res.json({
        server: config.serverName,
        status: 'online',
        totalDepos: config.depos.length,
        activeDepos,
        syncStatus,
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
    const { depoId, action } = req.body;
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

// --- API DATA PENJUALAN & REPORTING (DARI DB REPORT) ---
app.get('/api/produk', async (req, res) => {
    try {
        const pool = getDbMainPool();
        const result = await pool.query('SELECT * FROM master_sfa_produk LIMIT 50');
        res.json({ count: result.rowCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pelanggan', async (req, res) => {
    try {
        const pool = getDbMainPool();
        const result = await pool.query('SELECT * FROM master_pelanggan LIMIT 50');
        res.json({ count: result.rowCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/penjualan', async (req, res) => {
    try {
        const pool = getDbReportPool(); // Read directly from DB Report Mirror
        const countRes = await pool.query('SELECT COUNT(*) FROM sfa_penjualan');
        const totalCount = parseInt(countRes.rows[0].count, 10);

        const result = await pool.query('SELECT * FROM sfa_penjualan ORDER BY tanggal DESC LIMIT 50');
        res.json({ total: totalCount, count: totalCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- FITUR REPORTING & BUSINESS INTELLIGENCE (DARI DB REPORT) ---
app.post('/api/simulasi/generate-penjualan-pusat', async (req, res) => {
    let count = parseInt(req.body.count, 10) || 10;
    if (count > 2000) count = 2000;

    const depos = ['DEPO-SURABAYA-01', 'DEPO-JAKARTA-01', 'DEPO-MALANG-01'];
    const startTime = Date.now();

    try {
        const mainPool = getDbMainPool();
        const reportPool = getDbReportPool();

        const mainClient = await mainPool.connect();
        const reportClient = await reportPool.connect();

        try {
            await mainClient.query('BEGIN');
            await reportClient.query('BEGIN');

            for (let i = 0; i < count; i++) {
                const depoId = depos[Math.floor(Math.random() * depos.length)];
                const noTrx = `HQ-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}-${i+1}`;
                const trxUuid = crypto.randomUUID();
                const idSales = Math.floor(1 + Math.random() * 20);
                const idPelanggan = `CUST-${Math.floor(100 + Math.random() * 900)}`;
                const grandTotal = Math.floor(50 + Math.random() * 450) * 10000;
                const tanggal = new Date().toISOString();

                await mainClient.query(
                    `INSERT INTO sfa_penjualan (uuid, notransaksi, tanggal, idsales, idpelanggan, grand_total)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [trxUuid, noTrx, tanggal, idSales, idPelanggan, grandTotal]
                );

                await reportClient.query(
                    `INSERT INTO sfa_penjualan (uuid, notransaksi, tanggal, idsales, idpelanggan, grand_total, id_depo)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [trxUuid, noTrx, tanggal, idSales, idPelanggan, grandTotal, depoId]
                );
            }

            await mainClient.query('COMMIT');
            await reportClient.query('COMMIT');
        } catch (err) {
            await mainClient.query('ROLLBACK');
            await reportClient.query('ROLLBACK');
            throw err;
        } finally {
            mainClient.release();
            reportClient.release();
        }

        const duration = Date.now() - startTime;
        res.json({
            success: true,
            count,
            durationMs: duration,
            message: `Berhasil generate ${count} transaksi simulasi di Pusat (DB Main & DB Report) dalam ${duration}ms!`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/report/omset-depo', async (req, res) => {
    try {
        const pool = getDbReportPool();
        const result = await pool.query(`
            SELECT 
                COALESCE(id_depo, 'DEPO-01') AS depo_id,
                COUNT(*) AS total_transaksi,
                SUM(grand_total) AS total_omset
            FROM sfa_penjualan
            GROUP BY COALESCE(id_depo, 'DEPO-01')
            ORDER BY total_omset DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/report/top-sales', async (req, res) => {
    try {
        const pool = getDbReportPool();
        const result = await pool.query(`
            SELECT 
                COALESCE(id_depo, 'DEPO-01') AS depo_id,
                idsales,
                COUNT(*) AS total_transaksi,
                SUM(grand_total) AS total_omset,
                RANK() OVER (PARTITION BY COALESCE(id_depo, 'DEPO-01') ORDER BY SUM(grand_total) DESC) as rank_depo
            FROM sfa_penjualan
            GROUP BY COALESCE(id_depo, 'DEPO-01'), idsales
            ORDER BY depo_id, rank_depo ASC
            LIMIT 50
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
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

    // Set Processing Indicator State
    syncStatus.isSyncing = true;
    syncStatus.lastDepoId = depo.depoId;
    syncStatus.lastSyncCount = items.length;
    syncStatus.lastSyncAt = new Date().toISOString();

    try {
        let syncedCount = 0;

        // 1. Simpan ke HQ Main DB (Transactional Receiver)
        const mainClient = await getDbMainPool().connect();
        try {
            await mainClient.query('BEGIN');
            for (const item of items) {
                await mainClient.query(
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
            await mainClient.query('COMMIT');
        } catch (err) {
            await mainClient.query('ROLLBACK');
            throw err;
        } finally {
            mainClient.release();
        }

        // 2. Asynchronous Mirroring ke HQ Report/Calculation DB
        (async () => {
            try {
                const reportClient = await getDbReportPool().connect();
                try {
                    await reportClient.query('BEGIN');
                    for (const item of items) {
                        await reportClient.query(
                            `INSERT INTO sfa_penjualan (uuid, notransaksi, tanggal, idsales, idpelanggan, grand_total, id_depo)
                             VALUES ($1, $2, $3, $4, $5, $6, $7)
                             ON CONFLICT (uuid, notransaksi) DO UPDATE SET
                             tanggal = EXCLUDED.tanggal,
                             idsales = EXCLUDED.idsales,
                             idpelanggan = EXCLUDED.idpelanggan,
                             grand_total = EXCLUDED.grand_total,
                             id_depo = EXCLUDED.id_depo`,
                            [item.uuid || crypto.randomUUID(), item.notransaksi, item.tanggal || new Date(), item.idsales || 1, item.idpelanggan || 'CUST-GENERAL', item.grand_total || 0, depo.depoId]
                        );
                    }
                    await reportClient.query('COMMIT');
                    console.log(`📊 [HQ DB REPORT MIRROR] ${items.length} transaksi ter-mirror ke Reporting DB!`);
                } catch (e) {
                    await reportClient.query('ROLLBACK');
                    console.error('❌ Mirror error ke Reporting DB:', e.message);
                } finally {
                    reportClient.release();
                    syncStatus.isSyncing = false;
                }
            } catch (err) {
                console.error('❌ DB Report connection error:', err.message);
                syncStatus.isSyncing = false;
            }
        })();

        console.log(`⚡ [REALTIME SYNC HQ] Berhasil menerima ${syncedCount} transaksi dari ${depo.depoId}`);
        res.json({ success: true, count: syncedCount, message: `${syncedCount} Transaksi berhasil disinkronkan ke HQ Pusat & Reporting DB.` });
    } catch (err) {
        syncStatus.isSyncing = false;
        console.error('❌ Error saving sync data at HQ:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Auto Connection PostgreSQL
async function testDbConnection(retries = 30) {
    while (retries > 0) {
        try {
            const mainPool = getDbMainPool();
            const mainClient = await mainPool.connect();
            console.log('✅ SFA PUSAT connected to HQ DB Main Receiver!');
            mainClient.release();

            const reportPool = getDbReportPool();
            const reportClient = await reportPool.connect();
            console.log('✅ SFA PUSAT connected to HQ DB Report/Calculation Mirror!');
            reportClient.release();

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

