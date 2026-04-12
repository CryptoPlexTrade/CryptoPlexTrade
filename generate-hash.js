// c:\Users\GUYMAN-GH\STAGA\SC\generate-hash.js
const bcrypt = require('bcryptjs');

// Get the password from the command line arguments.
const password = process.argv[2];

if (!password) {
    console.error('Error: Please provide a password as an argument.');
    console.log('Usage: node generate-hash.js "your-new-password-here"');
    process.exit(1);
}

// Generate a salt and hash the password. This is the same method used in your registration code.
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Password successfully hashed!');
console.log('Copy the following hash to use in your SQL query:');
console.log(hash);
