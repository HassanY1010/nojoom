import dotenv from 'dotenv';
dotenv.config();

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'nojoom_super_secret_jwt_key_default_32_chars',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'nojoom_super_secret_refresh_jwt_key_default_32',
  expiresIn: process.env.JWT_EXPIRE || '1h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
};