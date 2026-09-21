const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Every limiter returns the same JSON shape as the rest of the API so the
// frontend can surface `error` directly instead of guessing at the response.
const respondTooMany = (message) => (req, res) => {
  res.status(429).json({ error: message });
};

// Brute-force protection for POST /auth/login.
//
// Keyed on client IP *and* the submitted phone number, so that neither of these
// works: one IP spraying many accounts, or many IPs hammering one account.
//
// ipKeyGenerator normalises IPv6 down to a subnet. Without it every IPv6
// address would form its own bucket, and an attacker with a /64 would get
// effectively unlimited attempts.
//
// skipSuccessfulRequests means only failures count towards the limit, so a
// legitimate user signing in on several devices is never locked out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${String(req.body?.phone || '').trim().toLowerCase()}`,
  handler: respondTooMany('Too many sign-in attempts. Please wait 15 minutes and try again.'),
});

// Slows down automated account creation. Keyed on IP only, because the phone
// number is attacker-chosen and would make the limit trivial to sidestep.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: respondTooMany('Too many accounts created from this network. Please try again later.'),
});

// Broad safety net for the rest of the API. Deliberately generous - it exists
// to stop runaway clients, not to shape normal traffic.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  handler: respondTooMany('Too many requests. Please slow down and try again shortly.'),
});

module.exports = { loginLimiter, registerLimiter, apiLimiter };
