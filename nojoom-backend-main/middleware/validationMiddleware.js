import { z } from 'zod';

export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.').replace(/^body\./, ''),
          message: issue.message,
        })),
      });
    }
    next(error);
  }
};

const username = z.string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters');

const password = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
  body: z.object({
    username,
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password,
    bio: z.string().max(200).optional(),
    country: z.string().max(80).optional(),
    birthDate: z.string().optional(),
    birth_date: z.string().optional(),
    birthDay: z.coerce.number().int().min(1).max(31).optional(),
    birthMonth: z.coerce.number().int().min(1).max(12).optional(),
    birthYear: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const videoUploadSchema = z.object({
  body: z.object({
    title: z.string().trim().max(100, 'Title must be at most 100 characters').optional(),
    description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
    duration: z.coerce.number().nonnegative().max(3600).optional(),
    category: z.string().trim().max(50).optional(),
    replaceVideoId: z.coerce.number().int().positive().optional(),
    startTime: z.coerce.number().nonnegative().optional(),
    endTime: z.coerce.number().positive().optional(),
    filter: z.string().trim().max(50).optional(),
    thumbnailTimestamp: z.string().trim().max(20).optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    username: username.optional(),
    bio: z.string().max(200).optional(),
    country: z.string().max(80).optional(),
    social_links: z.union([z.string().max(2000), z.record(z.string(), z.unknown())]).optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
  }),
});

export const sendResetCodeSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Invalid email address').toLowerCase(),
    code: z.string().regex(/^\d{6}$/, 'Reset code must be 6 digits'),
    newPassword: password,
  }),
});

export const commentSchema = z.object({
  body: z.object({
    content: z.string().trim().min(1, 'Comment cannot be empty').max(500, 'Comment too long'),
  }),
});

export const groupSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, 'Group name must be at least 3 characters').max(50, 'Group name too long'),
    description: z.string().trim().max(300, 'Description too long').optional(),
  }),
});

export const registerValidation = validate(registerSchema);
export const loginValidation = validate(loginSchema);
export const videoUploadValidation = validate(videoUploadSchema);
export const updateProfileValidation = validate(updateProfileSchema);
export const changePasswordValidation = validate(changePasswordSchema);
export const sendResetCodeValidation = validate(sendResetCodeSchema);
export const resetPasswordValidation = validate(resetPasswordSchema);
export const commentValidation = validate(commentSchema);
export const groupValidation = validate(groupSchema);
