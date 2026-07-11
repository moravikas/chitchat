const crypto = require('crypto');

/**
 * Generate a salt and hash password using pbkdf2
 * @param {string} password 
 * @returns {Object} { salt, hash }
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

/**
 * Verify if password matches hash using stored salt
 * @param {string} password 
 * @param {string} salt 
 * @param {string} storedHash 
 * @returns {boolean} true if matches
 */
function verifyPassword(password, salt, storedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === storedHash;
}

module.exports = {
  hashPassword,
  verifyPassword
};
