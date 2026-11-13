import crypto from 'crypto';

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

const getSecret = () => {
  const secret = process.env.CSRF_SECRET || process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CSRF_SECRET is required in production');
  }
  return secret || 'development-csrf-secret';
};

const signToken = (rawToken) =>
  crypto.createHmac('sha256', getSecret()).update(rawToken).digest('hex');

const createToken = () => {
  const raw = crypto.randomBytes(32).toString('hex');
  return `${raw}.${signToken(raw)}`;
};

const isValidToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const [raw, signature] = token.split('.');
  if (!raw || !signature) return false;

  const expected = signToken(raw);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const setCsrfCookie = (res) => {
  const token = createToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
};

export const csrfTokenHandler = (_req, res) => {
  const token = setCsrfCookie(res);
  res.json({ csrfToken: token });
};

export const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken || !isValidToken(cookieToken)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'INVALID_CSRF_TOKEN',
    });
  }

  next();
};

export default csrfProtection;
