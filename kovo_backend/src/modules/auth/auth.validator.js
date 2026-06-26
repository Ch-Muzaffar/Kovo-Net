'use strict';

const z = require('zod');

const onboardSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  date_of_birth: z.string().refine(
    (val) => {
      const date = new Date(val);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      return age >= 13 && age <= 120 && !isNaN(date.getTime());
    },
    { message: 'Must be at least 13 years old' }
  ),
  country: z.string().min(1, 'Country is required').max(100),
  city: z.string().min(1, 'City is required').max(100),
  profession: z.string().min(1, 'Profession/field is required').max(200),
  user_type: z.enum(['student', 'professional'], {
    errorMap: () => ({ message: 'Must be student or professional' }),
  }),
});

const acceptTosSchema = z.object({
  accepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service' }),
  }),
});

const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

module.exports = { onboardSchema, acceptTosSchema, refreshTokenSchema };
