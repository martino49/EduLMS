require('dotenv').config();
const { pool } = require('../config/database');

const tablesToDrop = [
  'system_settings',
  'announcements',
  'mpesa_errors',
  'mpesa_callbacks',
  'sms_logs',
  'audit_logs',
  'notifications',
  'payments',
  'fee_structures',
  'grades',
  'submissions',
  'assignments',
  'enrollments',
  'course_materials',
  'courses',
  'students',
  'users',
  'roles'
];

const tables = [
  // 1. Roles
  `CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2. Users (Consistent with User.js model)
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role_id INT NOT NULL,
    student_id VARCHAR(50),
    teacher_id VARCHAR(50),
    employee_id VARCHAR(50),
    gender ENUM('male', 'female', 'other'),
    date_of_birth DATE, -- Consistent with User.js
    address TEXT,
    city VARCHAR(100),
    profile_image VARCHAR(255),
    admission_date DATE,
    department VARCHAR(100),
    qualification TEXT,
    specialization VARCHAR(255),
    hire_date DATE,
    parent_name VARCHAR(255),
    parent_phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active',
    is_active TINYINT(1) DEFAULT 1,
    email_verified TINYINT(1) DEFAULT 0,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    INDEX idx_users_status (status),
    INDEX idx_users_role_status (role_id, status)
  )`,

  // 3. Students (Bookkeeping table for Mpesa and other services)
  `CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    fee_balance DECIMAL(10, 2) DEFAULT 0.00,
    academic_year VARCHAR(20),
    semester VARCHAR(20),
    current_level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // 4. Courses
  `CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    teacher_id INT NOT NULL,
    instructor_id INT,
    credits INT DEFAULT 3,
    department VARCHAR(100),
    category VARCHAR(100),
    status ENUM('pending', 'active', 'inactive', 'completed') DEFAULT 'pending',
    start_date DATE,
    end_date DATE,
    price DECIMAL(10, 2) DEFAULT 0.00,
    course_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    FOREIGN KEY (instructor_id) REFERENCES users(id),
    INDEX idx_courses_status (status),
    INDEX idx_courses_teacher_status (teacher_id, status)
  )`,

  // 5. Course Materials
  `CREATE TABLE IF NOT EXISTS course_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_type VARCHAR(50),
    file_path VARCHAR(255),
    file_size INT,
    is_external TINYINT(1) DEFAULT 0,
    external_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`,

  // 6. Enrollments
  `CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'completed', 'dropped') DEFAULT 'active',
    grade VARCHAR(5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    UNIQUE KEY (student_id, course_id)
  )`,

  // 7. Assignments
  `CREATE TABLE IF NOT EXISTS assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    teacher_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATETIME,
    max_points INT DEFAULT 100,
    submission_type ENUM('text', 'file', 'both') DEFAULT 'both',
    file_path VARCHAR(255),
    status ENUM('draft', 'published', 'closed') DEFAULT 'draft',
    max_file_size INT DEFAULT 10485760,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    INDEX idx_assignments_course_status (course_id, status),
    INDEX idx_assignments_duedate (due_date)
  )`,

  // 8. Submissions
  `CREATE TABLE IF NOT EXISTS submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    submission_text TEXT,
    file_path VARCHAR(255),
    file_name VARCHAR(255),
    file_size INT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('submitted', 'graded', 'late') DEFAULT 'submitted',
    is_late TINYINT(1) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    INDEX idx_submissions_status (status),
    INDEX idx_submissions_student_assign (student_id, assignment_id)
  )`,

  // 9. Grades
  `CREATE TABLE IF NOT EXISTS grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT,
    assignment_id INT NOT NULL,
    student_id INT NOT NULL,
    teacher_id INT NOT NULL,
    points_earned DECIMAL(5, 2),
    max_points INT,
    grade VARCHAR(5),
    feedback TEXT,
    grade_points DECIMAL(3, 2),
    graded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  )`,

  // 10. Fee Structures
  `CREATE TABLE IF NOT EXISTS fee_structures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    fee_type VARCHAR(50),
    academic_year VARCHAR(20),
    semester VARCHAR(20),
    due_date DATE,
    created_by INT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,

  // 11. Payments
  `CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    fee_structure_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_reference VARCHAR(100),
    mpesa_receipt VARCHAR(50),
    checkout_request_id VARCHAR(100),
    merchant_request_id VARCHAR(100),
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    payment_date DATETIME,
    verified_by VARCHAR(100), -- Can be 'system' or user ID
    verified_at DATETIME,
    payer_phone VARCHAR(20),
    failure_reason TEXT,
    failed_at DATETIME,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (fee_structure_id) REFERENCES fee_structures(id),
    INDEX idx_payments_status_date (status, payment_date),
    INDEX idx_payments_student (student_id)
  )`,

  // 12. Notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'error', 'success') DEFAULT 'info',
    status ENUM('unread', 'read') DEFAULT 'unread',
    related_id INT,
    related_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_notifications_user_status (user_id, status)
  )`,

  // 13. Audit Logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    table_name VARCHAR(100),
    record_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // 14. SMS Logs
  `CREATE TABLE IF NOT EXISTS sms_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    message TEXT,
    provider VARCHAR(50),
    success TINYINT(1),
    message_id VARCHAR(100),
    error TEXT,
    sent_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 15. Mpesa Callbacks
  `CREATE TABLE IF NOT EXISTS mpesa_callbacks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    callback_data JSON,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 16. Mpesa Errors
  `CREATE TABLE IF NOT EXISTS mpesa_errors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    error_type VARCHAR(100),
    error_message TEXT,
    context JSON,
    occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 17. Announcements
  `CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type ENUM('general', 'academic', 'financial', 'urgent') DEFAULT 'general',
    audience ENUM('all', 'students', 'instructors', 'staff') DEFAULT 'all',
    created_by INT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`,

  // 18. System Settings
  `CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`
];

async function migrate() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('--- Starting Database Migration ---');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tablesToDrop) {
      await connection.query(`DROP TABLE IF EXISTS ${table}`);
      console.log(`🗑️  Dropped table: ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const sql of tables) {
      await connection.query(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
      console.log(`✅ Created table: ${tableName}`);
    }

    console.log('--- Migration Completed Successfully ---');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

migrate();
