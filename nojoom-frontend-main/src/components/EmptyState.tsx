import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    className = ''
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`ui-card flex flex-col items-center justify-center py-20 px-6 text-center rounded-[2rem] relative overflow-hidden group/empty ${className}`}
        >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-[rgba(var(--primary-accent),0.14)] via-transparent to-transparent pointer-events-none opacity-50 group-hover/empty:opacity-80 transition-opacity duration-700"></div>

            {/* Icon Container with Floating Animation */}
            <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="w-36 h-36 bg-[var(--bg-elevated)] rounded-full flex items-center justify-center mb-10 border border-[var(--border-subtle)] shadow-inner relative z-10 backdrop-blur-sm"
            >
                <div className="text-7xl drop-shadow-[0_0_30px_rgba(255,255,255,0.15)] group-hover/empty:scale-110 transition-transform duration-500">
                    {icon}
                </div>
            </motion.div>

            {/* Content */}
            <h2 className="text-xl md:text-2xl font-extrabold mb-4 relative z-10 tracking-tight text-[var(--text-primary)] group-hover/empty:text-[var(--primary)] transition-colors duration-300">
                {title}
            </h2>
            <p className="text-[var(--text-secondary)] font-medium mb-12 max-w-sm relative z-10 leading-relaxed text-sm md:text-base">
                {description}
            </p>

            {/* CTA Button */}
            {actionLabel && (
                <button
                    onClick={onAction}
                    className="group/btn ui-button ui-button--primary ui-button--lg px-12 active:scale-95 flex items-center gap-4 relative z-10 overflow-hidden"
                >
                    <span className="uppercase tracking-[0.15em] text-xs font-bold">{actionLabel}</span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                </button>
            )}

            {/* Subtle Animated Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-transparent -translate-x-full group-hover/empty:translate-x-full transition-transform duration-1500 ease-in-out pointer-events-none"></div>
        </motion.div>
    );
};

export default EmptyState;
