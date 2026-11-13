import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import { passwordResetApi } from '../services/api';
import { AlertTriangle, ArrowLeft, Info, Lock } from 'lucide-react';

const ForgotPassword: React.FC = () => {
    const { t } = useTranslation();
    const { isRTL } = useLanguageStore();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            setError(t('emailRequired'));
            return;
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
            setError(t('invalidEmail'));
            return;
        }

        try {
            setError('');
            setLoading(true);

            await passwordResetApi.sendResetCode(email);

            // Navigate to verify code page
            navigate('/verify-reset-code', {
                state: { email }
            });

        } catch (err: any) {
            console.error('Send reset code error:', err);
            setError(err.response?.data?.message || t('failedToSendResetCode'));
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
                    {/* Lock Icon */}
                    <motion.div
                        className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[rgb(var(--primary-accent))] to-[var(--bg-card)] rounded-full flex items-center justify-center"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                        <Lock className="w-9 h-9 text-[var(--text-primary)]" />
                    </motion.div>

                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">
                        {t('forgotPassword')}
                    </h1>
                    <p className="text-[var(--text-secondary)] text-sm sm:text-base font-medium">
                        {t('enterEmailToResetPassword')}
                    </p>
                </motion.div>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="flex items-center space-x-2">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Form */}
                <motion.form
                    onSubmit={handleSubmit}
                    className="space-y-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {/* Email Input */}
                    <div>
                        <label htmlFor="email" className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t('email')}
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setError('');
                            }}
                            required
                            placeholder={t('enterEmail')}
                            dir={isRTL ? 'rtl' : 'ltr'}
                            className={`w-full ui-input px-4 ${error ? 'border-red-500' : ''} ${isRTL ? 'text-right' : 'text-left'
                                }`}
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full ui-button ui-button--primary ui-button--lg interactive rounded-[var(--radius-md)] disabled:opacity-50 font-bold text-sm sm:text-base"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center space-x-2">
                                <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin"></div>
                                <span>{t('sending')}</span>
                            </div>
                        ) : (
                            t('sendResetCode')
                        )}
                    </button>
                </motion.form>

                {/* Back to Login */}
                <motion.div
                    className="mt-6 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    <button
                        onClick={() => navigate('/login')}
                        className="text-[var(--text-secondary)] hover:text-[rgb(var(--primary-accent))] transition-all text-sm font-bold inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" /> {t('backToLogin')}
                    </button>
                </motion.div>

                {/* Info Box */}
                <motion.div
                    className="mt-6 p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg shadow-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <p className="text-[var(--text-secondary)] text-xs text-center font-medium">
                        <strong className="block mb-1 opacity-70 inline-flex items-center gap-1"><Info className="w-3 h-3" /> {t('note')}</strong>
                        {t('resetCodeWillExpireIn10Minutes')}
                    </p>
                </motion.div>
            </div>

            {/* Background Pattern */}
            <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-transparent to-pink-500 dark:from-purple-900 dark:via-black dark:to-blue-900"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-white dark:to-black"></div>
            </div>
        </div>
    );
};

export default ForgotPassword;

