import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '../store/useLanguageStore';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { authSession } from '../services/authSession';
import { Camera, Eye, EyeOff } from 'lucide-react';


const Register: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguageStore();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    bio: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    birthDate: ''
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [birthDate, setBirthDate] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  // توليد الأيام (1-31)
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // قائمة الأشهر الميلادية
  const months = [
    { value: '', label: t('selectMonth') },
    { value: '1', label: t('january') },
    { value: '2', label: t('february') },
    { value: '3', label: t('march') },
    { value: '4', label: t('april') },
    { value: '5', label: t('may') },
    { value: '6', label: t('june') },
    { value: '7', label: t('july') },
    { value: '8', label: t('august') },
    { value: '9', label: t('september') },
    { value: '10', label: t('october') },
    { value: '11', label: t('november') },
    { value: '12', label: t('december') }
  ];

  // توليد السنوات (من 1900 إلى السنة الحالية)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i);

  // التحقق من توفر اسم المستخدم
  useEffect(() => {
    const checkUsernameAvailability = async () => {
      if (formData.username.length < 3) {
        setUsernameAvailable(null);
        setUsernameSuggestions([]);
        setErrors(prev => ({ ...prev, username: '' }));
        return;
      }

      setCheckingUsername(true);
      try {
        const response = await api.post('/auth/check-username', {
          username: formData.username
        });

        setUsernameAvailable(response.data.available);
        if (!response.data.available && response.data.suggestions) {
          setUsernameSuggestions(response.data.suggestions);
          setErrors(prev => ({ ...prev, username: t('usernameNotAvailable') }));
        } else {
          setUsernameSuggestions([]);
          setErrors(prev => ({ ...prev, username: '' }));
        }
      } catch (error: any) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
        setUsernameSuggestions([]);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsernameAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.username]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // مسح الخطأ عند التغيير
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // تحديث birthDate تلقائياً عند تغيير اليوم/الشهر/السنة
    if (name === 'birthDay' || name === 'birthMonth' || name === 'birthYear') {
      const { birthDay, birthMonth, birthYear } = formData;
      const day = name === 'birthDay' ? value : birthDay;
      const month = name === 'birthMonth' ? value : birthMonth;
      const year = name === 'birthYear' ? value : birthYear;

      if (day && month && year) {
        const updatedBirthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        setFormData(prev => ({
          ...prev,
          birthDate: updatedBirthDate
        }));
      }
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, avatar: t('imageSizeLimit') }));
        return;
      }
      setAvatar(file);
      setErrors(prev => ({ ...prev, avatar: '' }));
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (stepNumber === 1) {
      if (!formData.username.trim()) {
        newErrors.username = t('usernameRequired');
      } else if (formData.username.length < 3) {
        newErrors.username = t('usernameMinLength');
      } else if (usernameAvailable === false) {
        newErrors.username = t('usernameNotAvailable');
      }

      if (!formData.email.trim()) {
        newErrors.email = t('emailRequired');
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = t('invalidEmail');
      }

      if (!formData.birthDay || !formData.birthMonth || !formData.birthYear) {
        newErrors.birthDate = t('birthDateRequired');
      } else {
        const birthDateError = validateBirthDate();
        if (birthDateError) {
          newErrors.birthDate = birthDateError;
        }
      }
    }

    if (stepNumber === 2) {
      // لا توجد حقول مطلوبة في الخطوة الثانية
    }

    if (stepNumber === 3) {
      if (!formData.password) {
        newErrors.password = t('passwordRequired');
      } else if (formData.password.length < 6) {
        newErrors.password = t('passwordMinLength');
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = t('confirmPasswordRequired');
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = t('passwordsDoNotMatch');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateBirthDate = () => {
    const { birthDay, birthMonth, birthYear } = formData;

    if (!birthDay || !birthMonth || !birthYear) {
      return t('birthDateRequired');
    }

    const day = parseInt(birthDay);
    const month = parseInt(birthMonth);
    const year = parseInt(birthYear);

    // التحقق من صحة التاريخ
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return t('invalidBirthDate');
    }

    // التحقق من العمر (يجب أن يكون 13 سنة على الأقل)
    const today = new Date();
    const age = today.getFullYear() - year;
    const hasBirthdayPassed = today.getMonth() > month - 1 ||
      (today.getMonth() === month - 1 && today.getDate() >= day);

    const actualAge = hasBirthdayPassed ? age : age - 1;

    if (actualAge < 13) {
      return t('minimumAgeRequired');
    }

    if (year < 1900) {
      return t('invalidBirthYear');
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep(3)) {
      return;
    }

    setLoading(true);

    try {
      const birthDate = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;

      const submitData = new FormData();
      submitData.append('username', formData.username);
      submitData.append('email', formData.email);
      submitData.append('password', formData.password);
      submitData.append('bio', formData.bio || '');
      submitData.append('birthDate', birthDate);

      if (avatar) {
        submitData.append('avatar', avatar);
      }

      const response = await api.post('/auth/register', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // ✅ حفظ التوكن وتسجيل الدخول مباشرة بعد التسجيل
      if (response.data.accessToken) {
        authSession.setAccessToken(response.data.accessToken);
      }
      if (response.data.user) {
        useAuthStore.getState().setUser(response.data.user);
        localStorage.setItem('userData', JSON.stringify(response.data.user));
      }

      // التوجه للصفحة الرئيسية مباشرة
      navigate('/');

    } catch (error: any) {
      console.error('❌ Registration error:', error);
      const errorMessage = error.response?.data?.error || t('registrationFailed');
      setErrors(prev => ({ ...prev, submit: errorMessage }));
    } finally {
      setLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setFormData(prev => ({
      ...prev,
      username: suggestion
    }));
    setUsernameSuggestions([]);
    setErrors(prev => ({ ...prev, username: '' }));
  };

  const nextStep = () => {
    if (!validateStep(step)) {
      return;
    }

    if (step < 3) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const getUsernameStatus = () => {
    if (checkingUsername) {
      return { color: 'text-yellow-400', text: t('checkingUsername') };
    }
    if (usernameAvailable === true) {
      return { color: 'text-green-400', text: t('usernameAvailable') };
    }
    if (usernameAvailable === false) {
      return { color: 'text-red-400', text: t('usernameNotAvailable') };
    }
    return null;
  };

  const usernameStatus = getUsernameStatus();

  return (
    <div className="min-h-screen bg-[var(--bg-base)] pt-16 flex items-center justify-center px-3 sm:px-4 transition-colors duration-300">
      {/* Main Content */}
      <div className="max-w-md w-full mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-6 sm:mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">{t('signUp')}</h1>
          <p className="text-[var(--text-secondary)] text-sm sm:text-base font-medium">{t('createYourAccount')}</p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-1 sm:space-x-2' : 'space-x-1 sm:space-x-2'}`}>
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-sm ${step >= stepNum
                    ? 'bg-purple-600 dark:bg-white text-white dark:text-black'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    }`}
                >
                  {stepNum}
                </div>
                {stepNum < 3 && (
                  <div className={`w-4 sm:w-8 h-0.5 ${step > stepNum ? 'bg-purple-600 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'
                    }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {errors.submit && (
            <motion.div
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center space-x-2">
                <span className="text-red-400">⚠️</span>
                <p className="text-red-400 text-sm">{errors.submit}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Avatar Upload */}
                <div className="flex justify-center">
                  <div className="relative">
                    <motion.div
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-purple-400 dark:hover:border-gray-500 transition-all shadow-inner"
                      onClick={triggerFileInput}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <div className="text-lg sm:text-xl flex justify-center"><Camera className="w-5 h-5 text-[rgb(var(--primary-accent))]" /></div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs mt-1 font-bold">{t('addPhoto')}</div>
                        </div>
                      )}
                    </motion.div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {errors.avatar && (
                  <p className="text-red-400 text-xs text-center">{errors.avatar}</p>
                )}

                {/* Username */}
                <div>
                  <label className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('username')} *
                  </label>
                  <input
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    minLength={3}
                    maxLength={20}
                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.username ? 'border-red-500' :
                      usernameAvailable === true ? 'border-green-500' :
                        'border-gray-200 dark:border-gray-600'
                      } text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-400 dark:placeholder-gray-500 text-base shadow-inner ${isRTL ? 'text-right' : 'text-left'
                      }`}
                    placeholder={t('enterUsername')}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />

                  {/* Username Status */}
                  {usernameStatus && (
                    <div className={`text-xs sm:text-sm mt-1 font-bold ${usernameStatus.color}`}>
                      {usernameStatus.text}
                    </div>
                  )}

                  {errors.username && !usernameStatus && (
                    <p className="text-red-400 text-xs mt-1">{errors.username}</p>
                  )}

                  {/* Username Suggestions */}
                  {usernameSuggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-bold">{t('suggestedUsernames')}:</p>
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {usernameSuggestions.slice(0, 3).map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white text-xs sm:text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-bold border border-gray-200 dark:border-gray-600 shadow-sm"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('email')} *
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.email ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                      } text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-400 dark:placeholder-gray-500 text-base shadow-inner ${isRTL ? 'text-right' : 'text-left'
                      }`}
                    placeholder={t('enterEmail')}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Birth Date */}
                <div>
                  <label className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('birthDate')} *
                  </label>
                  <div className={`grid grid-cols-3 gap-2 sm:gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {/* اليوم */}
                    <div>
                      <select
                        name="birthDay"
                        value={formData.birthDay}
                        onChange={handleChange}
                        required
                        className="w-full px-2 sm:px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm sm:text-base shadow-inner"
                      >
                        <option value="">{t('day')}</option>
                        {days.map(day => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* الشهر */}
                    <div>
                      <select
                        name="birthMonth"
                        value={formData.birthMonth}
                        onChange={handleChange}
                        required
                        className="w-full px-2 sm:px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm sm:text-base shadow-inner"
                      >
                        <option value="">{t('month')}</option>
                        {months.slice(1).map(month => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* السنة */}
                    <div>
                      <select
                        name="birthYear"
                        value={formData.birthYear}
                        onChange={handleChange}
                        required
                        className="w-full px-2 sm:px-3 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm sm:text-base shadow-inner"
                      >
                        <option value="">{t('year')}</option>
                        {years.map(year => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {errors.birthDate && (
                    <p className="text-red-400 text-xs mt-1">{errors.birthDate}</p>
                  )}
                  <p className={`text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('minimumAgeNotice')}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Bio */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div>
                  <label className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('bio')} <span className="text-gray-400 dark:text-gray-500 text-xs">({t('optional')})</span>
                  </label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={3}
                    className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-400 dark:placeholder-gray-500 resize-none text-base shadow-inner ${isRTL ? 'text-right' : 'text-left'
                      }`}
                    placeholder={t('tellAboutYourself')}
                    maxLength={150}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  />
                  <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 font-bold ${isRTL ? 'text-left' : 'text-right'}`}>
                    {formData.bio.length}/150
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Password */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Password */}
                <div>
                  <label className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('password')} *
                  </label>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.password ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                        } text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-400 dark:placeholder-gray-500 text-base shadow-inner ${isRTL ? 'text-right pr-12' : 'text-left pl-12'
                        }`}
                      placeholder={t('enterPassword')}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 ${isRTL ? 'left-3' : 'right-3'
                        }`}
                      tabIndex={-1}
                    >
                      <span className="text-base">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </span>
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1">{errors.password}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className={`block text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('confirmPassword')} *
                  </label>
                  <div className="relative">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      className={`w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.confirmPassword ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                        } text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder-gray-400 dark:placeholder-gray-500 text-base shadow-inner ${isRTL ? 'text-right pr-12' : 'text-left pl-12'
                        }`}
                      placeholder={t('confirmPassword')}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 ${isRTL ? 'left-3' : 'right-3'
                        }`}
                      tabIndex={-1}
                    >
                      <span className="text-base">
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </span>
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className={`flex items-center justify-between pt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {step > 1 ? (
              <motion.button
                type="button"
                onClick={prevStep}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-white rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm sm:text-base font-bold border border-gray-200 dark:border-gray-700 shadow-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t('back')}
              </motion.button>
            ) : (
              <div></div>
            )}

            <div className={`flex items-center gap-3 sm:gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {/* Sign In Link */}
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium whitespace-nowrap">
                {t('alreadyHaveAccount')}{' '}
                <Link
                  to="/login"
                  className="text-purple-600 dark:text-white hover:text-purple-700 dark:hover:text-gray-300 transition-colors font-bold underline"
                >
                  {t('signIn')}
                </Link>
              </p>

              {step < 3 ? (
                <motion.button
                  type="button"
                  onClick={nextStep}
                  disabled={usernameAvailable === false || checkingUsername}
                  className="ui-button ui-button--primary interactive px-4 sm:px-6 rounded-[var(--radius-md)] disabled:opacity-50 font-bold text-sm sm:text-base"
                  whileHover={{ scale: loading ? 1 : 1.05 }}
                  whileTap={{ scale: loading ? 1 : 0.95 }}
                >
                  {t('next')}
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  disabled={loading || usernameAvailable === false}
                  className="ui-button ui-button--primary interactive px-4 sm:px-6 rounded-[var(--radius-md)] disabled:opacity-50 font-bold text-sm sm:text-base"
                  whileHover={{ scale: loading ? 1 : 1.05 }}
                  whileTap={{ scale: loading ? 1 : 0.95 }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('creatingAccount')}</span>
                    </div>
                  ) : (
                    t('signUp')
                  )}
                </motion.button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-transparent to-pink-500 dark:from-purple-900 dark:via-black dark:to-blue-900"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-white dark:to-black"></div>
      </div>
    </div>
  );
};

export default Register;

