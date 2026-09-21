const jwt = require('jsonwebtoken');
const db = require('../db');

// Sent on every 401 that means "this session is no longer usable". The frontend
// keys off this code to clear the stored token and drop the user back to sign-in,
// which is how a revoked session actually ends in the UI.
//
// A 401 without this code - a wrong password, say - is just a failed attempt and
// must NOT sign anyone out. That distinction is why the code exists rather than
// the frontend guessing from the status alone.
const SESSION_INVALID = 'SESSION_INVALID';

const rejectSession = (res, message) =>
  res.status(401).json({ error: message, code: SESSION_INVALID });

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return rejectSession(res, 'No token provided');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return rejectSession(res, 'Invalid or expired token');
  }

  // A JWT cannot be un-issued, so revocation works by version instead: the token
  // records the version it was minted with, and changing a password bumps the
  // stored one. Tokens that no longer match are refused here.
  //
  // This costs one primary-key lookup per authenticated request, which is the
  // price of being able to revoke a stateless token at all.
  try {
    const result = await db.query('SELECT token_version FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return rejectSession(res, 'Invalid or expired token');
    }

    // Tokens issued before token_version existed carry no `tv`. They are treated
    // as version 0, which is what the column defaults to, so deploying this does
    // not sign everybody out at once.
    if (Number(result.rows[0].token_version) !== Number(decoded.tv ?? 0)) {
      return rejectSession(res, 'Your session has ended. Please sign in again.');
    }
  } catch (err) {
    if (err && err.code === 'DB_UNAVAILABLE') {
      return res.status(503).json({
        error: 'PostgreSQL is not running. Start the database and try again.',
      });
    }
    console.error('Token version check failed:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }

  req.user = decoded;
  return next();
};

authMiddleware.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  return next();
};

module.exports = authMiddleware;
