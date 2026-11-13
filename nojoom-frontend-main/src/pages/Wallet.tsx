import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { getMediaUrl } from '../utils/urlUtils';
import { Gift, TrendingUp, Wallet as WalletIcon } from 'lucide-react';

const Wallet: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const { t } = useTranslation();

    const fetchWallet = async () => {
        try {
            const response = await api.get('/monetization/wallet');
            setData(response.data);
        } catch (error) {
            console.error('Failed to fetch wallet:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWallet();
    }, []);

    const handleClaimBonus = async () => {
        setClaiming(true);
        try {
            const response = await api.post('/monetization/daily-bonus');
            alert(response.data.message);
            fetchWallet();
        } catch (error) {
            alert(t('errorClaimingBonus') || 'فشل الحصول على المكافأة');
        } finally {
            setClaiming(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-[rgb(var(--primary-accent))] border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="p-6 max-w-4xl mx-auto border-none">
            <h1 className="text-2xl font-extrabold mb-8 text-[var(--text-primary)] flex items-center gap-3">
                <WalletIcon className="w-7 h-7 text-[rgb(var(--primary-accent))]" />
                {t('myWallet') || 'محفظتي'}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {/* Balance Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="ui-card relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-10 opacity-10 text-8xl">💎</div>
                    <p className="text-[var(--text-secondary)] font-extrabold mb-2 uppercase tracking-wider">{t('currentBalance') || 'الرصيد الحالي'}</p>
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-6">{data?.balance || 0} <span className="text-xl font-normal opacity-80">PT</span></h2>
                    <button
                        onClick={handleClaimBonus}
                        disabled={claiming}
                        className="ui-button ui-button--primary ui-button--lg interactive px-6 rounded-[var(--radius-pill)] active:scale-95 disabled:opacity-50"
                    >
                        {claiming ? t('claiming') || 'جاري التحصيل...' : t('claimDailyBonus') || 'تحصيل الأرباح اليومية'}
                    </button>
                </motion.div>

                {/* Total Earnings Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="ui-card"
                >
                    <p className="text-[var(--text-secondary)] font-extrabold mb-2 uppercase tracking-wider">{t('totalLifetimeEarnings') || 'إجمالي الأرباح'}</p>
                    <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-[var(--text-primary)]">{data?.total_earnings || 0} <span className="text-xl font-normal text-[var(--text-secondary)] opacity-90">PT</span></h2>
                    <div className="flex items-center gap-2 text-[var(--success)] font-extrabold">
                        <TrendingUp className="w-4 h-4" />
                        {t('growingCommunity') || 'مجتمعك في نمو مستمر'}
                    </div>
                </motion.div>
            </div>

            {/* Recent Gifts */}
            <div className="ui-card">
                <h3 className="text-lg font-extrabold mb-6 text-[var(--text-primary)] flex items-center gap-2">
                    <Gift className="w-5 h-5 text-[rgb(var(--primary-accent))]" />
                    {t('recentLiveGifts') || 'الهدايا الأخيرة'}
                </h3>

                <div className="space-y-4">
                    {data?.recent_gifts?.length > 0 ? data.recent_gifts.map((gift: any) => (
                        <div key={gift.id} className="ui-card--sm flex items-center justify-between transition-all">
                            <div className="flex items-center gap-4">
                                <img
                                    src={getMediaUrl(gift.sender_avatar)}
                                    alt={gift.sender_name}
                                    className="w-10 h-10 rounded-full border-2 border-white/10 shadow-sm"
                                />
                                <div>
                                    <p className="font-extrabold text-sm">
                                        <span className="text-[var(--danger)]">{gift.sender_name}</span> {t('sentAGiftSuffix') || `sent a ${gift.gift_type}`}
                                    </p>
                                    <p className="text-[10px] font-extrabold text-[var(--text-secondary)]">{t('inContext', { context: gift.live_title }) || `In: ${gift.live_title}`}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-extrabold text-[var(--success)] text-sm">+{gift.amount * (gift.gift_type === 'rose' ? 1 : gift.gift_type === 'heart' ? 5 : gift.gift_type === 'star' ? 10 : gift.gift_type === 'crown' ? 50 : 100)} PT</p>
                                <p className="text-[10px] font-extrabold text-[var(--text-secondary)]">{new Date(gift.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10">
                            <p className="text-[var(--text-secondary)] font-bold">{t('noRecentGifts') || 'لا توجد هدايا مؤخرًا'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Wallet;
