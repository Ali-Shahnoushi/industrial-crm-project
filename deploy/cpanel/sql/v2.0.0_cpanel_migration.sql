-- =====================================================================
--  Industrial CRM — اسکریپت ارتقای امن دیتابیس به نسخه v2.0.0
--  قابل اجرا در phpMyAdmin هاست cPanel (سازگار با MySQL 8.x و MariaDB 10.x+)
--  تضمین Zero Data Loss: هیچ جدول یا اطلاعاتی حذف نمی‌شود (Idempotent)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- ۱. جدول users: افزودن ستون customer_scope برای مدیریت دسترسی کارمندان
-- ---------------------------------------------------------------------
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'customer_scope'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `customer_scope` VARCHAR(30) NOT NULL DEFAULT ''all'' AFTER `user_type`',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- ۲. جدول customers: اختیاری کردن نام، نام خانوادگی و موبایل + ثبت ایجادکننده
-- ---------------------------------------------------------------------
ALTER TABLE `customers`
    MODIFY COLUMN `first_name` VARCHAR(255) NULL,
    MODIFY COLUMN `last_name` VARCHAR(255) NULL,
    MODIFY COLUMN `mobile` VARCHAR(255) NULL;

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME = 'created_by_user_id'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE `customers` ADD COLUMN `created_by_user_id` BIGINT UNSIGNED NULL AFTER `id`, ADD INDEX `customers_created_by_user_id_index` (`created_by_user_id`), ADD CONSTRAINT `customers_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- بازیابی خودکار کارمند ثبت‌کننده مشتریان قبلی از جدول تاریخچه (Zero Data Loss)
UPDATE `customers` c
INNER JOIN (
    SELECT `customer_id`, MIN(`id`) AS `first_history_id`
    FROM `customer_histories`
    WHERE `action` = 'created' AND `user_id` IS NOT NULL
    GROUP BY `customer_id`
) h_min ON h_min.`customer_id` = c.`id`
INNER JOIN `customer_histories` ch ON ch.`id` = h_min.`first_history_id`
SET c.`created_by_user_id` = ch.`user_id`
WHERE c.`created_by_user_id` IS NULL;

-- ---------------------------------------------------------------------
-- ۳. جداول استثناهای سطح دسترسی مشتریان (کارمندان خاص / مشتریان خاص)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_customer_staff_grants` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `grantee_user_id` BIGINT UNSIGNED NOT NULL,
    `staff_user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `ucsg_grantee_staff_unique` (`grantee_user_id`, `staff_user_id`),
    KEY `ucsg_staff_user_idx` (`staff_user_id`),
    CONSTRAINT `ucsg_grantee_user_id_fk` FOREIGN KEY (`grantee_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `ucsg_staff_user_id_fk` FOREIGN KEY (`staff_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_customer_grants` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `grantee_user_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `ucg_grantee_customer_unique` (`grantee_user_id`, `customer_id`),
    KEY `ucg_customer_id_idx` (`customer_id`),
    CONSTRAINT `ucg_grantee_user_id_fk` FOREIGN KEY (`grantee_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `ucg_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ۴. جدول parts (دستگاه‌ها): افزودن ستون موجودی کل انبار (stock_quantity)
-- ---------------------------------------------------------------------
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'parts'
      AND COLUMN_NAME = 'stock_quantity'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE `parts` ADD COLUMN `stock_quantity` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `periodic_service_months`',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- ۵. جدول customer_parts: افزودن تعداد، مبلغ فاکتور و شماره فاکتور اختیاری
-- ---------------------------------------------------------------------
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customer_parts'
      AND COLUMN_NAME = 'quantity'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE `customer_parts` ADD COLUMN `quantity` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `serial_number`',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customer_parts'
      AND COLUMN_NAME = 'invoice_amount'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE `customer_parts` ADD COLUMN `invoice_amount` DECIMAL(18, 0) NULL DEFAULT NULL AFTER `quantity`',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customer_parts'
      AND COLUMN_NAME = 'invoice_number'
);
SET @sql := IF(
    @col_exists = 0,
    'ALTER TABLE `customer_parts` ADD COLUMN `invoice_number` VARCHAR(100) NULL DEFAULT NULL AFTER `invoice_amount`',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------
-- ۶. جدول part_inventory_logs: تاریخچه و لاگ کامل ورود و خروج انبار
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `part_inventory_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `part_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `customer_part_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `type` VARCHAR(40) NOT NULL,
    `quantity` INT UNSIGNED NOT NULL,
    `balance_before` INT UNSIGNED NOT NULL DEFAULT 0,
    `balance_after` INT UNSIGNED NOT NULL DEFAULT 0,
    `description` TEXT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `part_inventory_logs_type_index` (`type`),
    KEY `pil_part_created_idx` (`part_id`, `created_at`),
    KEY `pil_user_id_idx` (`user_id`),
    KEY `pil_customer_id_idx` (`customer_id`),
    KEY `pil_customer_part_id_idx` (`customer_part_id`),
    CONSTRAINT `pil_part_id_fk` FOREIGN KEY (`part_id`) REFERENCES `parts` (`id`) ON DELETE CASCADE,
    CONSTRAINT `pil_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `pil_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `pil_customer_part_id_fk` FOREIGN KEY (`customer_part_id`) REFERENCES `customer_parts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ۷. ثبت نقش‌های سیستمی (مدیر ارشد، مدیر، کارمند فروش، نصاب، مشتری پرتال) در جدول roles
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `roles` (`name`, `guard_name`, `created_at`, `updated_at`) VALUES
    ('administrator', 'web', NOW(), NOW()),
    ('manager', 'web', NOW(), NOW()),
    ('salesperson', 'web', NOW(), NOW()),
    ('installer', 'web', NOW(), NOW()),
    ('customer', 'web', NOW(), NOW());

-- ---------------------------------------------------------------------
-- ۸. ارتقای نسخه ۲.۲.۰ و ۲.۳.۰ (انبار، سریال اختیاری، تیکتینگ و پرتال مشتری)
-- ---------------------------------------------------------------------

-- ۸-الف) ستون‌های حداقل موجودی و واحد شمارش در جدول parts
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parts' AND COLUMN_NAME = 'min_stock'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE `parts` ADD COLUMN `min_stock` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `stock_quantity`',
    'SELECT "parts.min_stock already exists" AS status'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'parts' AND COLUMN_NAME = 'unit'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE `parts` ADD COLUMN `unit` VARCHAR(50) NOT NULL DEFAULT ''عدد'' AFTER `min_stock`',
    'SELECT "parts.unit already exists" AS status'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ۸-ب) اختیاری کردن شماره سریال دستگاه در جدول customer_parts
ALTER TABLE `customer_parts` MODIFY COLUMN `serial_number` VARCHAR(255) NULL;

-- ۸-ج) ستون‌های مدیر فروش و پرتال در جدول customers
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'sales_manager_user_id'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE `customers` ADD COLUMN `sales_manager_user_id` BIGINT UNSIGNED NULL AFTER `created_by_user_id`, ADD CONSTRAINT `customers_sales_manager_fk` FOREIGN KEY (`sales_manager_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL',
    'SELECT "customers.sales_manager_user_id already exists" AS status'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'portal_enabled'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE `customers` ADD COLUMN `portal_enabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `notes`',
    'SELECT "customers.portal_enabled already exists" AS status'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ۸-د) ستون ارتباط حساب پرتال مشتری در جدول users
SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'customer_id'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE `users` ADD COLUMN `customer_id` BIGINT UNSIGNED NULL AFTER `user_type`, ADD UNIQUE INDEX `users_customer_id_unique` (`customer_id`), ADD CONSTRAINT `users_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE',
    'SELECT "users.customer_id already exists" AS status'
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ۸-ه) جداول تیکتینگ (دپارتمان‌ها، اعضای دپارتمان، تیکت‌ها و پیام‌های تیکت)
CREATE TABLE IF NOT EXISTS `ticket_departments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ticket_department_user` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `department_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `ticket_dept_user_unique` (`department_id`, `user_id`),
    CONSTRAINT `tdu_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `ticket_departments` (`id`) ON DELETE CASCADE,
    CONSTRAINT `tdu_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tickets` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tracking_code` VARCHAR(32) NOT NULL,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `customer_part_id` BIGINT UNSIGNED NULL,
    `department_id` BIGINT UNSIGNED NULL,
    `created_by_user_id` BIGINT UNSIGNED NULL,
    `assigned_to_user_id` BIGINT UNSIGNED NULL,
    `subject` VARCHAR(255) NOT NULL,
    `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(30) NOT NULL DEFAULT 'open',
    `last_reply_at` TIMESTAMP NULL DEFAULT NULL,
    `closed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `tickets_tracking_code_unique` (`tracking_code`),
    KEY `tickets_status_priority_idx` (`status`, `priority`),
    KEY `tickets_customer_status_idx` (`customer_id`, `status`),
    CONSTRAINT `tickets_customer_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `tickets_cp_fk` FOREIGN KEY (`customer_part_id`) REFERENCES `customer_parts` (`id`) ON DELETE SET NULL,
    CONSTRAINT `tickets_dept_fk` FOREIGN KEY (`department_id`) REFERENCES `ticket_departments` (`id`) ON DELETE SET NULL,
    CONSTRAINT `tickets_creator_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `tickets_assignee_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ticket_messages` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `ticket_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NULL,
    `sender_type` VARCHAR(20) NOT NULL DEFAULT 'staff',
    `body` TEXT NOT NULL,
    `is_internal_note` TINYINT(1) NOT NULL DEFAULT 0,
    `attachment_path` VARCHAR(255) NULL,
    `attachment_name` VARCHAR(255) NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `ticket_messages_ticket_created_idx` (`ticket_id`, `created_at`),
    CONSTRAINT `tm_ticket_fk` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
    CONSTRAINT `tm_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ۸-و) مجوزهای جدید تیکتینگ (مجموعاً ۱۷ مجوز سیستمی)
INSERT IGNORE INTO `permissions` (`name`, `guard_name`, `created_at`, `updated_at`) VALUES
    ('tickets.view', 'web', NOW(), NOW()),
    ('tickets.reply', 'web', NOW(), NOW()),
    ('tickets.manage', 'web', NOW(), NOW());

