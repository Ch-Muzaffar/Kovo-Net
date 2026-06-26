'use strict';

const z = require('zod');

const updateProfileSchema = z.object({
  avatar_url: z.string().url().max(500).optional(),
  bio: z.string().max(1000).optional(),
  departments: z.array(z.string().min(1).max(100)).max(20).optional(),
  hobbies: z.array(z.string().min(1).max(100)).max(30).optional(),
  master_skills: z.array(z.string().min(1).max(100)).max(30).optional(),
});

const updateDemographicsSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  country: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100).optional(),
  profession: z.string().min(1).max(200).optional(),
  user_type: z.enum(['student', 'professional']).optional(),
});

module.exports = { updateProfileSchema, updateDemographicsSchema };
