const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticateToken } = require('./authMiddleware');
const { sendPasswordResetEmail } = require('./emailService');

// const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const db = require('./database'); // Our database connection
require('dotenv').config();

const router = express.Router();


// Rate limiter is disabled for development
// const authLimiter = rateLimit({
// 	windowMs: 15 * 60 * 1000, // 15 minutes
// 	max: 10, // Limit each IP to 10 requests per windowMs
// 	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
// 	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
// 	message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
// });


// === REGISTRATION ENDPOINT ===
router.post('/register', async (req, res) => {
    const { fullname, phone, email, password, referralCode } = req.body;

    // Basic validation
    if (!fullname || !phone || !email || !password) {
        return res.status(400).json({ message: 'Please fill in all fields.' });
    }

    // Add password strength validation
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    try {
        // Check if user already exists
        const [userExists] = await db.query('SELECT email FROM users WHERE email = ?', [email]);
        if (userExists.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        let referredById = null;
        if (referralCode) {
            // Check if the referral code is valid
            const [referrer] = await db.query('SELECT id FROM users WHERE referral_code = ?', [referralCode]);
            if (referrer.length > 0) {
                referredById = referrer[0].id;
            } else {
                logger.warn(`Invalid referral code used during registration: ${referralCode}`);
            }
        }

        // Generate a unique referral code for the new user.
        // We will insert the user first, get their ID, and then generate the code.

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user into the database
        const [result] = await db.query(
            'INSERT INTO users (fullname, phone, email, password, referred_by_id) VALUES (?, ?, ?, ?, ?)',
            [fullname, phone, email, hashedPassword, referredById]
        );

        // Generate and update the referral code for the new user
        const newUserId = result.insertId;
        const namePart = fullname.replace(/\s+/g, '').substring(0, 10).toUpperCase();
        const randomPart = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
        const newUserReferralCode = `CE-${namePart}${randomPart}`;
        await db.query('UPDATE users SET referral_code = ? WHERE id = ?', [newUserReferralCode, newUserId]);

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});


// === LOGIN ENDPOINT ===
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password.' });
    }

    try {
        // Find the user by email
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = users[0];

        // Compare the provided password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // AFTER password is verified, check for admin role if it's an admin login attempt.
        if (req.body.isAdminLogin && user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. This portal is for administrators only.' });
        }

        // Create a JWT token
        const csrfToken = crypto.randomBytes(32).toString('hex');
        const payload = { userId: user.id, name: user.fullname, role: user.role, csrfToken };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        const isAdmin = req.body.isAdminLogin && user.role === 'admin';
        // Admin logins get their OWN cookie name so they never overwrite a
        // simultaneously-logged-in regular user's session (and vice-versa).
        const tokenCookieName  = isAdmin ? 'admin-token'      : 'token';
        const csrfCookieName   = isAdmin ? 'admin-csrf-token'  : 'csrf-token';

        const cookieOpts = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 1000
        };

        res.cookie(tokenCookieName, token, cookieOpts);
        res.cookie(csrfCookieName, csrfToken, { ...cookieOpts, httpOnly: false }); // readable by JS for CSRF header

        res.status(200).json({ message: 'Login successful!', role: user.role });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// === GET USER PROFILE ENDPOINT ===
router.get('/user/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, fullname, email, phone, referral_code FROM users WHERE id = ?', [req.user.userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json(users[0]);
    } catch (error) {
        logger.error('Profile fetch error:', error);
        res.status(500).json({ message: 'Server error while fetching profile.' });
    }
});

// === UPDATE USER PROFILE ENDPOINT ===
router.put('/user/profile', authenticateToken, async (req, res) => {
    const { fullname, phone } = req.body;

    if (!fullname || !phone) {
        return res.status(400).json({ message: 'Full name and phone number are required.' });
    }

    try {
        await db.query('UPDATE users SET fullname = ?, phone = ? WHERE id = ?', [fullname, phone, req.user.userId]);
        res.status(200).json({ message: 'Profile updated successfully!' });
    } catch (error) {
        logger.error('Profile update error:', error);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
});

// === CHANGE PASSWORD ENDPOINT ===
router.put('/user/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'All password fields are required.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    try {
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.userId]);
        const user = users[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedNewPassword = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, req.user.userId]);

        res.status(200).json({ message: 'Password changed successfully!' });
    } catch (error) {
        logger.error('Password change error:', error);
        res.status(500).json({ message: 'Server error while changing password.' });
    }
});

// === FORGOT PASSWORD ENDPOINT ===
// In-memory token store: email -> { token, expires }
// Tokens are valid for 1 hour. Cleared on server restart.
const passwordResetTokens = new Map();

router.post('/forgot-password', async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) {
        return res.status(400).json({ message: 'Email address is required.' });
    }

    // Always return the same message to prevent email enumeration
    const genericResponse = { message: 'If an account with that email exists, a password reset link has been sent. Check your inbox.' };

    try {
        const [users] = await db.query('SELECT id, fullname, email FROM users WHERE LOWER(email) = ?', [email]);
        logger.info(`Forgot password request for: ${email} — account found: ${users.length > 0}`);

        if (users.length > 0) {
            const user = users[0];
            const token = crypto.randomBytes(32).toString('hex');
            passwordResetTokens.set(email, { token, expires: Date.now() + 60 * 60 * 1000 });
            const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5008}`;
            const resetUrl = `${appUrl}/reset-password.html?token=${token}&email=${encodeURIComponent(email)}`;

            // Fire-and-forget: respond immediately, send email in background
            res.status(200).json(genericResponse);

            // Send email after response is dispatched
            sendPasswordResetEmail(user, resetUrl)
                .then(() => logger.info(`Password reset email sent to ${user.email}`))
                .catch(mailErr => logger.error('Password reset email failed:', mailErr));
            return; // prevent double-send below
        }

        res.status(200).json(genericResponse);
    } catch (error) {
        logger.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});


// === RESET PASSWORD ENDPOINT ===
router.post('/reset-password', async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    const { token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
        return res.status(400).json({ message: 'Email, token, and new password are required.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
    const stored = passwordResetTokens.get(email);
    if (!stored || stored.token !== token || Date.now() > stored.expires) {
        return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
    }
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await db.query('UPDATE users SET password = ? WHERE LOWER(email) = ?', [hashedPassword, email]);
        passwordResetTokens.delete(email); // Invalidate token after use
        res.status(200).json({ message: 'Password reset successfully! You can now log in with your new password.' });
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error while resetting password.' });
    }
});

// === LOGOUT ENDPOINT ===
router.post('/logout', (req, res) => {
    // Clear both user and admin cookies so any portal logout is complete
    res.clearCookie('token');
    res.clearCookie('csrf-token');
    res.clearCookie('admin-token');
    res.clearCookie('admin-csrf-token');
    res.status(200).json({ message: 'Logout successful.' });
});

module.exports = router;