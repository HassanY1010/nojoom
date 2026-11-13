/**
 * Utility to handle media URLs consistently across the application.
 * Returns a full URL regardless of whether the input is a relative path or an absolute URL.
 * Now supports Cloudinary optimization if the URL is from Cloudinary.
 */
export const getMediaUrl = (path: string | null | undefined, options?: { width?: number; height?: number; crop?: string; quality?: string }): string => {
    if (!path) return '';

    // If it's already a full URL, return it
    if (path.startsWith('http')) {
        // Apply Cloudinary transformations if it's a Cloudinary URL and options are provided
        if (path.includes('cloudinary.com') && options) {
            try {
                const parts = path.split('/upload/');
                if (parts.length === 2) {
                    const transformations = [];
                    if (options.width) transformations.push(`w_${options.width}`);
                    if (options.height) transformations.push(`h_${options.height}`);
                    if (options.crop) transformations.push(`c_${options.crop}`);

                    // Always add auto-format and auto-quality for Cloudinary optimized delivery
                    transformations.push(`f_auto`, `q_auto`);

                    if (options.quality && options.quality !== 'auto') transformations.push(`q_${options.quality}`);

                    return `${parts[0]}/upload/${transformations.join(',')}/${parts[1]}`;
                }
            } catch (e) {
                console.error('Error applying Cloudinary transformations:', e);
            }
        }
        return path;
    }

    // If it's a blob/data URL, return it
    if (path.startsWith('blob:') || path.startsWith('data:')) {
        return path;
    }

    const baseUrl = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace('/api', '')
        : '';

    // Ensure the path starts with a slash if it's relative
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${baseUrl}${cleanPath}`;
};

export default getMediaUrl;
