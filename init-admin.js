#!/usr/bin/env node
/**
 * Initialize admin account
 * Run this after the first user registers with the desired admin email
 * Usage: node init-admin.js
 */

const readline = require('readline');
const { getDb } = require('./db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function main() {
  try {
    // Get admin email from user input
    const adminEmail = await prompt('Enter the admin email address: ');

    if (!adminEmail || !adminEmail.includes('@')) {
      console.log('❌ Invalid email address.\n');
      process.exit(1);
    }

    const db = getDb();

    // Find the user with the provided email
    const user = db.prepare(`
      SELECT id, name, email FROM users WHERE email = ?
    `).get(adminEmail);

    if (!user) {
      console.log(`❌ User ${adminEmail} not found.`);
      console.log('   Please register that account first.\n');
      process.exit(1);
    }

    // Check if already admin
    const existing = db.prepare('SELECT id FROM admins WHERE user_id = ?').get(user.id);
    if (existing) {
      console.log('✅ User is already an admin!\n');
      process.exit(0);
    }

    // Make them admin
    db.prepare(`
      INSERT INTO admins (user_id, role, permissions)
      VALUES (?, ?, ?)
    `).run(user.id, 'admin', JSON.stringify({ all: true }));

    console.log(`\n✅ Success! ${user.name} (${user.email}) is now an admin.\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
