-- Migration: Add profile columns to receptionists table
-- Purpose: Store full receptionist information (full_name, address, hire_date, status)

-- STEP 1: Rename avatar column to avatar_url and add missing columns
ALTER TABLE receptionists 
CHANGE COLUMN avatar avatar_url VARCHAR(255) DEFAULT NULL,
ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active',
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- STEP 2: Create indexes for performance
CREATE INDEX idx_receptionist_status ON receptionists(status);
CREATE INDEX idx_receptionist_user_id ON receptionists(user_id);
