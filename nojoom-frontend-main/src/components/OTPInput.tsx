import React, { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useLanguageStore } from '../store/useLanguageStore';

interface OTPInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    error?: boolean;
    disabled?: boolean;
    autoFocus?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({
    length = 6,
    value,
    onChange,
    error = false,
    disabled = false,
    autoFocus = true
}) => {
    const { isRTL } = useLanguageStore();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(0);

    // Initialize refs array
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, length);
    }, [length]);

    // Auto-focus first input on mount
    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [autoFocus]);

    // Split value into array of digits
    const digits = value.split('').slice(0, length);
    while (digits.length < length) {
        digits.push('');
    }

    const focusInput = (index: number) => {
        if (index >= 0 && index < length && inputRefs.current[index]) {
            inputRefs.current[index]?.focus();
            setActiveIndex(index);
        }
    };

    const handleChange = (index: number, digit: string) => {
        if (disabled) return;

        // Only allow single digit
        const newDigit = digit.slice(-1);

        // Only allow numbers
        if (newDigit && !/^\d$/.test(newDigit)) return;

        // Update value
        const newDigits = [...digits];
        newDigits[index] = newDigit;
        const newValue = newDigits.join('');
        onChange(newValue);

        // Auto-focus next input if digit was entered
        if (newDigit && index < length - 1) {
            focusInput(index + 1);
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        // Handle backspace
        if (e.key === 'Backspace') {
            e.preventDefault();

            if (digits[index]) {
                // Clear current digit
                const newDigits = [...digits];
                newDigits[index] = '';
                onChange(newDigits.join(''));
            } else if (index > 0) {
                // Move to previous input and clear it
                const newDigits = [...digits];
                newDigits[index - 1] = '';
                onChange(newDigits.join(''));
                focusInput(index - 1);
            }
        }

        // Handle arrow keys
        else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            focusInput(isRTL ? index + 1 : index - 1);
        }
        else if (e.key === 'ArrowRight') {
            e.preventDefault();
            focusInput(isRTL ? index - 1 : index + 1);
        }

        // Handle delete
        else if (e.key === 'Delete') {
            e.preventDefault();
            const newDigits = [...digits];
            newDigits[index] = '';
            onChange(newDigits.join(''));
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (disabled) return;

        const pastedData = e.clipboardData.getData('text/plain');
        const pastedDigits = pastedData.replace(/\D/g, '').slice(0, length);

        if (pastedDigits) {
            onChange(pastedDigits);

            // Focus the next empty input or the last input
            const nextIndex = Math.min(pastedDigits.length, length - 1);
            focusInput(nextIndex);
        }
    };

    const handleFocus = (index: number) => {
        setActiveIndex(index);
        // Select the content when focused
        inputRefs.current[index]?.select();
    };

    return (
        <div
            className={`flex gap-2 sm:gap-3 justify-center ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}
            dir="ltr"
        >
            {digits.map((digit, index) => (
                <motion.div
                    key={index}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                >
                    <input
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        onFocus={() => handleFocus(index)}
                        disabled={disabled}
                        className={`
              w-12 h-14 sm:w-14 sm:h-16 
              text-center text-2xl sm:text-3xl font-bold
              bg-gray-800 text-white
              border-2 rounded-xl
              transition-all duration-200
              focus:outline-none
              ${error
                                ? 'border-red-500 bg-red-500/10'
                                : activeIndex === index
                                    ? 'border-white scale-105 shadow-lg shadow-white/20'
                                    : digit
                                        ? 'border-gray-500'
                                        : 'border-gray-600'
                            }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text hover:border-gray-400'}
            `}
                        aria-label={`Digit ${index + 1}`}
                    />
                </motion.div>
            ))}
        </div>
    );
};

export default OTPInput;

