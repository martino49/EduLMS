require('dotenv').config();
const { pool } = require('../config/database');

async function optimizeDatabase() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('--- Starting Database Optimization ---');

        // List of indexes to create
        // Using try-catch for each individual index to avoid failure if it already exists
        const indexOperations = [
            {
                table: 'users',
                name: 'idx_users_role_status',
                sql: 'CREATE INDEX idx_users_role_status ON users(role_id, status)'
            },
            {
                table: 'users',
                name: 'idx_users_email', // Usually unique constraint covers this, but explicit index doesn't hurt if missing
                sql: 'CREATE INDEX idx_users_email_search ON users(email)'
            },
            {
                table: 'courses',
                name: 'idx_courses_status',
                sql: 'CREATE INDEX idx_courses_status ON courses(status)'
            },
            {
                table: 'courses',
                name: 'idx_courses_teacher',
                sql: 'CREATE INDEX idx_courses_teacher ON courses(teacher_id)'
            },
            {
                table: 'assignments',
                name: 'idx_assignments_course_status',
                sql: 'CREATE INDEX idx_assignments_course_status ON assignments(course_id, status)'
            },
            {
                table: 'submissions',
                name: 'idx_submissions_student_assign',
                sql: 'CREATE INDEX idx_submissions_student_assign ON submissions(student_id, assignment_id)'
            },
            {
                table: 'payments',
                name: 'idx_payments_status_date',
                sql: 'CREATE INDEX idx_payments_status_date ON payments(status, payment_date)'
            },
            {
                table: 'payments',
                name: 'idx_payments_student',
                sql: 'CREATE INDEX idx_payments_student ON payments(student_id)'
            },
            {
                table: 'notifications',
                name: 'idx_notifications_user_status',
                sql: 'CREATE INDEX idx_notifications_user_status ON notifications(user_id, status)'
            },
            {
                table: 'audit_logs',
                name: 'idx_audit_user_date',
                sql: 'CREATE INDEX idx_audit_user_date ON audit_logs(user_id, created_at)'
            }
        ];

        for (const op of indexOperations) {
            try {
                // Check if index exists first to avoid error spam
                const [rows] = await connection.query(
                    `SHOW INDEX FROM ${op.table} WHERE Key_name = ?`,
                    [op.name]
                );

                if (rows.length === 0) {
                    await connection.query(op.sql);
                    console.log(`✅ Created index: ${op.name} on ${op.table}`);
                } else {
                    console.log(`ℹ️  Index already exists: ${op.name} on ${op.table}`);
                }
            } catch (err) {
                // Warning instead of error to continue with others
                if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_INDEX_ALREADY_EXISTS') {
                    console.log(`ℹ️  Index already exists (caught error): ${op.name} on ${op.table}`);
                } else {
                    console.warn(`⚠️  Failed to create index ${op.name}: ${err.message}`);
                }
            }
        }

        console.log('--- Database Optimization Completed ---');

    } catch (error) {
        console.error('❌ Optimization failed:', error);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

optimizeDatabase();
