-- ========================================================
-- Schema Database Sync/Mirror Komunikasi Ke SFA PUSAT
-- ========================================================

CREATE TABLE IF NOT EXISTS outbox_sync_pusat (
    id SERIAL PRIMARY KEY,
    depo_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP,
    retry_count INT DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS sync_logs (
    id SERIAL PRIMARY KEY,
    depo_id VARCHAR(50),
    action VARCHAR(50),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
