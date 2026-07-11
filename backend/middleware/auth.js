/**
 * Authentication Middleware for verifying mock tokens
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    
    // Check if token format matches: mock-jwt-token-<userId>-<timestamp>
    if (!token.startsWith('mock-jwt-token-')) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const tokenParts = token.split('-');
    if (tokenParts.length < 5) {
      return res.status(401).json({ error: 'Malformed authentication token' });
    }

    // Extracted userId is tokenParts[3]
    const userId = tokenParts[3];

    // Assign user to request object
    req.user = { id: userId };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = requireAuth;
