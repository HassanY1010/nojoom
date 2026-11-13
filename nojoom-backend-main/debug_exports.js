import pkg from 'multer-storage-cloudinary';
const CloudinaryStorage = pkg.default || pkg;
console.log('Type of pkg:', typeof pkg);
console.log('Type of pkg.default:', typeof pkg.default);
try {
    const instance = new CloudinaryStorage({
        cloudinary: {},
        params: { folder: 'test' }
    });
    console.log('Successfully instantiated CloudinaryStorage');
} catch (e) {
    console.log('Failed to instantiate:', e.message);
}
