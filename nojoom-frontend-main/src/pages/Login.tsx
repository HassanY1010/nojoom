import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguageStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  // دالة تسجيل الدخول
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      console.log('✅ Login successful');
      navigate('/');
    } catch (err: any) {
      console.error('❌ Login error:', err);

      // تجاهل التحقق من البريد عند تسجيل الدخول
      if (err.response?.status === 403 && err.response?.data?.emailVerified === false) {
        // بدل منع الدخول، أظهر رسالة عادية
        const errorMessage = t('loginFailed'); // أو رسالة عامة
        setError(errorMessage);
        // لا تعيد return
      }


      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        t('loginFailed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-[var(--bg-base)] pt-16 flex items-center justify-center px-3 sm:px-4 transition-colors duration-300">
      <div className="max-w-md w-full mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-6 sm:mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">{t('signIn')}</h1>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base">{t('welcomeBack')}</p>
        </motion.div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 text-sm">
                    {error === 'emailNotVerified'
                      ? t('pleaseVerifyEmailFirst')
                      : error
                    }
                  </p>
                </div>


              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4 sm:space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {/* Email */}
          <div>
            <label htmlFor="email" className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t('enterEmail')}
              dir={isRTL ? 'rtl' : 'ltr'}
              className={`w-full ui-input px-4 ${isRTL ? 'text-right' : 'text-left'
                }`}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('password')}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder={t('enterPassword')}
                dir={isRTL ? 'rtl' : 'ltr'}
                className={`w-full ui-input px-4 ${isRTL ? 'text-right pr-12' : 'text-left pl-12'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 ${isRTL ? 'left-3' : 'right-3'
                  }`}
                tabIndex={-1}
              >
                <span>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</span>
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className={`text-${isRTL ? 'left' : 'right'}`}>
            <Link to="/forgot-password" className="text-[rgb(var(--primary-accent))] hover:opacity-80 transition-colors text-xs sm:text-sm font-bold">
              {t('forgotPassword')}
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full ui-button ui-button--primary ui-button--lg interactive rounded-[var(--radius-md)] disabled:opacity-50 font-bold text-sm sm:text-base"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                <span>{t('loggingIn')}</span>
              </div>
            ) : (
              t('signIn')
            )}
          </button>
        </motion.form>
        {/* Divider */}
        <motion.div
          className="flex items-center my-4 sm:my-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex-1 h-px bg-gray-700"></div>
          <span className="px-3 sm:px-4 text-gray-400 text-xs sm:text-sm">{t('or')}</span>
          <div className="flex-1 h-px bg-gray-700"></div>
        </motion.div>

        {/* Sign Up Link */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base font-medium">
            {t('dontHaveAccount')}{' '}
            <Link to="/register" className="text-[rgb(var(--primary-accent))] hover:opacity-80 transition-colors font-bold underline">
              {t('signUp')}
            </Link>
          </p>
        </motion.div>



        {/* Security Notice */}
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-[var(--text-secondary)] text-xs inline-flex items-center gap-1">
            {t('secureLogin')} <ShieldCheck className="w-3 h-3" />
          </p>
        </motion.div>
      </div>

      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[rgb(var(--primary-accent))]/40 via-transparent to-[var(--bg-elevated)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-white dark:to-black"></div>
      </div>
    </div>
  );
};

export default Login;

