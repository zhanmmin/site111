CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(80) NOT NULL DEFAULT '网站管理员',
  role ENUM('super_admin', 'operator', 'reviewer') NOT NULL DEFAULT 'operator',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_users_email (email),
  KEY idx_admin_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NULL,
  bio TEXT NULL,
  status ENUM('active', 'suspended', 'pending') NOT NULL DEFAULT 'active',
  verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  last_active_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_creator_users_email (email),
  KEY idx_creator_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS creator_settings (
  creator_id BIGINT UNSIGNED NOT NULL,
  security_json JSON NOT NULL,
  payout_provider VARCHAR(40) NOT NULL DEFAULT 'wechat',
  payout_account_masked VARCHAR(80) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (creator_id),
  CONSTRAINT fk_creator_settings_creator FOREIGN KEY (creator_id) REFERENCES creator_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  creator_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('processing', 'paid', 'failed') NOT NULL DEFAULT 'processing',
  method VARCHAR(40) NOT NULL DEFAULT '微信支付',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_payouts_creator FOREIGN KEY (creator_id) REFERENCES creator_users (id) ON DELETE CASCADE,
  KEY idx_payouts_creator_requested (creator_id, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contents (
  id VARCHAR(32) NOT NULL,
  creator_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  mode ENUM('image', 'dual', 'link', 'sensitive') NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  access_rule ENUM('window', 'once', 'two_hours') NOT NULL DEFAULT 'window',
  note TEXT NULL,
  link_content TEXT NULL,
  text_content LONGTEXT NULL,
  sensitive_text LONGTEXT NULL,
  status ENUM('draft', 'pending', 'approved', 'rejected', 'unpublished') NOT NULL DEFAULT 'draft',
  risk_level ENUM('low', 'review', 'high') NOT NULL DEFAULT 'low',
  rejection_reason VARCHAR(255) NULL,
  published_at DATETIME NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_contents_creator FOREIGN KEY (creator_id) REFERENCES creator_users (id),
  KEY idx_contents_status_submitted (status, submitted_at),
  KEY idx_contents_creator (creator_id),
  KEY idx_contents_risk (risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id VARCHAR(32) NOT NULL,
  slot ENUM('primary', 'secondary') NOT NULL DEFAULT 'primary',
  original_url TEXT NULL,
  preview_url TEXT NULL,
  original_blob MEDIUMBLOB NULL,
  preview_blob MEDIUMBLOB NULL,
  mime_type VARCHAR(100) NULL,
  file_size BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_content_assets_content FOREIGN KEY (content_id) REFERENCES contents (id) ON DELETE CASCADE,
  UNIQUE KEY uk_content_assets_slot (content_id, slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(40) NOT NULL,
  content_id VARCHAR(32) NOT NULL,
  creator_id BIGINT UNSIGNED NOT NULL,
  buyer_name VARCHAR(100) NOT NULL,
  buyer_email VARCHAR(190) NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_provider VARCHAR(40) NOT NULL DEFAULT 'mock',
  status ENUM('pending', 'paid', 'refunded', 'settled', 'failed') NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  settled_at DATETIME NULL,
  access_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_orders_order_no (order_no),
  CONSTRAINT fk_orders_content FOREIGN KEY (content_id) REFERENCES contents (id),
  CONSTRAINT fk_orders_creator FOREIGN KEY (creator_id) REFERENCES creator_users (id),
  KEY idx_orders_status_created (status, created_at),
  KEY idx_orders_creator (creator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS access_grants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  content_id VARCHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_access_grants_token_hash (token_hash),
  CONSTRAINT fk_access_grants_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_access_grants_content FOREIGN KEY (content_id) REFERENCES contents (id) ON DELETE CASCADE,
  KEY idx_access_grants_content (content_id),
  KEY idx_access_grants_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  content_id VARCHAR(32) NULL,
  reporter_name VARCHAR(100) NULL,
  reason VARCHAR(255) NOT NULL,
  detail TEXT NULL,
  priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
  status ENUM('open', 'processing', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_reports_content FOREIGN KEY (content_id) REFERENCES contents (id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_admin FOREIGN KEY (resolved_by) REFERENCES admin_users (id) ON DELETE SET NULL,
  KEY idx_reports_status_priority (status, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  value_type ENUM('boolean', 'number', 'string', 'json') NOT NULL DEFAULT 'string',
  description VARCHAR(255) NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_platform_settings_admin FOREIGN KEY (updated_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(80) NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_audit_logs_admin FOREIGN KEY (admin_user_id) REFERENCES admin_users (id) ON DELETE SET NULL,
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_resource (resource_type, resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
