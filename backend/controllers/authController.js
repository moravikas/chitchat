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

    res.status(200).json({
      message: `A password reset instructions code/link has been sent to ${user.email} and ${user.mobileNumber}.`
    });

  } catch (error) {
    console.error('Forgot password controller error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
