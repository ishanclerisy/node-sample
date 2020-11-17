import { check, param, query } from 'express-validator/check'

export const signupValidator = [
  check('email', 'Need a valid e-mail.').isEmail(),
  check('username').isLength({ min: 1 }).withMessage('Need a username').isLength({ max: 20 }).withMessage('Username must be less than 20 characters.'),
  check('password').isLength({ min: 1 }).withMessage('Need a password').isLength({ max: 40 }).withMessage('Password must be less than 40 characters.')
]
export const changePasswordValidator = [
  check('oldpassword').isLength({ min: 1 }).withMessage('Please enter your old password.'),
  check('newpassword').isLength({ min: 1 }).withMessage('Please enter a new password.')
]
export const resetPasswordGetValidator = [
  query('token').isLength({ min: 1 }).withMessage('Link is incorrect.')
]

export const resetPasswordPostValidator = [
  check('password').isLength({ min: 1 }).withMessage('Need a password.'),
  check('confirmPassword').isLength({ min: 1 }).withMessage('Confirm your password.'),
  check('token').isLength({ min: 1 }).withMessage('Link is incorrect.')
]

export const resetValidator = [
  check('email', 'Email not found.').isEmail(),
]

export const createAlertValidator = [
  check('alertField').isLength({ min: 1 }).withMessage('Alert field is required'),
  check('market').isLength({ min: 1 }).withMessage('Market is required'),
  check('seccode').isLength({ min: 1 }).withMessage('Seccode is required'),
  check('status').isLength({ min: 1 }).withMessage('Alert status is required'),
  check('trigger').isLength({ min: 1 }).withMessage('Alert trigger value is required'),
  check('value').isLength({ min: 1 }).withMessage('Alert value is required')
]

export const updateAlertValidator = [
  check('id').isLength({ min: 1 }).withMessage('Alert id is required'),
  check('alertField').isLength({ min: 1 }).withMessage('Alert field is required'),
  check('market').isLength({ min: 1 }).withMessage('Market is required'),
  check('seccode').isLength({ min: 1 }).withMessage('Seccode is required'),
  check('status').isLength({ min: 1 }).withMessage('Alert status is required'),
  check('trigger').isLength({ min: 1 }).withMessage('Alert trigger value is required'),
  check('value').isLength({ min: 1 }).withMessage('Alert value is required')
]

export const subscribeValidator = [
  check('productId').isLength({ min: 1 }).withMessage('Product id is required'),  
  check('credits').isLength({ min: 1 }).withMessage('Product id is required')  
]

export const createPortfolioValidator = [
  check('name').isLength({ min: 1 }).withMessage('Portfolio name is required'),
  check('market').isLength({ min: 1 }).withMessage('Market is required'),
  check('cash').isLength({ min: 1 }).withMessage('Cash is required')
]

export const updatePortfolioValidator = [
  check('id').isLength({ min: 1 }).withMessage('Portfolio id is required'),
  check('name').isLength({ min: 1 }).withMessage('Portfolio name is required'),
  check('market').isLength({ min: 1 }).withMessage('Market is required'),
  check('cash').isLength({ min: 1 }).withMessage('Cash is required')
]