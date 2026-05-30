// backend/middleware/publicFormValidation.js
const { body, validationResult } = require('express-validator');

// Validation patterns
const PATTERNS = {
  aadhaar: /^\d{12}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  phone: /^[6-9]\d{9}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  pincode: /^\d{6}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

/**
 * Validation rules for profile submission
 */
const profileSubmissionRules = [
  // Personal Details
  body('personalDetails.dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Invalid date of birth format'),
  
  body('personalDetails.gender')
    .optional()
    .isIn(['Male', 'Female', 'Other'])
    .withMessage('Invalid gender'),
  
  body('personalDetails.bloodGroup')
    .optional()
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Invalid blood group'),
  
  body('personalDetails.maritalStatus')
    .optional()
    .isIn(['Single', 'Married', 'Divorced', 'Widowed'])
    .withMessage('Invalid marital status'),
  
  body('personalDetails.phone')
    .optional()
    .matches(PATTERNS.phone)
    .withMessage('Phone must be a valid 10-digit Indian mobile number'),
  
  body('personalDetails.alternatePhone')
    .optional()
    .matches(PATTERNS.phone)
    .withMessage('Alternate phone must be a valid 10-digit Indian mobile number'),
  
  body('personalDetails.personalEmail')
    .optional()
    .matches(PATTERNS.email)
    .withMessage('Invalid email format'),
  
  // Address Details
  body('personalDetails.address.current.line1')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address line 1 must be between 5 and 200 characters'),
  
  body('personalDetails.address.current.city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),
  
  body('personalDetails.address.current.state')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('State must be between 2 and 100 characters'),
  
  body('personalDetails.address.current.pincode')
    .optional()
    .matches(PATTERNS.pincode)
    .withMessage('Pincode must be a valid 6-digit number'),
  
  // Emergency Contact
  body('personalDetails.emergencyContact.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),
  
  body('personalDetails.emergencyContact.relationship')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Relationship must be between 2 and 50 characters'),
  
  body('personalDetails.emergencyContact.phone')
    .optional()
    .matches(PATTERNS.phone)
    .withMessage('Emergency contact phone must be a valid 10-digit Indian mobile number'),
  
  // Identity Details
  body('identityDetails.aadhaar')
    .optional({ checkFalsy: true })
    .matches(PATTERNS.aadhaar)
    .withMessage('Aadhaar must be a valid 12-digit number'),
  
  body('identityDetails.pan')
    .optional({ checkFalsy: true })
    .matches(PATTERNS.pan)
    .withMessage('PAN must be in format: ABCDE1234F (e.g. ABCDE1234F)'),
  
  body('identityDetails.bankName')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Bank name must be between 2 and 100 characters'),
  
  body('identityDetails.bankAccountNumber')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 9, max: 18 })
    .isNumeric()
    .withMessage('Bank account number must be between 9 and 18 digits'),
  
  body('identityDetails.ifscCode')
    .optional({ checkFalsy: true })
    .matches(PATTERNS.ifsc)
    .withMessage('IFSC code must be in format: ABCD0123456 (e.g. SBIN0123456)'),
  
  body('identityDetails.uanNumber')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 9, max: 12 })
    .isNumeric()
    .withMessage('UAN must be a 9-12 digit number'),
  
  body('identityDetails.pfAccountNumber')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 5, max: 50 })
    .withMessage('PF account number must be between 5 and 50 characters')
];

/**
 * Validation middleware
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().reduce((acc, error) => {
      const field = error.path || error.param;
      if (!acc[field]) {
        acc[field] = [];
      }
      acc[field].push(error.msg);
      return acc;
    }, {});

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors
    });
  }
  
  next();
};

/**
 * Sanitize input data
 */
const sanitizeProfileData = (req, res, next) => {
  const { personalDetails, identityDetails } = req.body;

  // Sanitize personal details
  if (personalDetails) {
    // Trim string fields
    const stringFields = ['phone', 'alternatePhone', 'personalEmail', 'bloodGroup', 'maritalStatus'];
    stringFields.forEach(field => {
      if (personalDetails[field]) {
        personalDetails[field] = personalDetails[field].toString().trim();
      }
    });

    // Sanitize address
    if (personalDetails.address) {
      ['current', 'permanent'].forEach(type => {
        if (personalDetails.address[type]) {
          Object.keys(personalDetails.address[type]).forEach(key => {
            if (typeof personalDetails.address[type][key] === 'string') {
              personalDetails.address[type][key] = personalDetails.address[type][key].trim();
            }
          });
        }
      });
    }

    // Sanitize emergency contact
    if (personalDetails.emergencyContact) {
      Object.keys(personalDetails.emergencyContact).forEach(key => {
        if (typeof personalDetails.emergencyContact[key] === 'string') {
          personalDetails.emergencyContact[key] = personalDetails.emergencyContact[key].trim();
        }
      });
    }
  }

  // Sanitize identity details
  if (identityDetails) {
    Object.keys(identityDetails).forEach(key => {
      if (typeof identityDetails[key] === 'string') {
        identityDetails[key] = identityDetails[key].trim().toUpperCase();
      }
    });
  }

  next();
};

/**
 * Rate limiting for public form
 */
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many submission attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
};

module.exports = {
  profileSubmissionRules,
  validate,
  sanitizeProfileData,
  rateLimitConfig,
  PATTERNS
};
