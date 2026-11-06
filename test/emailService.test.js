const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAdminRecipientList } = require('../emailService');

test('buildAdminRecipientList keeps a configured admin email and the default fallback without duplicates', () => {
    process.env.ADMIN_EMAIL = 'support@example.com';

    const emails = buildAdminRecipientList([
        'support@example.com',
        'support@example.com',
        'cryptoplextrade@hotmail.com',
        'backup@example.com'
    ]);

    assert.deepEqual(emails, [
        'support@example.com',
        'cryptoplextrade@hotmail.com',
        'backup@example.com'
    ]);
});
