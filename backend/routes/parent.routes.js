const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireApplicant } = require('../middleware/auth');
const { validateRegistrationPayload } = require('../utils/validation');

const router = express.Router();

const uploadsDirectory = path.resolve(__dirname, '../uploads/ids');

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const ensureUploadsDirectory = () => {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDirectory();
    cb(null, uploadsDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeExtension = allowedExtensions.includes(extension) ? extension : '';
    const randomName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExtension}`;
    cb(null, randomName);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);
  const isExtensionAllowed = allowedExtensions.includes(extension);

  if (!isMimeAllowed || !isExtensionAllowed) {
    cb(new Error('Only JPG, PNG, WEBP images or PDF files are allowed.'));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const removeFileIfExists = (filePath) => {
  if (!filePath) {
    return;
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

router.post('/register', upload.single('validId'), async (req, res) => {
  try {
    const validation = validateRegistrationPayload(req.body);

    if (!req.file) {
      validation.errors.push('A valid ID file is required.');
    }

    if (validation.errors.length > 0) {
      removeFileIfExists(req.file?.path);
      return res.status(400).json({
        message: 'Please fix the highlighted issues and try again.',
        errors: validation.errors,
      });
    }

    const existingUser = await User.findOne({ email: validation.data.email });

    if (existingUser) {
      removeFileIfExists(req.file?.path);
      return res.status(409).json({ message: 'This email address is already registered.' });
    }

    const passwordHash = await bcrypt.hash(validation.data.password, 12);

    const user = await User.create({
      role: validation.data.role,
      fullName: validation.data.fullName,
      email: validation.data.email,
      phone: validation.data.phone,
      homeAddress: validation.data.homeAddress,
      passwordHash,
      student: validation.data.student,
      driver: validation.data.driver,
      validId: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      status: 'pending',
      notifications: [
        {
          title: 'Application Received',
          message: `Your ${validation.data.role} account registration has been submitted and is pending verification.`,
          status: 'pending',
        },
      ],
    });

    return res.status(201).json({
      message: 'Registration submitted successfully. Your account is now pending verification.',
      registrationId: user._id,
      status: user.status,
    });
  } catch (error) {
    removeFileIfExists(req.file?.path);
    return res.status(500).json({ message: 'Unable to submit registration right now.' });
  }
});

router.get('/notifications', requireApplicant, async (req, res) => {
  const notifications = [...(req.user.notifications || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return res.status(200).json({ notifications });
});

router.patch('/notifications/:notificationId/read', requireApplicant, async (req, res) => {
  const targetNotification = req.user.notifications.id(req.params.notificationId);

  if (!targetNotification) {
    return res.status(404).json({ message: 'Notification not found.' });
  }

  targetNotification.read = true;
  await req.user.save();

  return res.status(200).json({ message: 'Notification marked as read.' });
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'ID file size must be less than 5MB.' });
    }

    return res.status(400).json({ message: 'Unable to process uploaded file.' });
  }

  if (error && error.message) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
});

module.exports = router;
