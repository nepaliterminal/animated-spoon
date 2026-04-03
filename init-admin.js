#!/usr/bin/env node
/**
 * Initialize admin account for prankes1332@gmail.com
 * Run this after the first user registers with that email
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
    const db = getDb();

    // Find the user with email prankes1332@gmail.com
    const user = db.prepare(`
      SELECT id, name, email FROM users WHERE email = ?
    `).get('prankes1332@gmail.com');

    if (!user) {
      console.log('❌ User prankes1332@gmail.com not found.');
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
