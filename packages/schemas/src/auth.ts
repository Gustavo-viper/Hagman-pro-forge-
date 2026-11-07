import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase().max(254);

/** Password policy used by the web forms (Supabase also enforces its own server-side policy). */
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
