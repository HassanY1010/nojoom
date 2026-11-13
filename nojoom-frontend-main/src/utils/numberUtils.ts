/**
 * Formats large numbers into readable strings (e.g., 1200 -> 1.2k)
 */
export const formatNumber = (num?: number): string => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
};
