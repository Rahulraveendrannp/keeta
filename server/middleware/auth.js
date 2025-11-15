// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('./asyncHandler');
const AppError = require('../utils/appError');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '90d'
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 90) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user
    }
  });
};

const authMiddleware = asyncHandler(async (req, res, next) => {
  console.log('🔐 Auth Middleware: Checking authentication...');
  
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
    console.log('🔐 Auth Middleware: Token found in Authorization header');
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
    console.log('🔐 Auth Middleware: Token found in cookies');
  }

  if (!token) {
    console.log('🔐 Auth Middleware: No token found');
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  console.log('🔐 Auth Middleware: Token found, verifying...');
  
  // 2) Verification token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 Auth Middleware: Token decoded successfully:', { id: decoded.id, phoneNumber: decoded.phoneNumber });
  } catch (jwtError) {
    console.error('🔐 Auth Middleware: JWT verification failed:', jwtError.message);
    return next(new AppError('Invalid token', 401));
  }

  // 3) Check if user still exists
  console.log('🔐 Auth Middleware: Looking for user with ID:', decoded.id);
  try {
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      console.log('🔐 Auth Middleware: User not found with ID:', decoded.id);
      return next(
        new AppError(
          'The user belonging to this token does no longer exist.',
          401
        )
      );
    }
    console.log('🔐 Auth Middleware: User found:', currentUser.phoneNumber);
    
    // 4) Check if user is verified
    if (!currentUser.isVerified) {
      console.log('🔐 Auth Middleware: User not verified');
      return next(new AppError('Please verify your phone number first.', 401));
    }

    console.log('🔐 Auth Middleware: User verified, granting access');
    
    // Grant access to protected route
    req.user = {
      _id: currentUser._id,
      phoneNumber: decoded.phoneNumber || currentUser.phoneNumber,
      isVerified: currentUser.isVerified
    };
    next();
  } catch (error) {
    console.error('🔐 Auth Middleware: Error finding user:', error);
    return next(new AppError('Authentication error', 500));
  }
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  restrictTo,
  signToken,
  createSendToken
};