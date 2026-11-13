import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Users, Send, CheckCircle } from 'lucide-react';
import { submitChallengeEntry } from '../services/challengeService';
import './ChallengeCard.css';

interface ChallengeCardProps {
    challenge: {
        id: number;
        title: string;
        title_ar: string;
        description: string;
        description_ar: string;
        type: '10_second_video' | 'best_editing' | 'best_comment';
        start_date: string;
        end_date: string;
        entries_count: number;
        user_submitted?: boolean;
    };
    onSubmitSuccess?: () => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onSubmitSuccess }) => {
    const { t, i18n } = useTranslation();
    const [timeRemaining, setTimeRemaining] = useState('');
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date().getTime();
            const end = new Date(challenge.end_date).getTime();
            const distance = end - now;

            if (distance < 0) {
                setTimeRemaining(t('challenges.ended'));
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) {
                setTimeRemaining(`${days}${t('challenges.timeDaysAbbr')} ${hours}${t('challenges.timeHoursAbbr')}`);
            } else if (hours > 0) {
                setTimeRemaining(`${hours}${t('challenges.timeHoursAbbr')} ${minutes}${t('challenges.timeMinutesAbbr')}`);
            } else {
                setTimeRemaining(`${minutes}${t('challenges.timeMinutesAbbr')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [challenge.end_date, t]);

    const handleSubmit = async () => {
        // For now, just show a simple submission (will be enhanced with modal later)
        try {
            setSubmitting(true);
            // This is a placeholder - actual submission will be handled by modal
            alert(t('challenges.submitModal.title'));
            setShowSubmitModal(true);
        } catch (error) {
            console.error('Submit error:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const getChallengeTypeColor = (type: string) => {
        switch (type) {
            case '10_second_video':
                return '#667eea';
            case 'best_editing':
                return '#764ba2';
            case 'best_comment':
                return '#f093fb';
            default:
                return '#667eea';
        }
    };

    return (
        <div
            className="challenge-card"
            style={{ '--challenge-color': getChallengeTypeColor(challenge.type) } as React.CSSProperties}
        >
            <div className="challenge-card-header">
                <div className="challenge-type-badge" style={{ background: getChallengeTypeColor(challenge.type) }}>
                    {t(`challenges.types.${challenge.type}`)}
                </div>
                <div className="challenge-timer">
                    <Clock size={16} />
                    <span>{timeRemaining}</span>
                </div>
            </div>

            <div className="challenge-card-body">
                <h3 className="challenge-title">
                    {i18n.language === 'ar' ? challenge.title_ar : challenge.title}
                </h3>
                <p className="challenge-description">
                    {i18n.language === 'ar' ? challenge.description_ar : challenge.description}
                </p>
            </div>

            <div className="challenge-card-footer">
                <div className="challenge-stats">
                    <div className="challenge-stat">
                        <Users size={18} />
                        <span>{challenge.entries_count} {t('challenges.entries')}</span>
                    </div>
                </div>

                {challenge.user_submitted ? (
                    <button className="challenge-btn challenge-btn-submitted" disabled>
                        <CheckCircle size={18} />
                        {t('challenges.submitted')}
                    </button>
                ) : (
                    <button
                        className="challenge-btn challenge-btn-submit"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        <Send size={18} />
                        {submitting ? t('searchPage.loading') : t('challenges.submit')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChallengeCard;
