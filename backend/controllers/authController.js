const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/cryptoUtils');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Handle user registration
 */
exports.signup = async (req, res) => {
  try {
    const { firstName, lastName, email, mobileNumber, password } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !mobileNumber || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    // Check if mobile number already exists
    const existingMobile = await User.findOne({ mobileNumber: mobileNumber.trim() });
    if (existingMobile) {
      return res.status(400).json({ error: 'Mobile number is already registered' });
    }

    // Hash password
    const { salt, hash } = hashPassword(password);

    // Save user
    const newUser = new User({
      firstName,
      lastName,
      email,
      mobileNumber,
      salt,
      passwordHash: hash
    });

    await newUser.save();

    res.status(201).json({
      message: 'Registration successful! You can now log in.',
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        mobileNumber: newUser.mobileNumber
      }
    });

  } catch (error) {
    console.error('Signup controller error:', error);
    res.status(500).json({ error: 'Internal Server Error during registration' });
  }
};

/**
 * Handle user login
 */
exports.login = async (req, res) => {
  try {
    const { emailOrMobile, password } = req.body;

    if (!emailOrMobile || !password) {
      return res.status(400).json({ error: 'Email/Mobile and password are required' });
    }

    const searchTerm = emailOrMobile.trim();
    const user = await User.findOne({
      $or: [
        { email: searchTerm.toLowerCase() },
        { mobileNumber: searchTerm }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email/mobile number or password' });
    }

    // Verify Password
    const isPasswordCorrect = verifyPassword(password, user.salt, user.passwordHash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: 'Invalid email/mobile number or password' });
    }

    res.status(200).json({
      message: 'Login successful!',
      token: `mock-jwt-token-${user._id}-${Date.now()}`,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mobileNumber: user.mobileNumber
      }
    });

  } catch (error) {
    console.error('Login controller error:', error);
    res.status(500).json({ error: 'Internal Server Error during login' });
  }
};

/**
 * Handle forgot password request
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { emailOrMobile } = req.body;

    if (!emailOrMobile) {
      return res.status(400).json({ error: 'Email or Mobile number is required' });
    }

    const searchTerm = emailOrMobile.trim();
    const user = await User.findOne({
      $or: [
        { email: searchTerm.toLowerCase() },
        { mobileNumber: searchTerm }
      ]
    });

    // To prevent user enumeration, always return success even if user doesn't exist
    if (!user) {
      return res.status(200).json({
        message: "If an account exists, we've sent a reset email."
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token for DB storage (protects against DB leaks)
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set fields
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    // Reset Link pointing to the production custom domain
    const resetUrl = `https://chitchat.vikasmora.tech/reset-password/${resetToken}`;
    console.log(`[PASSWORD RESET LINK]: ${resetUrl}`);

    // Send email using Brevo SMTP (if SMTP key provided) or REST API (if API key provided)
    const BREVO_USER = process.env.BREVO_USER || 'moravikas77@gmail.com';
    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    if (BREVO_USER && BREVO_API_KEY) {
      if (BREVO_API_KEY.startsWith('xkeysib-')) {
        // Standard Brevo API Key -> Use HTTP REST API (port 443, never blocked on Render)
        const emailData = {
          sender: { name: 'ChitChat Support', email: BREVO_USER },
          to: [{ email: user.email }],
          subject: 'Reset Password Request - ChitChat',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #0b141a; color: #e9edef;">
              <h2 style="color: #6366f1; text-align: center; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">ChitChat Password Reset</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #e9edef;">Hello ${user.firstName},</p>
              <p style="font-size: 16px; line-height: 1.5; color: #e9edef;">We received a request to reset the password for your ChitChat account. Click the button below to set a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #8696a0;">This password reset link will expire in 1 hour.</p>
              <p style="font-size: 14px; color: #8696a0;">If you did not request this, you can safely ignore this email.</p>
              <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 30px;">
              <p style="font-size: 12px; color: #667781; text-align: center;">ChitChat Messenger • Secure Real-Time Messaging</p>
            </div>
          `
        };

        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emailData)
        })
        .then(async (response) => {
          if (!response.ok) {
            const errMsg = await response.text();
            console.error('Brevo REST API Mail Error:', errMsg);
          } else {
            console.log(`[REST EMAIL SENT]: Password reset link successfully sent to ${user.email}`);
          }
        })
        .catch((err) => {
          console.error('Brevo REST API Mail Error:', err.message);
        });

      } else if (BREVO_API_KEY.startsWith('xsmtpsib-')) {
        // SMTP Key -> Use Nodemailer SMTP relay
        console.warn('[SMTP WARNING]: You are using an SMTP key (xsmtpsib-) on a host (like Render) that blocks outgoing port 587 by default. If this times out, please generate a standard API key (xkeysib-) in Brevo settings and use it instead.');

        const transporter = nodemailer.createTransport({
          host: 'smtp-relay.brevo.com',
          port: 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: BREVO_USER,
            pass: BREVO_API_KEY
          },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000
        });

        const mailOptions = {
          from: `"ChitChat Support" <${BREVO_USER}>`,
          to: user.email,
          subject: 'Reset Password Request - ChitChat',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #0b141a; color: #e9edef;">
              <h2 style="color: #6366f1; text-align: center; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">ChitChat Password Reset</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #e9edef;">Hello ${user.firstName},</p>
              <p style="font-size: 16px; line-height: 1.5; color: #e9edef;">We received a request to reset the password for your ChitChat account. Click the button below to set a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #8696a0;">This password reset link will expire in 1 hour.</p>
              <p style="font-size: 14px; color: #8696a0;">If you did not request this, you can safely ignore this email.</p>
              <hr style="border: 0; border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 30px;">
              <p style="font-size: 12px; color: #667781; text-align: center;">ChitChat Messenger • Secure Real-Time Messaging</p>
            </div>
          `
        };

        transporter.sendMail(mailOptions)
          .then(() => {
            console.log(`[SMTP EMAIL SENT]: Password reset link successfully sent to ${user.email}`);
          })
          .catch((err) => {
            console.error('Brevo SMTP Mail Error:', err.message);
          });
      } else {
        console.error('[MAIL ERROR]: Invalid Brevo Key prefix. Keys must start with either xkeysib- (API) or xsmtpsib- (SMTP).');
      }
    } else {
      console.warn('[SMTP WARNING]: BREVO_USER or BREVO_API_KEY environment variables not set. Email not sent.');
    }

    res.status(200).json({
      message: "If an account exists, we've sent a reset email."
    });

  } catch (error) {
    console.error('Forgot password controller error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Handle password reset submit
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Hash the token to match what we stored in DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find matching user with token and valid expiry
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    }

    // Hash the new password using existing salt utilities
    const { salt, hash } = hashPassword(password);
    user.salt = salt;
    user.passwordHash = hash;

    // Clear reset credentials
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      message: 'Password has been successfully updated! You can now log in.'
    });

  } catch (error) {
    console.error('Reset password controller error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
