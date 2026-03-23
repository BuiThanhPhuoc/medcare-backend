-- Tạo bảng patients
CREATE TABLE IF NOT EXISTS patients (
  id INT(11) PRIMARY KEY AUTO_INCREMENT,
  user_id INT(11) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar VARCHAR(255),
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  address VARCHAR(255),
  medical_history TEXT,
  allergies VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Di chuyển dữ liệu từ users sang patients (nếu chưa có)
INSERT IGNORE INTO patients (user_id, full_name, avatar)
SELECT id, full_name, avatar FROM users WHERE role = 'patient' AND id NOT IN (SELECT user_id FROM patients);
