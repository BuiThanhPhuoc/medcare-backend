-- Migration: Create reception_schedules table
-- Mục đích: Lưu lịch làm việc của Lễ tân (được gán bởi Admin)

CREATE TABLE IF NOT EXISTS reception_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    receptionist_id INT NOT NULL,
    work_date DATE NOT NULL COMMENT 'Ngày làm việc (yyyy-mm-dd)',
    shift ENUM('morning', 'afternoon') NOT NULL COMMENT 'Ca làm: sáng hoặc chiều',
    status ENUM('active', 'inactive') DEFAULT 'active' COMMENT 'Trạng thái lịch',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (receptionist_id) REFERENCES receptionists(id) ON DELETE CASCADE,
    UNIQUE KEY unique_receptionist_schedule (receptionist_id, work_date, shift),
    INDEX idx_receptionist (receptionist_id),
    INDEX idx_work_date (work_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm dữ liệu mẫu cho Lễ tân ID 1 (nếu cần test)
-- INSERT INTO reception_schedules (receptionist_id, work_date, shift, status) VALUES
-- (1, '2026-03-20', 'morning', 'active'),
-- (1, '2026-03-20', 'afternoon', 'active'),
-- (1, '2026-03-21', 'morning', 'active');
