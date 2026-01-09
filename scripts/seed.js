require('dotenv').config();
const { pool } = require('../config/database');

const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

async function seed() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('--- Starting Database Seeding ---');

        // 1. Seed Roles - Match exact names in config/constants.js
        const roles = [
            [ROLES.ADMIN, 'Full system access and management'],
            [ROLES.INSTRUCTOR, 'Course management and instruction'],
            [ROLES.STUDENT, 'Access to courses and learning materials'],
            [ROLES.FINANCE_OFFICER, 'Financial management and fee processing']
        ];

        for (const [name, description] of roles) {
            await connection.query(
                'INSERT INTO roles (name, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description = ?',
                [name, description, description]
            );
            console.log(`👤 Seeded role: ${name}`);
        }

        // 2. Seed Admin User
        const adminEmail = 'admin@edulms.com';
        const adminPassword = 'admin123';
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

        // Get admin role ID
        const [roleRows] = await connection.query('SELECT id FROM roles WHERE name = ?', [ROLES.ADMIN]);
        const adminRoleId = roleRows[0].id;

        // Check if admin already exists
        const [userRows] = await connection.query('SELECT id FROM users WHERE email = ?', [adminEmail]);

        if (userRows.length === 0) {
            await connection.query(
                `INSERT INTO users (name, email, password, role_id, is_active, email_verified) 
         VALUES (?, ?, ?, ?, 1, 1)`,
                ['System Admin', adminEmail, hashedPassword, adminRoleId]
            );
            console.log(`👑 Created admin user: ${adminEmail}`);
        } else {
            console.log('ℹ️ Admin user already exists');
        }

        // 3. Seed some system settings
        const settings = [
            ['site_name', 'EduLMS', 'The name of the application'],
            ['allow_registration', 'true', 'Whether to allow new student self-registration'],
            ['currency', 'KES', 'Base currency for financial transactions']
        ];

        for (const [key, value, desc] of settings) {
            await connection.query(
                'INSERT INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [key, value, desc, value]
            );
        }
        console.log('⚙️  Seeded system settings');

        console.log('--- Seeding Completed Successfully ---');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

seed();
