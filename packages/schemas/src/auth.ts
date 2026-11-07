import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase().max(254);

/** Password policy, enforced identically by the web forms and the API. */
export const passwordSchema = z
  .string()
  .min(8, 'password_too_short')
  .max(72, 'password_too_long')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'password_weak');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch',
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'password_mismatch',
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---- API request bodies (first-party authentication) -----------------------------------

const opaqueToken = z.string().min(20).max(200).regex(/^[A-Za-z0-9_-]+$/, 'invalid_token');

export const registerSchema = z.object({ email: emailSchema, password: passwordSchema });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = signInSchema;
export type LoginInput = SignInInput;

export const refreshSchema = z.object({ refreshToken: opaqueToken });
export type RefreshInput = z.infer<typeof refreshSchema>;

export const verifyEmailSchema = z.object({ token: opaqueToken });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const confirmPasswordResetSchema = z.object({ token: opaqueToken, password: passwordSchema });
export type ConfirmPasswordResetInput = z.infer<typeof confirmPasswordResetSchema>;
