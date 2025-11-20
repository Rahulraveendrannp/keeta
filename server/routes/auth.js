// server/routes/auth.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const smsService = require('../services/smsService');
const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require('../utils/appError');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();



// Validation middleware
const validatePhoneNumber = [
  body('phoneNumber')
    .matches(/^(\+974|974)?[123456789]\d{7}$/)
    .withMessage('Please enter a valid Qatar phone number'),
];

const validateOTP = [
  body('otpCode')
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('OTP must be exactly 4 digits'),
];

/**
 * @route   POST /api/auth/register
 * @desc    Register user and send OTP
 * @access  Public
 */
router.post('/register', validatePhoneNumber, asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber, name } = req.body;

  // Validate name
  if (!name || !name.trim()) {
    return next(new AppError('Name is required', 400));
  }

  // Normalize phone number
  const normalizedPhone = phoneNumber.replace(/\s/g, '');

  // Check if user recently requested OTP
  let user = await User.findByPhoneNumber(normalizedPhone).select('+lastOtpRequest +otpAttempts');
  
  if (user && user.lastOtpRequest) {
    const timeSinceLastRequest = Date.now() - user.lastOtpRequest.getTime();
    const cooldownPeriod = 2 * 60 * 1000; // 2 minutes
    
    if (timeSinceLastRequest < cooldownPeriod) {
      return next(new AppError(`Please wait ${Math.ceil((cooldownPeriod - timeSinceLastRequest) / 1000)} seconds before requesting another OTP`, 429));
    }
  }

  // Send OTP via Qatar SMS API
  try {
    const smsResult = await smsService.sendOTPAndReturn(normalizedPhone);
    
    if (!smsResult.success) {
      return next(new AppError('Failed to send OTP. Please try again.', 500));
    }

    const otpCode = smsResult.otp;
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // FOR TESTING: Log the OTP to console (instead of sending SMS)
    console.log('📱 Generated OTP:', otpCode, 'for phone:', normalizedPhone);
    console.log('📱 OTP expires at:', otpExpires);

    // Create or update user
    if (!user) {
      user = await User.createUserWithVoucherCode({
        phoneNumber: normalizedPhone,
        profile: {
          name: name.trim()
        },
        otpCode,
        otpExpires,
        otpAttempts: 0,
        lastOtpRequest: new Date()
      });
    } else {
      // Update name if provided
      if (name && name.trim()) {
        user.profile = user.profile || {};
        user.profile.name = name.trim();
      }
      user.otpCode = otpCode;
      user.otpExpires = otpExpires;
      user.otpAttempts = 0;
      user.lastOtpRequest = new Date();
    }

    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        otpSent: true,
        expiresIn: 300 // 5 minutes in seconds
      }
    });
  } catch (error) {
    console.error('SMS sending error:', error);
    return next(new AppError('Failed to send OTP. Please try again.', 500));
  }
}));

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and authenticate user
 * @access  Public
 */
router.post('/verify-otp', validateOTP, asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber, otpCode } = req.body;
  const normalizedPhone = phoneNumber.replace(/\s/g, '');

  console.log('🔐 OTP verification request for:', normalizedPhone, 'Code:', otpCode);

  // Find user with OTP data
  const user = await User.findByPhoneNumber(normalizedPhone).select('+otpCode +otpExpires +otpAttempts');
  
  if (!user) {
    return next(new AppError('User not found. Please register first.', 404));
  }

  // Check if OTP exists
  if (!user.otpCode) {
    return next(new AppError('No OTP found. Please request a new OTP.', 400));
  }

  // Check if OTP has expired
  if (user.isOTPExpired()) {
    return next(new AppError('OTP has expired. Please request a new OTP.', 400));
  }

  // Check attempt limit (max 5 attempts)
  if (user.otpAttempts >= 5) {
    return next(new AppError('Too many failed attempts. Please request a new OTP.', 429));
  }

  // Validate OTP using hash comparison
  const isOTPValid = await user.compareOTP(otpCode);
  if (!isOTPValid) {
    // Increment failed attempts
    user.otpAttempts += 1;
    await user.save();
    
    const remainingAttempts = 5 - user.otpAttempts;
    if (remainingAttempts > 0) {
      return next(new AppError(`Invalid OTP. ${remainingAttempts} attempts remaining.`, 400));
    } else {
      return next(new AppError('Too many failed attempts. Please request a new OTP.', 429));
    }
  }

  console.log('✅ OTP verified successfully for user:', user.phoneNumber);

  // OTP is valid - clear OTP data and verify user
  user.otpCode = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  user.isVerified = true;

  // Generate QR codes for games if not already generated
  if (!user.gameQRCodes || !user.gameQRCodes.game1) {
    console.log('🎫 Generating game QR codes for user:', user.phoneNumber);
    try {
      const qrCodes = await User.generateAllGameQRCodes();
      user.gameQRCodes = qrCodes;
      console.log('✅ Game QR codes generated:', qrCodes);
    } catch (error) {
      console.error('❌ Error generating game QR codes:', error);
      // Continue without QR codes - they can be generated later
    }
  } else {
    console.log('✅ User already has game QR codes');
  }

  await user.save();

  // Generate session data
  const sessionData = {
    userId: user._id,
    phoneNumber: user.phoneNumber,
    isVerified: true
  };

  // Generate JWT
  console.log('🔐 Generating JWT token...');
  
  const token = jwt.sign(
    { id: user._id, phoneNumber: user.phoneNumber },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  console.log('✅ JWT token generated successfully for user:', user.phoneNumber);

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      session: sessionData,
      token
    }
  });
}));

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP
 * @access  Public
 */
router.post('/resend-otp', validatePhoneNumber, asyncHandler(async (req, res, next) => {
  const { phoneNumber } = req.body;
  const normalizedPhone = phoneNumber.replace(/\s/g, '');

  const user = await User.findByPhoneNumber(normalizedPhone).select('+lastOtpRequest');
  
  if (!user) {
    return next(new AppError('User not found. Please register first.', 404));
  }

  // Check cooldown period
  if (user.lastOtpRequest) {
    const timeSinceLastRequest = Date.now() - user.lastOtpRequest.getTime();
    const cooldownPeriod = 2 * 60 * 1000; // 2 minutes
    
    if (timeSinceLastRequest < cooldownPeriod) {
      return next(new AppError(`Please wait ${Math.ceil((cooldownPeriod - timeSinceLastRequest) / 1000)} seconds before requesting another OTP`, 429));
    }
  }

  // Send new OTP via Qatar SMS API
  try {
    const smsResult = await smsService.sendOTPAndReturn(normalizedPhone);
    
    if (!smsResult.success) {
      return next(new AppError('Failed to send OTP. Please try again.', 500));
    }

    const otpCode = smsResult.otp;
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    user.otpAttempts = 0;
    user.lastOtpRequest = new Date();
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        otpSent: true,
        expiresIn: 300
      }
    });
  } catch (error) {
    console.error('SMS sending error:', error);
    return next(new AppError('Failed to send OTP. Please try again.', 500));
  }
}));

module.exports = router;