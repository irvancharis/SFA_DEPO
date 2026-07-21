-- ========================================================
-- Schema Database Reporting & Analytics SFA PUSAT
-- Optimized for 1,000,000+ Transactions Per Month
-- ========================================================

CREATE TABLE IF NOT EXISTS sfa_penjualan (
    uuid VARCHAR(36) NOT NULL,
    notransaksi VARCHAR(50) NOT NULL,
    tanggal TIMESTAMP,
    idsales INTEGER,
    idpelanggan VARCHAR(50),
    grand_total DECIMAL(18, 2),
    id_depo VARCHAR(50),
    CONSTRAINT pk_sfa_penjualan_report_id PRIMARY KEY (uuid, notransaksi)
);

-- B-Tree Indexes for 1M+ Records High Performance Analytics
CREATE INDEX IF NOT EXISTS idx_sfa_penjualan_depo ON sfa_penjualan(id_depo);
CREATE INDEX IF NOT EXISTS idx_sfa_penjualan_tanggal ON sfa_penjualan(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_sfa_penjualan_sales ON sfa_penjualan(idsales);
CREATE INDEX IF NOT EXISTS idx_sfa_penjualan_depo_sales ON sfa_penjualan(id_depo, idsales);

CREATE TABLE IF NOT EXISTS master_pelanggan (
    idpelanggan VARCHAR(50) PRIMARY KEY,
    namapelanggan VARCHAR(100),
    alamat TEXT
);

CREATE TABLE IF NOT EXISTS summary_penjualan_depo (
    depo_id VARCHAR(50) PRIMARY KEY,
    total_transaksi INT DEFAULT 0,
    total_omset DECIMAL(18, 2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
