-- ========================================================
-- Schema Database Reporting & Analytics SFA PUSAT
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
