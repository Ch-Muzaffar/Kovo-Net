'use strict';

const cloudinary = require('cloudinary').v2;
const env = require('./env');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Generates a time-limited presigned upload signature.
 * The frontend uses this to upload directly to Cloudinary — no files touch our server.
 */
function generateUploadSignature() {
  const timestamp = Math.round(Date.now() / 1000);
  const params = { timestamp };

  const hasCustomPreset = env.CLOUDINARY_UPLOAD_PRESET && 
                           env.CLOUDINARY_UPLOAD_PRESET !== 'kovo-uploads' && 
                           env.CLOUDINARY_UPLOAD_PRESET.trim() !== '';

  if (hasCustomPreset) {
    params.upload_preset = env.CLOUDINARY_UPLOAD_PRESET;
  }

  const signature = cloudinary.utils.api_sign_request(
    params,
    env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: env.CLOUDINARY_API_KEY,
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: hasCustomPreset ? env.CLOUDINARY_UPLOAD_PRESET : undefined,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
  };
}

module.exports = { cloudinary, generateUploadSignature };
