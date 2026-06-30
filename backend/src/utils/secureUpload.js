const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

const IMAGE_MIME_TYPES = {
  '.gif': ['image/gif'],
  '.jpeg': ['image/jpeg'],
  '.jpg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

const DOCUMENT_MIME_TYPES = {
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.jpeg': ['image/jpeg'],
  '.jpg': ['image/jpeg'],
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  '.webp': ['image/webp'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

const ZIP_MIME_TYPES = {
  '.zip': [
    'application/zip',
    'application/x-zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream',
  ],
};

function normalizeAllowedTypes(allowedTypes) {
  return Object.entries(allowedTypes || {}).reduce((acc, [extension, mimeTypes]) => {
    const ext = String(extension || '').toLowerCase();
    if (!ext.startsWith('.')) return acc;

    acc[ext] = new Set((mimeTypes || []).map((mime) => String(mime || '').toLowerCase()));
    return acc;
  }, {});
}

function getSafeExtension(originalName) {
  return path.extname(path.basename(String(originalName || ''))).toLowerCase();
}

function sanitizeOriginalName(originalName, fallback = 'file') {
  const baseName = path.basename(String(originalName || fallback)).replace(/\0/g, '');
  const ext = getSafeExtension(baseName);
  const stem = path
    .basename(baseName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 80);

  return `${stem || fallback}${ext}`;
}

function buildStoredFileName(originalName, fallback = 'file') {
  const safeName = sanitizeOriginalName(originalName, fallback);
  const ext = getSafeExtension(safeName);
  const stem = path.basename(safeName, ext).slice(0, 80) || fallback;

  return `${Date.now()}-${crypto.randomUUID()}-${stem}${ext}`;
}

function createFileFilter({ allowedTypes, code, message, allowEmptyMime = false }) {
  const allowedByExtension = normalizeAllowedTypes(allowedTypes);

  return function secureFileFilter(_req, file, cb) {
    const ext = getSafeExtension(file.originalname);
    const allowedMimes = allowedByExtension[ext];
    const mimeType = String(file.mimetype || '').toLowerCase();

    if (!allowedMimes || (!allowEmptyMime && !mimeType) || (mimeType && !allowedMimes.has(mimeType))) {
      const error = new Error(message || 'Tipo de archivo no permitido');
      error.code = code || 'UPLOAD_FILE_TYPE_NOT_ALLOWED';
      return cb(error);
    }

    return cb(null, true);
  };
}

function safeUploadError(error, defaults = {}) {
  const status = error?.code === 'LIMIT_FILE_SIZE' ? 413 : 400;

  if (error?.code === 'LIMIT_FILE_SIZE') {
    return {
      status,
      code: defaults.sizeCode || 'UPLOAD_FILE_TOO_LARGE',
      error: defaults.sizeMessage || 'El archivo excede el tamaño máximo permitido',
    };
  }

  if (
    error?.code === 'LIMIT_FILE_COUNT' ||
    error?.code === 'LIMIT_UNEXPECTED_FILE' ||
    error?.code === 'LIMIT_FIELD_COUNT' ||
    error?.code === 'LIMIT_PART_COUNT' ||
    error?.code === 'LIMIT_FIELD_KEY' ||
    error?.code === 'LIMIT_FIELD_VALUE'
  ) {
    return {
      status,
      code: error.code,
      error: defaults.limitMessage || 'La solicitud de carga excede los límites permitidos',
    };
  }

  return {
    status,
    code: error?.code || defaults.code || 'UPLOAD_ERROR',
    error: defaults.message || error?.message || 'Error procesando archivo',
  };
}

function createDiskUpload({ destination, allowedTypes, fileSize, files = 1, fields = 20, fieldSize = 64 * 1024, code, message }) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => cb(null, buildStoredFileName(file.originalname)),
  });

  return multer({
    storage,
    limits: {
      fileSize,
      files,
      fields,
      fieldNameSize: 100,
      fieldSize,
      parts: files + fields,
    },
    fileFilter: createFileFilter({ allowedTypes, code, message }),
  });
}

function createMemoryUpload({ allowedTypes, fileSize, files = 1, fields = 20, fieldSize = 64 * 1024, code, message, allowEmptyMime = false }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize,
      files,
      fields,
      fieldNameSize: 100,
      fieldSize,
      parts: files + fields,
    },
    fileFilter: createFileFilter({ allowedTypes, code, message, allowEmptyMime }),
  });
}

module.exports = {
  DOCUMENT_MIME_TYPES,
  IMAGE_MIME_TYPES,
  ZIP_MIME_TYPES,
  buildStoredFileName,
  createDiskUpload,
  createFileFilter,
  createMemoryUpload,
  getSafeExtension,
  safeUploadError,
  sanitizeOriginalName,
};
