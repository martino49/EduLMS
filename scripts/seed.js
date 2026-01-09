require('dotenv').config();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    console.log('🌱 Starting database seeding (3 samples per table)...\n');

    try {
        // Clear existing data (in reverse order of dependencies)
        console.log('🗑️  Clearing existing data...');
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');

        const tables = [
            'system_settings', 'announcements', 'mpesa_errors', 'mpesa_callbacks',
            'sms_logs', 'audit_logs', 'notifications', 'payments', 'fee_structures',
            'grades', 'submissions', 'assignments', 'enrollments', 'course_materials',
            'courses', 'students', 'users', 'roles'
        ];

        for (const table of tables) {
            await pool.query(`TRUNCATE TABLE ${table}`);
        }

        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✅ Existing data cleared\n');

        // 1. Seed Roles
        console.log('🔑 Seeding roles...');
        const roles = [
            { id: 1, name: 'admin', description: 'System Administrator' },
            { id: 2, name: 'student', description: 'Student User' },
            { id: 3, name: 'instructor', description: 'Course Instructor' }
        ];

        for (const role of roles) {
            await pool.query(
                'INSERT INTO roles (id, name, description) VALUES (?, ?, ?)',
                [role.id, role.name, role.description]
            );
        }
        console.log('✅ Seeded 3 roles\n');

        // 2. Seed Users
        console.log('👥 Seeding users...');
        const hashedPassword = await bcrypt.hash('password123', 10);
        const users = [
            { id: 1, name: 'Main Admin', email: 'admin@edulms.com', role_id: 1, employee_id: 'EMP001' },
            { id: 2, name: 'John Student', email: 'student@edulms.com', role_id: 2, student_id: 'STU001' },
            { id: 3, name: 'Jane Instructor', email: 'instructor@edulms.com', role_id: 3, teacher_id: 'INS001' }
        ];

        for (const user of users) {
            await pool.query(
                `INSERT INTO users (id, name, email, password, role_id, student_id, teacher_id, employee_id, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [user.id, user.name, user.email, hashedPassword, user.role_id, user.student_id || null, user.teacher_id || null, user.employee_id || null]
            );
        }
        console.log('✅ Seeded 3 users\n');

        // 3. Seed Students (Bookkeeping)
        console.log('👨‍🎓 Seeding student record...');
        await pool.query(
            'INSERT INTO students (user_id, fee_balance, academic_year, semester, current_level) VALUES (?, ?, ?, ?, ?)',
            [2, 5000.00, '2024/2025', 'Semester 1', 'Year 1']
        );
        console.log('✅ Seeded 1 student bookkeeping record (linked to John Student)\n');

        // 4. Seed Courses
        console.log('📚 Seeding courses...');
        const courses = [
            { id: 1, code: 'CS101', title: 'Introduction to Computer Science', teacher_id: 3 },
            { id: 2, code: 'MATH201', title: 'Advanced Calculus', teacher_id: 3 },
            { id: 3, code: 'ENG102', title: 'Technical Writing', teacher_id: 3 }
        ];

        for (const course of courses) {
            await pool.query(
                'INSERT INTO courses (id, course_code, title, teacher_id, fee_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
                [course.id, course.code, course.title, course.teacher_id, 1000.00, 'active']
            );
        }
        console.log('✅ Seeded 3 courses\n');

        // 5. Seed Enrollments
        console.log('📝 Seeding enrollments...');
        for (let i = 1; i <= 3; i++) {
            await pool.query(
                'INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, ?)',
                [2, i, 'active']
            );
        }
        console.log('✅ Seeded 3 enrollments for John Student\n');

        // 6. Seed Assignments
        console.log('📋 Seeding assignments...');
        const assignments = [
            { id: 1, course_id: 1, title: 'First Coding Project' },
            { id: 2, course_id: 2, title: 'Calculus Problem Set' },
            { id: 3, course_id: 3, title: 'Writing Assignment 1' }
        ];

        for (const ass of assignments) {
            await pool.query(
                'INSERT INTO assignments (id, course_id, teacher_id, title, max_points, status) VALUES (?, ?, ?, ?, ?, ?)',
                [ass.id, ass.course_id, 3, ass.title, 100, 'published']
            );
        }
        console.log('✅ Seeded 3 assignments\n');

        // 7. Seed Submissions
        console.log('📤 Seeding submissions...');
        for (let i = 1; i <= 3; i++) {
            await pool.query(
                'INSERT INTO submissions (id, assignment_id, student_id, submission_text, status) VALUES (?, ?, ?, ?, ?)',
                [i, i, 2, 'Sample submission text for assignment ' + i, 'submitted']
            );
        }
        console.log('✅ Seeded 3 submissions\n');

        // 8. Seed Grades
        console.log('⭐ Seeding grades...');
        for (let i = 1; i <= 2; i++) { // Grade first 2
            await pool.query(
                'INSERT INTO grades (submission_id, assignment_id, student_id, teacher_id, points_earned, grade) VALUES (?, ?, ?, ?, ?, ?)',
                [i, i, 2, 3, 85 + i, 'A']
            );
        }
        console.log('✅ Seeded 2 grades\n');

        // 9. Seed Fee Structures
        console.log('💰 Seeding fee structures...');
        const fees = [
            { id: 1, name: 'Tuition Fee', amount: 3000.00 },
            { id: 2, name: 'Library Fee', amount: 500.00 },
            { id: 3, name: 'Identity Card', amount: 200.00 }
        ];

        for (const fee of fees) {
            await pool.query(
                'INSERT INTO fee_structures (id, name, amount, academic_year, semester, created_by) VALUES (?, ?, ?, ?, ?, ?)',
                [fee.id, fee.name, fee.amount, '2024/2025', 'Semester 1', 1]
            );
        }
        console.log('✅ Seeded 3 fee structures\n');

        // 10. Seed Payments
        console.log('💸 Seeding payments...');
        for (let i = 1; i <= 3; i++) {
            await pool.query(
                'INSERT INTO payments (student_id, fee_structure_id, amount, status, payment_method) VALUES (?, ?, ?, ?, ?)',
                [2, i, 100 * i, 'completed', 'M-Pesa']
            );
        }
        console.log('✅ Seeded 3 payments\n');

        // 11. Seed Notifications
        console.log('🔔 Seeding notifications...');
        for (let i = 1; i <= 3; i++) {
            await pool.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
                [2, 'System Notification ' + i, 'This is a sample notification number ' + i, 'info']
            );
        }
        console.log('✅ Seeded 3 notifications\n');

        // 12. Seed Announcements
        console.log('📢 Seeding announcements...');
        for (let i = 1; i <= 3; i++) {
            await pool.query(
                'INSERT INTO announcements (title, content, type, audience, created_by) VALUES (?, ?, ?, ?, ?)',
                ['Announcement ' + i, 'Important update number ' + i, 'general', 'all', 1]
            );
        }
        console.log('✅ Seeded 3 announcements\n');

        console.log('🎉 Database seeding completed successfully!\n');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        await pool.end();
        process.exit(0);
    }
}

seedDatabase();
