-- ========================================================
-- PostgreSQL Schema Migrated from Firebird 2.5 (SFA_2027)
-- ========================================================

CREATE TABLE IF NOT EXISTS master_company (
    id INTEGER NOT NULL,
    nama VARCHAR(64),
    alamat VARCHAR(128),
    kelurahan VARCHAR(32),
    kecamatan VARCHAR(32),
    kota VARCHAR(32),
    provinsi VARCHAR(50),
    telp VARCHAR(20),
    status INTEGER,
    keterangan VARCHAR(128),
    ownership INTEGER,
    constraint pk_pk_master_company_id primary key (id)
);

CREATE TABLE IF NOT EXISTS master_companydetail (
    id INTEGER NOT NULL,
    id_depo VARCHAR(20) NOT NULL,
    namadepo VARCHAR(129),
    alamat VARCHAR(251),
    provinsi VARCHAR(50),
    kota VARCHAR(50),
    kecamatan VARCHAR(50),
    kelurahan VARCHAR(50),
    kodepos VARCHAR(20),
    telp VARCHAR(20),
    pic VARCHAR(200),
    keterangan VARCHAR(128),
    constraint pk_pk_master_companydetail_id primary key (id, id_depo)
);

CREATE TABLE IF NOT EXISTS master_companygudang (
    id INTEGER NOT NULL,
    id_depo VARCHAR(20),
    kodegudang VARCHAR(20),
    namagudang VARCHAR(20),
    constraint pk_pk_master_companygudang_id primary key (id)
);

CREATE TABLE IF NOT EXISTS master_companyproduk (
    uuid_companyproduk VARCHAR(36) NOT NULL,
    idcompany INTEGER NOT NULL,
    idcompanydetail INTEGER NOT NULL,
    idproduk VARCHAR(20),
    status INTEGER,
    dibuat TIMESTAMP,
    diedit TIMESTAMP,
    constraint pk_pk_master_companyproduk_id primary key (uuid_companyproduk, idcompany, idcompanydetail)
);

CREATE TABLE IF NOT EXISTS master_feature (
    id INTEGER NOT NULL,
    permission_code VARCHAR(50),
    permission_name VARCHAR(100),
    CONSTRAINT pk_master_feature_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_itemlevelprice (
    uuid_levelprice VARCHAR(36) NOT NULL,
    uuid_companyproduk VARCHAR(36) NOT NULL,
    tanggal_pembuatan DATE NOT NULL,
    tanggal_mulai DATE NOT NULL,
    keterangan VARCHAR(500),
    constraint pk_pk_master_itemlevelprice_id primary key (uuid_levelprice, uuid_companyproduk)
);

CREATE TABLE IF NOT EXISTS master_itemlevelpricedetail (
    uuid_levelprice VARCHAR(36) NOT NULL,
    idproduk VARCHAR(25) NOT NULL,
    namaproduk VARCHAR(64),
    hargalvl1 NUMERIC(18, 2),
    hargalvl2 NUMERIC(18, 2),
    hargalvl3 NUMERIC(18, 2),
    hargalvl4 NUMERIC(18, 2),
    hargalvl5 NUMERIC(18, 2),
    hargalvl6 NUMERIC(18, 2),
    hargalvl7 NUMERIC(18, 2),
    constraint pk_pk_master_itemlevelpricedetail_id primary key (uuid_levelprice, idproduk)
);

CREATE TABLE IF NOT EXISTS master_jenis_trx (
    id VARCHAR(36) NOT NULL,
    nama_trx VARCHAR(50),
    keterangan VARCHAR(200),
    CONSTRAINT pk_master_jenis_trx_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_pelanggan (
    id INTEGER NOT NULL,
    namapelanggan VARCHAR(255),
    alamat VARCHAR(255),
    telp VARCHAR(24),
    idsales INTEGER,
    tipe VARCHAR(25),
    top VARCHAR(25),
    termsid INTEGER,
    intpaymentterm INTEGER,
    sisalimit NUMERIC(18, 2),
    personno VARCHAR(50) NOT NULL,
    levelprice INTEGER DEFAULT 1 NOT NULL,
    leveldisc INTEGER DEFAULT 1 NOT NULL,
    latitude VARCHAR(50),
    longitude VARCHAR(50),
    tanggal TIMESTAMP,
    id_depo VARCHAR(10),
    provinsi VARCHAR(50),
    kota VARCHAR(50),
    kecamatan VARCHAR(100),
    kelurahan VARCHAR(100),
    suspended INTEGER,
    gps_status INTEGER DEFAULT 0,
    radius INTEGER DEFAULT 10 NOT NULL,
    constraint pk_pk_master_pelanggan_id primary key (id, personno)
);

CREATE TABLE IF NOT EXISTS master_sales (
    uuid VARCHAR(36) NOT NULL,
    idsales VARCHAR(5) NOT NULL,
    id_company INTEGER,
    id_depo VARCHAR(20) NOT NULL,
    kodesales VARCHAR(64),
    namasales VARCHAR(50),
    idgudang VARCHAR(5),
    idspv INTEGER NOT NULL,
    idtl INTEGER,
    status INTEGER DEFAULT 0 NOT NULL,
    flag_kunjungan INTEGER,
    kodepromo VARCHAR(20),
    gps_traccar VARCHAR(20) DEFAULT 0 NOT NULL,
    printer_status INTEGER NOT NULL,
    mac_printer VARCHAR(64),
    telp VARCHAR(20) DEFAULT NULL,
    idchanel INTEGER,
    status_gps INTEGER DEFAULT 0 NOT NULL,
    flag_spg INTEGER DEFAULT 0 NOT NULL,
    sales_project INTEGER,
    id_tl VARCHAR(50),
    constraint pk_master_sales_id primary key (uuid, idsales)
);

CREATE TABLE IF NOT EXISTS master_sales_spv (
    uuid VARCHAR(50) NOT NULL,
    idspv VARCHAR(50),
    id_user INTEGER,
    id_company VARCHAR(50),
    id_depo VARCHAR(50),
    nama_spv VARCHAR(100),
    telp VARCHAR(50),
    target_omset DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_master_sales_spv_id PRIMARY KEY (uuid)
);

CREATE TABLE IF NOT EXISTS master_sales_tl (
    uuid VARCHAR(50) NOT NULL,
    id_tl VARCHAR(50),
    id_user INTEGER,
    id_company VARCHAR(50),
    id_depo VARCHAR(50),
    idspv VARCHAR(50),
    nama_tl VARCHAR(100),
    keterangan VARCHAR(50),
    telp VARCHAR(50),
    target_omset DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_master_sales_tl_id PRIMARY KEY (uuid)
);

CREATE TABLE IF NOT EXISTS master_sfa_call (
    nocall CHAR(20) NOT NULL,
    idsales CHAR(4),
    id_depo VARCHAR(50) NOT NULL,
    mulai TIMESTAMP NOT NULL,
    selesai TIMESTAMP NOT NULL,
    tglcall TIMESTAMP,
    km_awal VARCHAR(255) NOT NULL,
    km_akhir VARCHAR(255) NOT NULL,
    id_plat VARCHAR(10),
    flag_selesai INTEGER NOT NULL,
    keterangan VARCHAR(50),
    idspv INTEGER,
    downloaded VARCHAR(255) NOT NULL,
    id_tl VARCHAR(50),
    constraint pk_pk_master_sfa_call_id primary key (nocall)
);

CREATE TABLE IF NOT EXISTS master_sfa_calldetail (
    flagkunjungan INTEGER,
    flagluarrute INTEGER,
    flagpelangganbaru INTEGER,
    flagsukses INTEGER,
    flagtunda INTEGER,
    idalasan CHAR(12),
    idpelanggan VARCHAR(20),
    latitude CHAR(24),
    longitude CHAR(24),
    nocall CHAR(20) NOT NULL,
    nodetail INTEGER NOT NULL,
    tipe CHAR(12),
    waktumulai CHAR(24),
    waktuselesai CHAR(24),
    kdhari INTEGER,
    constraint pk_pk_master_sfa_calldetail_id primary key (nocall, nodetail)
);

CREATE TABLE IF NOT EXISTS master_sfa_metodebayar (
    id INTEGER NOT NULL,
    nama_metode VARCHAR(50) NOT NULL,
    provider VARCHAR(20),
    status INTEGER NOT NULL,
    constraint pk_pk_master_sfa_metodebayar_id primary key (id)
);

CREATE TABLE IF NOT EXISTS master_sfa_metode_bayar_config (
    uuid VARCHAR(36) NOT NULL,
    id_metode_bayar INTEGER NOT NULL,
    idcompany INTEGER,
    iddepo VARCHAR(501),
    connection_config TEXT,
    status INTEGER DEFAULT 0 NOT NULL,
    keterangan VARCHAR(1000),
    CONSTRAINT pk_master_sfa_metode_bayar_config_id PRIMARY KEY (uuid, id_metode_bayar)
);

CREATE TABLE IF NOT EXISTS master_sfa_produk (
    uuid VARCHAR(36) NOT NULL,
    idproduk VARCHAR(20) NOT NULL,
    barcode VARCHAR(50),
    namaproduk VARCHAR(50),
    tipe VARCHAR(20),
    id_kategori INTEGER,
    varian VARCHAR(50),
    satuan VARCHAR(20),
    satuan_l1 INTEGER,
    satuan_l2 INTEGER,
    satuan_l3 INTEGER,
    satuan_l4 INTEGER,
    satuan_l5 INTEGER,
    visibilitas INTEGER,
    status INTEGER,
    id_metode_bayar INTEGER NOT NULL,
    keterangan VARCHAR(1000),
    constraint pk_pk_master_sfa_produk_id primary key (uuid)
);

CREATE TABLE IF NOT EXISTS master_sfa_produk_kategori (
    uuid VARCHAR(36) NOT NULL,
    id_kategori INTEGER NOT NULL,
    nama_kategori VARCHAR(50),
    keterangan VARCHAR(200),
    constraint pk_pk_master_sfa_produk_kategori_id primary key (uuid, id_kategori)
);

CREATE TABLE IF NOT EXISTS master_sfa_promo (
    id INTEGER NOT NULL,
    kodepromo VARCHAR(20) NOT NULL,
    namapromo VARCHAR(50),
    tanggal_dibuat TIMESTAMP,
    tanggal_mulai DATE,
    tanggal_selesai DATE,
    flag_vendor INTEGER,
    jenis_promo INTEGER,
    keterangan VARCHAR(1000),
    constraint pk_pk_master_sfa_promo_id primary key (id)
);

CREATE TABLE IF NOT EXISTS master_sfa_promodetail (
    id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    idproduk VARCHAR(20),
    unit VARCHAR(20),
    sk BYTEA,
    keterangan VARCHAR(1000),
    constraint pk_pk_master_sfa_promodetail_id primary key (id, seq)
);

CREATE TABLE IF NOT EXISTS master_sfa_promojenis (
    id INTEGER NOT NULL,
    nama VARCHAR(20),
    keterangan VARCHAR(50),
    constraint pk_pk_master_sfa_promojenis_id primary key (id)
);

CREATE TABLE IF NOT EXISTS master_status_stok (
    id INTEGER NOT NULL,
    nama VARCHAR(20),
    keterangan VARCHAR(500),
    CONSTRAINT pk_master_status_stok_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_activity_log (
    id INTEGER NOT NULL,
    user_id INTEGER,
    action VARCHAR(100),
    module VARCHAR(100),
    description VARCHAR(255),
    created_at TIMESTAMP,
    CONSTRAINT pk_master_user_activity_log_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_divisi (
    id INTEGER NOT NULL,
    nama VARCHAR(100) NOT NULL,
    deskripsi VARCHAR(255),
    CONSTRAINT pk_master_user_divisi_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_jabatan (
    id INTEGER NOT NULL,
    nama VARCHAR(100) NOT NULL,
    deskripsi VARCHAR(255),
    is_kabag SMALLINT DEFAULT 0,
    CONSTRAINT pk_master_user_jabatan_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_login (
    id INTEGER NOT NULL,
    name VARCHAR(150),
    email VARCHAR(100),
    foto VARCHAR(255),
    area_id INTEGER,
    jabatan_id INTEGER,
    divisi_id INTEGER,
    role_id INTEGER,
    nik VARCHAR(30),
    status VARCHAR(20) DEFAULT 'aktif',
    id_depo VARCHAR(50),
    team_leader VARCHAR(50),
    kode_sales VARCHAR(50),
    CONSTRAINT pk_master_user_login_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_permissions (
    id INTEGER NOT NULL,
    permission_code VARCHAR(100),
    permission_name VARCHAR(150),
    CONSTRAINT pk_master_user_permissions_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_permissions_detail (
    id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    sub_permission_code VARCHAR(100) NOT NULL,
    sub_permission_name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    CONSTRAINT pk_master_user_permissions_detail_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_roles (
    id INTEGER NOT NULL,
    role_code VARCHAR(50),
    role_name VARCHAR(100),
    description VARCHAR(255),
    CONSTRAINT pk_master_user_roles_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS master_user_roles_permissions (
    id INTEGER NOT NULL,
    role_id INTEGER,
    permission_id INTEGER,
    can_view SMALLINT DEFAULT 0,
    can_create SMALLINT DEFAULT 0,
    can_update SMALLINT DEFAULT 0,
    can_delete SMALLINT DEFAULT 0,
    can_approve SMALLINT DEFAULT 0,
    can_verify SMALLINT,
    CONSTRAINT pk_master_user_roles_permissions_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS reg_kecamatan (
    id INTEGER NOT NULL,
    nama_kecamatan VARCHAR(50),
    id_kota INTEGER
);

CREATE TABLE IF NOT EXISTS reg_kelurahan (
    id INTEGER NOT NULL,
    nama_kelurahan VARCHAR(50),
    id_kecamatan INTEGER,
    gencode INTEGER DEFAULT 10000,
    CONSTRAINT pk_reg_kelurahan_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS reg_kota (
    id INTEGER NOT NULL,
    nama_kota VARCHAR(50),
    prov_id INTEGER,
    CONSTRAINT pk_reg_kota_id PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS reg_provinsi (
    prov_id INTEGER NOT NULL,
    prov_name VARCHAR(50) NOT NULL,
    location_id INTEGER,
    status INTEGER,
    CONSTRAINT pk_reg_provinsi_id PRIMARY KEY (prov_id)
);

CREATE TABLE IF NOT EXISTS sfa_call (
    nocall CHAR(20) NOT NULL,
    idsales CHAR(4),
    id_depo VARCHAR(50) NOT NULL,
    mulai TIMESTAMP DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    selesai TIMESTAMP DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    tglcall TIMESTAMP,
    km_awal VARCHAR(255) DEFAULT 0 NOT NULL,
    km_akhir VARCHAR(255) DEFAULT 0 NOT NULL,
    id_plat VARCHAR(10) DEFAULT NULL,
    flag_selesai INTEGER DEFAULT 0 NOT NULL,
    keterangan VARCHAR(50),
    idspv INTEGER,
    downloaded VARCHAR(255) DEFAULT '0|0|0|0|0|0' NOT NULL,
    id_tl VARCHAR(50),
    CONSTRAINT pk_sfa_call_id PRIMARY KEY (nocall)
);

CREATE TABLE IF NOT EXISTS sfa_calldetail (
    flagkunjungan INTEGER,
    flagluarrute INTEGER,
    flagpelangganbaru INTEGER,
    flagsukses INTEGER,
    flagtunda INTEGER,
    idalasan CHAR(12),
    idpelanggan VARCHAR(20),
    latitude CHAR(24),
    longitude CHAR(24),
    nocall CHAR(20) NOT NULL,
    nodetail INTEGER NOT NULL,
    tipe CHAR(12),
    waktumulai CHAR(24),
    waktuselesai CHAR(24),
    kdhari INTEGER,
    CONSTRAINT pk_sfa_calldetail_id PRIMARY KEY (nocall, nodetail)
);

CREATE TABLE IF NOT EXISTS sfa_pelanggan (
    personno VARCHAR(25) NOT NULL,
    namapelanggan VARCHAR(255),
    alamat VARCHAR(255),
    idsales INTEGER,
    tipe VARCHAR(25),
    latitude VARCHAR(50),
    longitude VARCHAR(50),
    tanggal TIMESTAMP,
    telp VARCHAR(20),
    uploaded INTEGER,
    id_depo VARCHAR(10),
    provinsi VARCHAR(50),
    kota VARCHAR(50),
    kecamatan VARCHAR(100),
    kelurahan VARCHAR(100),
    distchannel VARCHAR(75),
    validasi INTEGER DEFAULT 0 NOT NULL,
    keterangan VARCHAR(200),
    CONSTRAINT pk_sfa_pelanggan_id PRIMARY KEY (personno)
);

CREATE TABLE IF NOT EXISTS sfa_pembayaran (
    tanggal TIMESTAMP NOT NULL,
    notransaksi VARCHAR(50) NOT NULL,
    nopembayaran VARCHAR(50) NOT NULL,
    idsales INTEGER,
    idpelanggan VARCHAR(50),
    dibayarkan DECIMAL(18, 2),
    kembalian DECIMAL(18, 2),
    id_depo VARCHAR(50),
    CONSTRAINT pk_sfa_pembayaran_id PRIMARY KEY (notransaksi, nopembayaran)
);

CREATE TABLE IF NOT EXISTS sfa_pembayarandetail (
    uuid VARCHAR(36) NOT NULL,
    nopembayaran VARCHAR(50) NOT NULL,
    id_metode_bayar INTEGER,
    id_metode_bayar_config VARCHAR(36),
    norefrensi VARCHAR(50),
    jumlah DECIMAL(18, 2),
    status INTEGER,
    CONSTRAINT pk_sfa_pembayarandetail_id PRIMARY KEY (uuid, nopembayaran)
);

CREATE TABLE IF NOT EXISTS sfa_penjualan (
    uuid VARCHAR(36) NOT NULL,
    notransaksi VARCHAR(50) NOT NULL,
    tanggal TIMESTAMP,
    id_company INTEGER,
    id_depo VARCHAR(50),
    idsales INTEGER,
    id_karyawan VARCHAR(50),
    idpelanggan VARCHAR(50),
    bruto DECIMAL(18, 2),
    promo DECIMAL(18, 2),
    netto DECIMAL(18, 2),
    tax_amount DECIMAL(18, 2),
    grand_total DECIMAL(18, 2),
    jenis_transaksi INTEGER,
    idspv VARCHAR(50),
    id_tl VARCHAR(50),
    CONSTRAINT pk_sfa_penjualan_id PRIMARY KEY (uuid, notransaksi)
);

CREATE TABLE IF NOT EXISTS sfa_penjualandetail (
    uuid VARCHAR(36) NOT NULL,
    notransaksi VARCHAR(50) NOT NULL,
    idproduk VARCHAR(50),
    qty DECIMAL(18, 1),
    harga DECIMAL(18, 0),
    diskon DECIMAL(18, 0),
    netto DECIMAL(18, 0),
    CONSTRAINT pk_sfa_penjualandetail_id PRIMARY KEY (uuid, notransaksi)
);

CREATE TABLE IF NOT EXISTS sfa_piutang (
    uuid VARCHAR(36) NOT NULL,
    notransaksi VARCHAR(50) NOT NULL,
    nopiutang VARCHAR(50),
    idsales INTEGER,
    idpelanggan VARCHAR(50),
    idalasan VARCHAR(20),
    tanggaltransaksi TIMESTAMP,
    tanggalinvoice DATE,
    tanggaljatuhtempo DATE,
    jumlahpiutang DECIMAL(18, 2),
    sisapiutang DECIMAL(18, 2),
    status_pembayaran INTEGER,
    status_piutang INTEGER,
    id_depo VARCHAR(50),
    CONSTRAINT pk_sfa_piutang_id PRIMARY KEY (uuid, notransaksi)
);

CREATE TABLE IF NOT EXISTS sfa_piutangdetail (
    uuid VARCHAR(36) NOT NULL,
    notransaksi VARCHAR(50) NOT NULL,
    nopiutang VARCHAR(50),
    nopembayaran VARCHAR(50),
    id_metode_bayar_config VARCHAR(20),
    id_metode_bayar INTEGER,
    norefrensi VARCHAR(50),
    tanggal DATE,
    jumlah DECIMAL(18, 2),
    CONSTRAINT pk_sfa_piutangdetail_id PRIMARY KEY (uuid, notransaksi)
);

CREATE TABLE IF NOT EXISTS sfa_register_pelanggan (
    uuid VARCHAR(36) NOT NULL,
    tanggal_register TIMESTAMP NOT NULL,
    id_company INTEGER,
    id_depo VARCHAR(50),
    nama_pelanggan VARCHAR(50),
    alamat VARCHAR(100),
    jenis_outlet INTEGER,
    id_prov INTEGER,
    id_kota INTEGER,
    id_kecamatan INTEGER,
    id_kelurahan INTEGER,
    status INTEGER,
    tanggal_validasi TIMESTAMP,
    validator VARCHAR(20),
    surveyor VARCHAR(20),
    catatan VARCHAR(1000),
    CONSTRAINT pk_sfa_register_pelanggan_id PRIMARY KEY (uuid)
);

CREATE TABLE IF NOT EXISTS sfa_sisastokpelanggan (
    idpelanggan VARCHAR(30),
    idsales VARCHAR(24),
    notransaksi VARCHAR(50) NOT NULL,
    tanggal DATE,
    id_depo VARCHAR(50),
    idspv VARCHAR(50),
    id_tl VARCHAR(50),
    CONSTRAINT pk_sfa_sisastokpelanggan_id PRIMARY KEY (notransaksi)
);

CREATE TABLE IF NOT EXISTS sfa_sisastokpelanggandetail (
    notransaksi VARCHAR(50) NOT NULL,
    uuid VARCHAR(36) NOT NULL,
    status INTEGER,
    iditemproduk VARCHAR(20),
    qty DECIMAL(18, 2),
    CONSTRAINT pk_sfa_sisastokpelanggandetail_id PRIMARY KEY (notransaksi, uuid)
);

CREATE TABLE IF NOT EXISTS sfa_stok (
    dono VARCHAR(36) NOT NULL,
    id_company INTEGER DEFAULT 1 NOT NULL,
    id_depo VARCHAR(50),
    idsales INTEGER,
    tanggal DATE,
    validator_spv INTEGER,
    validasi_spv INTEGER,
    status INTEGER,
    cek_box INTEGER,
    id_cek_box_validator INTEGER,
    CONSTRAINT pk_sfa_stok_id PRIMARY KEY (dono)
);

CREATE TABLE IF NOT EXISTS sfa_stokdetail (
    dono VARCHAR(36) NOT NULL,
    uuid VARCHAR(36) NOT NULL,
    idproduk VARCHAR(50),
    qtyawal DECIMAL(18, 2) DEFAULT 0,
    qtydo DECIMAL(18, 2) DEFAULT 0,
    qtyretur DECIMAL(18, 2) DEFAULT 0,
    keluar DECIMAL(18, 2) DEFAULT 0,
    id_kategori INTEGER,
    CONSTRAINT pk_sfa_stokdetail_id PRIMARY KEY (dono, uuid)
);

CREATE TABLE IF NOT EXISTS sfa_transgudang (
    id INTEGER NOT NULL,
    notransaksi VARCHAR(50) NOT NULL,
    tipe_transaksi INTEGER,
    tanggal TIMESTAMP,
    sumber VARCHAR(20),
    tujuan VARCHAR(20),
    keterangan VARCHAR(200)
);

CREATE TABLE IF NOT EXISTS sfa_transgudangdetail (
    id INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    idproduk VARCHAR(20),
    qty NUMERIC(18, 1) NOT NULL,
    unit VARCHAR(20)
);

-- Foreign Keys --
ALTER TABLE master_user_permissions_detail ADD CONSTRAINT fk_fk_perm_detail_parent FOREIGN KEY (permission_id) REFERENCES master_user_permissions (id);
ALTER TABLE master_user_roles_permissions ADD CONSTRAINT fk_fk_roles_permissions_role FOREIGN KEY (role_id) REFERENCES master_user_roles (id);