'use strict';

const { generateUploadSignature } = require('../../config/cloudinary');
const env = require('../../config/env');
const { BadRequestError } = require('../../utils/errors');

/**
 * Generates a presigned upload signature for direct-to-Cloudinary uploads.
 * Validates MIME type and file size BEFORE issuing the signature.
 */
function getPresignedUpload(mimeType, fileSize) {
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!env.ALLOWED_MIME_SET.has(normalizedMime)) {
    throw new BadRequestError(`File type "${mimeType}" is not allowed`, 'INVALID_FILE_TYPE');
  }

  if (fileSize > env.MAX_FILE_SIZE_BYTES) {
    const maxMB = Math.round(env.MAX_FILE_SIZE_BYTES / 1048576);
    throw new BadRequestError(`File size exceeds ${maxMB}MB limit`, 'FILE_TOO_LARGE');
  }
  if (fileSize <= 0) {
    throw new BadRequestError('File size must be positive', 'INVALID_FILE_SIZE');
  }

  const signatureData = generateUploadSignature();

  return {
    ...signatureData,
    allowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf', 'txt', 'csv', 'zip'],
    maxSizeBytes: env.MAX_FILE_SIZE_BYTES,
  };
}

module.exports = { getPresignedUpload };
