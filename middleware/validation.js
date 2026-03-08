/**
 * Validation Middleware
 * Validates request body parameters
 */

/**
 * Validate required fields in request body
 */
function validateFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter(field => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });
    
    if (missing.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        fields: missing 
      });
    }
    
    next();
  };
}

/**
 * Validate numeric field
 */
function validateNumeric(field, options = {}) {
  return (req, res, next) => {
    const value = req.body[field] || req.query[field];
    
    if (value === undefined || value === null) {
      if (options.required) {
        return res.status(400).json({ error: `${field} is required` });
      }
      return next();
    }
    
    const num = Number(value);
    
    if (isNaN(num)) {
      return res.status(400).json({ error: `${field} must be a number` });
    }
    
    if (options.min !== undefined && num < options.min) {
      return res.status(400).json({ error: `${field} must be at least ${options.min}` });
    }
    
    if (options.max !== undefined && num > options.max) {
      return res.status(400).json({ error: `${field} must be at most ${options.max}` });
    }
    
    next();
  };
}

/**
 * Validate enum field
 */
function validateEnum(field, allowedValues) {
  return (req, res, next) => {
    const value = req.body[field] || req.query[field];
    
    if (!value) {
      if (field.required) {
        return res.status(400).json({ error: `${field} is required` });
      }
      return next();
    }
    
    if (!allowedValues.includes(value)) {
      return res.status(400).json({ 
        error: `Invalid ${field}. Allowed values: ${allowedValues.join(', ')}` 
      });
    }
    
    next();
  };
}

module.exports = {
  validateFields,
  validateNumeric,
  validateEnum
};
