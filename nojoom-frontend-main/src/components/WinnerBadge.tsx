import React from 'react';
import { Trophy, Award, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './WinnerBadge.css';

interface WinnerBadgeProps {
    badgeType: '10_second_winner' | 'editing_winner' | 'comment_winner';
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
}

const WinnerBadge: React.FC<WinnerBadgeProps> = ({
    badgeType,
    size = 'medium',
    showLabel = false
}) => {
    const { t } = useTranslation();

    const getBadgeIcon = () => {
        switch (badgeType) {
            case '10_second_winner':
                return <Trophy className="badge-icon" />;
            case 'editing_winner':
                return <Award className="badge-icon" />;
            case 'comment_winner':
                return <MessageCircle className="badge-icon" />;
            default:
                return <Trophy className="badge-icon" />;
        }
    };

    const getBadgeColor = () => {
        switch (badgeType) {
            case '10_second_winner':
                return '#ffd700';
            case 'editing_winner':
                return '#c0c0c0';
            case 'comment_winner':
                return '#cd7f32';
            default:
                return '#ffd700';
        }
    };

    return (
        <div
            className={`winner-badge winner-badge-${size}`}
            style={{ '--badge-color': getBadgeColor() } as React.CSSProperties}
            title={t(`challenges.badges.${badgeType}`)}
        >
            <div className="badge-glow"></div>
            {getBadgeIcon()}
            {showLabel && (
                <span className="badge-label">
                    {t(`challenges.badges.${badgeType}`)}
                </span>
            )}
        </div>
    );
};

export default WinnerBadge;
