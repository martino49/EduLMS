const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: isProduction ? 50 : 20,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
  multipleStatements: isDevelopment,
  connectTimeout: 60000,

  // Production-specific settings
  ...(isProduction && {
    ssl: { rejectUnauthorized: true },
    multipleStatements: false,
  }),

  // Development-specific settings
  ...(isDevelopment && {
    debug: false,
  })
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection was closed.');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
    console.log('Database has too many connections.');
  }
  if (err.code === 'ECONNREFUSED') {
    console.log('Database connection was refused.');
  }
});

// Create database schema if it doesn't exist
const createDatabaseSchema = async () => {
  let connection;
  try {
    // Get connection without specific database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    const dbName = process.env.DB_NAME;

    // Use regular query instead of execute for schema operations
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database '${dbName}' ensured`);

    // Switch to the database using query
    await connection.query(`USE \`${dbName}\``);

    // Create tables
    await createTables(connection);

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Database schema creation failed:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

// Create all necessary tables using query instead of execute
const createTables = async (connection) => {
  await connection.query('SET FOREIGN_KEY_CHECKS = 0');

  // Roles table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
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
      date_of_birth DATE,
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
    )
  `);

  // Students table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS students (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNIQUE NOT NULL,
      fee_balance DECIMAL(10, 2) DEFAULT 0.00,
      academic_year VARCHAR(20),
      semester VARCHAR(20),
      current_level VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Courses table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS courses (
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
      duration INT DEFAULT 12,
      max_students INT DEFAULT 50,
      academic_year VARCHAR(20),
      semester VARCHAR(10),
      syllabus TEXT,
      requirements TEXT,
      learning_outcomes TEXT,
      fee_amount DECIMAL(10, 2) DEFAULT 0.00,
      course_image VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      FOREIGN KEY (instructor_id) REFERENCES users(id),
      INDEX idx_courses_status (status),
      INDEX idx_courses_teacher_status (teacher_id, status)
    )
  `);

  // Course Materials table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS course_materials (
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
    )
  `);

  // Enrollments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS enrollments (
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
    )
  `);

  // Assignments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS assignments (
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
    )
  `);

  // Submissions table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS submissions (
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
    )
  `);

  // Grades table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS grades (
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
    )
  `);

  // Payments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS payments (
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
    )
  `);

  // Fee structures table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS fee_structures (
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
    )
  `);

  // Notifications table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
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
    )
  `);

  // Audit logs table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
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
    )
  `);

  // SMS Logs table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      message TEXT,
      provider VARCHAR(50),
      success TINYINT(1),
      message_id VARCHAR(100),
      error TEXT,
      sent_at DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Mpesa Callbacks table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS mpesa_callbacks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      callback_data JSON,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Mpesa Errors table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS mpesa_errors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      error_type VARCHAR(100),
      error_message TEXT,
      context JSON,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Announcements table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcements (
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
    )
  `);

  // System Settings table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('✅ All tables created successfully');
};

// Initialize database with sample data
const initializeDatabase = async () => {
  try {
    await createDatabaseSchema();

    // Check if we need to add sample data
    const [users] = await pool.execute('SELECT COUNT(*) as count FROM users');

    if (users[0].count === 0) {
      await addSampleData();
    }

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't throw error to prevent app crash, just log it
  }
};

// Add sample data
const addSampleData = async () => {
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    await pool.execute(
      `INSERT INTO users (name, email, password, role_id, employee_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Admin User', 'admin@edulms.com', hashedPassword, 1, 'EMP001', 1]
    );

    console.log('✅ Sample admin user created: admin@edulms.com / admin123');

    // Add more sample data as needed
    await pool.execute(
      `INSERT INTO users (name, email, password, role_id, student_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['John Student', 'student@edulms.com', hashedPassword, 2, 'STU2024001', 1]
    );

    await pool.execute(
      `INSERT INTO users (name, email, password, role_id, teacher_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Jane Instructor', 'instructor@edulms.com', hashedPassword, 3, 'INS2024001', 1]
    );

    console.log('✅ Sample users created');

  } catch (error) {
    console.error('❌ Error adding sample data:', error);
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const [result] = await pool.query('SELECT 1 as health_check');
    return { healthy: true, timestamp: new Date() };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date()
    };
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('🛑 Received shutdown signal, closing database pool...');

  try {
    await pool.end();
    console.log('✅ Database pool closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
    process.exit(1);
  }
};

// Handle various shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon

// Transaction helper
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Enhanced query with timeout
const queryWithTimeout = async (sql, params = [], timeoutMs = 30000) => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`SET SESSION max_execution_time = ${timeoutMs}`);
    const [result] = await connection.query(sql, params);
    return result;
  } finally {
    connection.release();
  }
};

// Safe initialization tool
const safeInitialize = async () => {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Initialization error (non-fatal):', error.message);
  }
};

module.exports = {
  pool,
  checkDatabaseHealth,
  initializeDatabase: safeInitialize,
  gracefulShutdown,
  transaction,
  queryWithTimeout
};