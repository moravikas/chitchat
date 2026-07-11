const crypto = require('crypto');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/cryptoUtils');

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

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email or mobile number' });
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    // Construct reset link based on client host origin
    const clientUrl = req.headers.origin || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // Try sending email if SMTP configuration is set up (using console fallback otherwise)
    let emailSent = false;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: process.env.SMTP_SERVICE || 'gmail',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        await transporter.sendMail({
          to: user.email,
          subject: 'ChitChat Password Reset Request',
          text: `You are receiving this email because you (or someone else) requested a password reset for your ChitChat account.\n\nPlease click the link below, or copy and paste it into your browser to complete the process:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`
        });
        emailSent = true;
      } catch (mailError) {
        console.error('SMTP Mail Transport Error:', mailError);
      }
    }

    // Log the link in console for server validation
    console.log(`\n========================================`);
    console.log(`[PASSWORD RESET] Link generated for ${user.email}:`);
    console.log(resetUrl);
    console.log(`========================================\n`);

    res.status(200).json({
      message: emailSent
        ? 'A password reset instructions link has been sent to your email.'
        : 'Password reset link generated successfully! (Logged to console in development fallback).',
      // Expose reset link in response body in dev/test environment for easy client auto-copy
      resetLink: process.env.NODE_ENV !== 'production' ? resetUrl : undefined
    });

  } catch (error) {
    console.error('Forgot password controller error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Handle password reset confirmation
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Find user by reset token and ensure it has not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    }

    // Hash the new password using native pbkdf2 helper
    const { salt, hash } = hashPassword(password);
    user.salt = salt;
    user.passwordHash = hash;

    // Reset token parameters
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      message: 'Password reset successful! You can now log in with your new password.'
    });

  } catch (error) {
    console.error('Reset password controller error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
