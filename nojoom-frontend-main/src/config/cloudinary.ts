import { Cloudinary } from '@cloudinary/url-gen';

export const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dg7m2vey6';

export const cld = new Cloudinary({
    cloud: {
        cloudName: cloudName
    }
});

/**
 * Extracts the public ID from a Cloudinary URL.
 * Works for both direct URLs and those stored in the database.
 */
export const getPublicId = (url: string): string | null => {
    if (!url || !url.includes('cloudinary.com')) return null;

    try {
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;

        // Public ID is everything after the version segment (which starts with 'v' and is after 'upload')
        // and before the file extension.
        // However, simplicity: return the part after the folder if we know it.
        // For our app: 'nojoom/videos/public_id' or 'nojoom/avatars/public_id'

        // Find the portion after /upload/v1234567/
        const afterUpload = parts.slice(uploadIndex + 1);
        // Remove the version segment if it exists (e.g., v1736681026)
        const withoutVersion = afterUpload[0].startsWith('v') && !isNaN(Number(afterUpload[0].substring(1)))
            ? afterUpload.slice(1)
            : afterUpload;

        const publicIdWithExtension = withoutVersion.join('/');
        return publicIdWithExtension.replace(/\.[^/.]+$/, "");
    } catch (error) {
        console.error('Error extracting public ID:', error);
        return null;
    }
};

export default cld;
