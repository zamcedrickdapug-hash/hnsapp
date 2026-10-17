const express = require('express');
const School = require('../models/School');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', requireAuth, async (req, res) => {
  try {
    const search = String(req.query.q || '').trim();
    const query = { active: true };
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: expression }, { area: expression }];
    }

    const schools = await School.find(query).sort({ name: 1 }).lean();
    return res.status(200).json({ schools });
  } catch (error) {
    console.error('Get schools error:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load schools.' });
  }
});

module.exports = router;
