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
        depoId: 'DEPO-01',
        publicIp: '127.0.0.1',
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
        
        const sensitiveData = {
            token: state.token,
            depoId: state.depoId || 'DEPO-01',
            publicIp: state.publicIp || '127.0.0.1',
            pusatUrl: state.pusatUrl || process.env.PUSAT_URL || 'http://host.docker.internal:3000',
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

// --- DUAL POSTGRESQL POOLS (LOCAL TRANSACTIONAL DB + SYNC MIRROR DB) ---
let localDbPool = null;
let syncDbPool = null;

function getDbLocalPool() {
    const state = getActivationState();
    const dbConf = state.database || {};
    
    const host = process.env.DB_LOCAL_HOST || dbConf.host || 'db_local';
    const port = parseInt(dbConf.port || process.env.DB_LOCAL_PORT, 10) || 5432;
    const database = dbConf.name || process.env.DB_LOCAL_NAME || 'sfa_db';
    const user = dbConf.user || process.env.DB_USER || 'postgres';
    const password = dbConf.password || process.env.DB_PASSWORD || 'postgres';

    if (!localDbPool) {
        localDbPool = new Pool({ host, port, database, user, password });
        console.log(`🔌 [DB LOCAL] Initialized Transactional Pool -> ${user}@${host}:${port}/${database}`);
    }
    return localDbPool;
}

function getDbSyncPool() {
    const host = process.env.DB_SYNC_HOST || 'db_sync';
    const port = parseInt(process.env.DB_SYNC_PORT, 10) || 5432;
    const database = process.env.DB_SYNC_NAME || 'sfa_db_sync';
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || 'postgres';

    if (!syncDbPool) {
        syncDbPool = new Pool({ host, port, database, user, password });
        console.log(`🔌 [DB SYNC] Initialized Mirror/Outbox Sync Pool -> ${user}@${host}:${port}/${database}`);
    }
    return syncDbPool;
}

function getDbPool() {
    return getDbLocalPool();
}

function resetDbPool() {
    if (localDbPool) {
        localDbPool.end().catch(() => {});
        localDbPool = null;
    }
    if (syncDbPool) {
        syncDbPool.end().catch(() => {});
        syncDbPool = null;
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
        pusatUrl: process.env.PUSAT_URL || 'http://localhost:3000',
        databaseConfigured: !!state.database
    });
});

app.post('/api/activate', async (req, res) => {
    const { token, pusatUrl } = req.body;
    const state = getActivationState();

    if (!token) {
        return res.status(400).json({ success: false, message: 'Token tidak boleh kosong!' });
    }

    let targetPusatUrl = pusatUrl || process.env.PUSAT_URL || 'http://host.docker.internal:3000';
    if (targetPusatUrl.includes('localhost') || targetPusatUrl.includes('127.0.0.1')) {
        targetPusatUrl = targetPusatUrl.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
    }
    targetPusatUrl = targetPusatUrl.replace(/\/+$/, '');

    try {
        const response = await fetch(`${targetPusatUrl}/api/pusat/verify-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.trim(), depoId: state.depoId })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            state.status = 'connected';
            state.token = token.trim();
            if (data.depoId) state.depoId = data.depoId;
            if (data.publicIp) state.publicIp = data.publicIp;
            state.activatedAt = new Date().toISOString();
            if (data.dbConfig) {
                state.database = data.dbConfig;
            }

            saveActivationState(state);
            resetDbPool();

            console.log(`✅ [ACTIVATION SUCCESS] Depo ${state.depoId} terverifikasi oleh SFA PUSAT (${targetPusatUrl})!`);
            return res.json({
                success: true,
                message: data.message || 'Aktivasi berhasil! Depo terverifikasi oleh SFA PUSAT.',
                data: state
            });
        } else {
            return res.status(response.status || 400).json({
                success: false,
                message: data.message || 'Token tidak terdaftar atau tidak valid di SFA PUSAT!'
            });
        }
    } catch (err) {
        console.error('❌ Gagal menghubungi SFA PUSAT:', err.message);
        return res.status(502).json({
            success: false,
            message: `Gagal terhubung ke SFA PUSAT (${targetPusatUrl}). Pastikan server SFA PUSAT sudah berjalan.`
        });
    }
});

app.post('/api/reset', async (req, res) => {
    const state = getActivationState();
    const currentToken = state.token;
    const currentDepoId = state.depoId;

    state.status = 'pending';
    state.token = null;
    state.activatedAt = null;

    saveActivationState(state);
    resetDbPool();

    let targetPusatUrl = process.env.PUSAT_URL || 'http://host.docker.internal:3000';
    if (targetPusatUrl.includes('localhost') || targetPusatUrl.includes('127.0.0.1')) {
        targetPusatUrl = targetPusatUrl.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
    }
    targetPusatUrl = targetPusatUrl.replace(/\/+$/, '');

    try {
        await fetch(`${targetPusatUrl}/api/pusat/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken, depoId: currentDepoId })
        });
        console.log(`🔒 [ACTIVATION RESET] Status Depo ${currentDepoId} dikembalikan ke Pending dan dilaporkan ke SFA PUSAT.`);
    } catch (err) {
        console.warn(`⚠️ Gagal memberitahu SFA PUSAT saat disconnect: ${err.message}`);
    }

    res.json({ success: true, message: 'Token berhasil di-reset ke status pending dan dilaporkan ke SFA PUSAT.' });
});

// --- REALTIME OUTBOX SYNC ENGINE (DB SYNC -> SFA PUSAT) ---
let isSyncing = false;

async function processOutboxSync() {
    if (isSyncing) return;

    const state = getActivationState();
    if (state.status !== 'connected' || !state.token) {
        return; // Hanya sync jika Depo berstatus connected
    }

    isSyncing = true;
    try {
        const syncPool = getDbSyncPool();
        const pendingItems = await syncPool.query(
            "SELECT * FROM outbox_sync_pusat WHERE status = 'pending' ORDER BY id ASC LIMIT 50"
        );

        if (pendingItems.rows.length > 0) {
            const itemsToSend = pendingItems.rows.map(row => row.payload);
            const itemIds = pendingItems.rows.map(row => row.id);

            let targetPusatUrl = state.pusatUrl || process.env.PUSAT_URL || 'http://host.docker.internal:3000';
            if (targetPusatUrl.includes('localhost') || targetPusatUrl.includes('127.0.0.1')) {
                targetPusatUrl = targetPusatUrl.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
            }
            targetPusatUrl = targetPusatUrl.replace(/\/+$/, '');

            const response = await fetch(`${targetPusatUrl}/api/pusat/sync-penjualan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    depoId: state.depoId,
                    token: state.token,
                    items: itemsToSend
                })
            });

            const result = await response.json();
            if (response.ok && result.success) {
                await syncPool.query(
                    "UPDATE outbox_sync_pusat SET status = 'synced', synced_at = NOW() WHERE id = ANY($1::int[])",
                    [itemIds]
                );
                console.log(`⚡ [REALTIME SYNC SUCCESS] ${itemsToSend.length} transaksi ter-sync ke SFA PUSAT (${targetPusatUrl})!`);
            } else {
                console.warn(`⚠️ Realtime sync ditolak SFA PUSAT (${targetPusatUrl}): ${result.message}`);
            }
        }
    } catch (err) {
        console.error('❌ Realtime sync error ke Pusat:', err.message);
    } finally {
        isSyncing = false;
    }
}

// Interval Real-Time Sync setiap 5 detik
setInterval(processOutboxSync, 5000);

// --- API BUSINESS ENDPOINTS (LOCAL DB + OUTBOX SYNC MIRROR) ---
app.get('/api/produk', async (req, res) => {
    try {
        const pool = getDbLocalPool();
        const result = await pool.query('SELECT * FROM master_sfa_produk LIMIT 50');
        res.json({ count: result.rowCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pelanggan', async (req, res) => {
    try {
        const pool = getDbLocalPool();
        const result = await pool.query('SELECT * FROM master_pelanggan LIMIT 50');
        res.json({ count: result.rowCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/penjualan', async (req, res) => {
    try {
        const pool = getDbLocalPool();
        const countRes = await pool.query('SELECT COUNT(*) FROM sfa_penjualan');
        const totalCount = parseInt(countRes.rows[0].count, 10);

        const result = await pool.query('SELECT * FROM sfa_penjualan ORDER BY tanggal DESC LIMIT 50');
        res.json({ total: totalCount, count: totalCount, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/penjualan', async (req, res) => {
    const { notransaksi, idsales, idpelanggan, grand_total } = req.body;
    const noTrx = notransaksi || `INV-${Date.now()}`;
    const trxUuid = crypto.randomUUID();
    const state = getActivationState();

    try {
        // 1. Simpan Transaksi di DB Local Transaksional
        const localPool = getDbLocalPool();
        await localPool.query(
            `INSERT INTO sfa_penjualan (uuid, notransaksi, tanggal, idsales, idpelanggan, grand_total)
             VALUES ($1, $2, NOW(), $3, $4, $5)`,
            [trxUuid, noTrx, idsales || 1, idpelanggan || 'CUST-GENERAL', grand_total || 0]
        );

        // 2. Simpan Outbox Mirror Payload di DB Sync
        const syncPool = getDbSyncPool();
        const payload = {
            uuid: trxUuid,
            notransaksi: noTrx,
            tanggal: new Date().toISOString(),
            idsales: idsales || 1,
            idpelanggan: idpelanggan || 'CUST-GENERAL',
            grand_total: grand_total || 0
        };

        await syncPool.query(
            `INSERT INTO outbox_sync_pusat (depo_id, entity_type, payload, status)
             VALUES ($1, 'PENJUALAN', $2, 'pending')`,
            [state.depoId || 'DEPO-01', JSON.stringify(payload)]
        );

        console.log(`🛒 [NEW SALE LOCAL] Transaksi ${noTrx} tersimpan di DB Local & antrean DB Sync!`);

        // Trigger sync instan
        processOutboxSync();

        res.json({ success: true, message: 'Transaksi berhasil disimpan lokal & masuk antrean sync real-time.', notransaksi: noTrx, uuid: trxUuid });
    } catch (err) {
        console.error('❌ Gagal menyimpan transaksi:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/simulasi/generate-penjualan', async (req, res) => {
    let count = parseInt(req.body.count, 10) || 10;
    if (count > 2000) count = 2000;

    const state = getActivationState();
    const localPool = getDbLocalPool();
    const syncPool = getDbSyncPool();

    const startTime = Date.now();

    try {
        const localClient = await localPool.connect();
        const syncClient = await syncPool.connect();

        try {
            await localClient.query('BEGIN');
            await syncClient.query('BEGIN');

            for (let i = 0; i < count; i++) {
                const noTrx = `SIM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}-${i+1}`;
                const trxUuid = crypto.randomUUID();
                const idSales = Math.floor(1 + Math.random() * 20);
                const idPelanggan = `CUST-${Math.floor(100 + Math.random() * 900)}`;
                const grandTotal = Math.floor(50 + Math.random() * 450) * 10000;
                const tanggal = new Date().toISOString();

                await localClient.query(
                    `INSERT INTO sfa_penjualan (uuid, notransaksi, tanggal, idsales, idpelanggan, grand_total)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [trxUuid, noTrx, tanggal, idSales, idPelanggan, grandTotal]
                );

                const payload = {
                    uuid: trxUuid,
                    notransaksi: noTrx,
                    tanggal: tanggal,
                    idsales: idSales,
                    idpelanggan: idPelanggan,
                    grand_total: grandTotal
                };

                await syncClient.query(
                    `INSERT INTO outbox_sync_pusat (depo_id, entity_type, payload, status)
                     VALUES ($1, 'PENJUALAN', $2, 'pending')`,
                    [state.depoId || 'DEPO-01', JSON.stringify(payload)]
                );
            }

            await localClient.query('COMMIT');
            await syncClient.query('COMMIT');
        } catch (err) {
            await localClient.query('ROLLBACK');
            await syncClient.query('ROLLBACK');
            throw err;
        } finally {
            localClient.release();
            syncClient.release();
        }

        const duration = Date.now() - startTime;
        console.log(`⚡ [SIMULASI BULK] Generated ${count} transaksi dalam ${duration}ms!`);

        processOutboxSync();

        res.json({
            success: true,
            count,
            durationMs: duration,
            message: `Berhasil membuat ${count} transaksi simulasi lokal & antrean sync dalam ${duration}ms!`
        });
    } catch (err) {
        console.error('❌ Gagal generate simulasi transaksi:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- FITUR DISASTER RECOVERY (RE-SYNC SELURUH DATA LOKAL KE PUSAT) ---
app.post('/api/penjualan/resync', async (req, res) => {
    const state = getActivationState();
    const localPool = getDbLocalPool();
    const syncPool = getDbSyncPool();

    try {
        const result = await localPool.query('SELECT * FROM sfa_penjualan ORDER BY tanggal ASC');
        const allPenjualan = result.rows;

        if (allPenjualan.length === 0) {
            return res.json({ success: true, message: 'Tidak ada data transaksi di DB Lokal untuk di-resync.' });
        }

        const syncClient = await syncPool.connect();
        let requeuedCount = 0;

        try {
            await syncClient.query('BEGIN');
            for (const item of allPenjualan) {
                const payload = {
                    uuid: item.uuid,
                    notransaksi: item.notransaksi,
                    tanggal: item.tanggal,
                    idsales: item.idsales,
                    idpelanggan: item.idpelanggan,
                    grand_total: item.grand_total
                };

                await syncClient.query(
                    `INSERT INTO outbox_sync_pusat (depo_id, entity_type, payload, status)
                     VALUES ($1, 'PENJUALAN', $2, 'pending')`,
                    [state.depoId || 'DEPO-01', JSON.stringify(payload)]
                );
                requeuedCount++;
            }
            await syncClient.query('COMMIT');
        } catch (err) {
            await syncClient.query('ROLLBACK');
            throw err;
        } finally {
            syncClient.release();
        }

        // Trigger outbox sync instan
        processOutboxSync();

        res.json({
            success: true,
            requeuedCount,
            message: `Berhasil mendata ulang ${requeuedCount} transaksi lokal ke antrean outbox sync!`
        });
    } catch (err) {
        console.error('❌ Gagal Re-sync data:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Auto Retry PostgreSQL Connections (Dual DB)
async function testDbConnection(retries = 30) {
    while (retries > 0) {
        try {
            const poolLocal = getDbLocalPool();
            const clientLocal = await poolLocal.connect();
            clientLocal.release();

            const poolSync = getDbSyncPool();
            const clientSync = await poolSync.connect();
            clientSync.release();

            console.log('✅ Dual DB Connected! (DB Local Transaksional & DB Sync Mirror)');
            return;
        } catch (err) {
            console.log(`⚠️ Dual Database PostgreSQL belum siap (${err.message}). Retries remaining: ${retries}`);
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
