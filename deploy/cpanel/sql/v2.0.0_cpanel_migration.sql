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
-- ۷. ثبت نقش‌های سیستمی (مدیر ارشد، مدیر، کارمند فروش، نصاب) در جدول roles
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `roles` (`name`, `guard_name`, `created_at`, `updated_at`) VALUES
    ('administrator', 'web', NOW(), NOW()),
    ('manager', 'web', NOW(), NOW()),
    ('salesperson', 'web', NOW(), NOW()),
    ('installer', 'web', NOW(), NOW());
