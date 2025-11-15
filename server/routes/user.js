// src/routes/user.js
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const User = require('../models/User');

const { asyncHandler } = require('../middleware/asyncHandler');
const AppError = require('../utils/appError');

const router = express.Router();

// Validation middleware
const validateProfile = [
  body('name').optional().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('language').optional().isIn(['en', 'ar']).withMessage('Language must be either en or ar')
];

const validatePhoneNumber = [
  param('phoneNumber').matches(/^(\+974|974)?[123456789]\d{7}$/).withMessage('Invalid Qatar phone number')
];

/**
 * @route   GET /api/user/:phoneNumber/profile
 * @desc    Get user profile
 * @access  Public
 */
router.get('/:phoneNumber/profile', validatePhoneNumber, asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber } = req.params;
  
  const user = await User.findByPhoneNumber(phoneNumber);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        profile: user.profile,
        gameStats: user.gameStats,
        preferences: user.preferences,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      }
    }
  });
}));

/**
 * @route   PUT /api/user/:phoneNumber/profile
 * @desc    Update user profile
 * @access  Public
 */
router.put('/:phoneNumber/profile', validatePhoneNumber, validateProfile, asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber } = req.params;
  const { name, email, avatar, language, notifications } = req.body;

  const user = await User.findByPhoneNumber(phoneNumber);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Update profile fields
  if (name !== undefined) user.profile.name = name;
  if (email !== undefined) user.profile.email = email;
  if (avatar !== undefined) user.profile.avatar = avatar;
  if (language !== undefined) user.preferences.language = language;
  if (notifications !== undefined) user.preferences.notifications = notifications;

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        profile: user.profile,
        preferences: user.preferences
      }
    }
  });
}));

/**
 * @route   GET /api/user/:phoneNumber/stats
 * @desc    Get user game statistics
 * @access  Public
 */
router.get('/:phoneNumber/stats', validatePhoneNumber, asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber } = req.params;
  
  const user = await User.findByPhoneNumber(phoneNumber);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Get rank
  const betterUsers = await User.countDocuments({
    'gameStats.bestTime': { $lt: user.gameStats.bestTime || Number.MAX_SAFE_INTEGER },
    'gameStats.completedGames': { $gt: 0 }
  });

  res.status(200).json({
    success: true,
    data: {
      stats: {
        ...user.gameStats.toObject(),
        rank: betterUsers + 1
      }
    }
  });
}));

/**
 * @route   GET /api/user/:phoneNumber/achievements
 * @desc    Get user achievements
 * @access  Public
 */
router.get('/:phoneNumber/achievements', validatePhoneNumber, asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber } = req.params;
  
  const user = await User.findByPhoneNumber(phoneNumber);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Calculate achievements
  const achievements = [];
  const stats = user.gameStats;

  // First Game Achievement
  if (stats.totalGames >= 1) {
    achievements.push({
      id: 'first_game',
      title: 'First Steps',
      description: 'Played your first scavenger hunt',
      icon: '🎮',
      unlockedAt: user.createdAt,
      category: 'milestone'
    });
  }

  // First Completion Achievement
  if (stats.completedGames >= 1) {
    achievements.push({
      id: 'first_completion',
      title: 'Hunt Master',
      description: 'Completed your first scavenger hunt',
      icon: '🏆',
      category: 'completion'
    });
  }



  // Consistency achievements
  if (stats.currentStreak >= 3) {
    achievements.push({
      id: 'streak_3',
      title: 'On Fire!',
      description: 'Completed 3 games in a row',
      icon: '🔥',
      category: 'consistency'
    });
  }

  if (stats.completedGames >= 10) {
    achievements.push({
      id: 'veteran',
      title: 'Hunt Veteran',
      description: 'Completed 10 scavenger hunts',
      icon: '🎯',
      category: 'milestone'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      achievements,
      totalAchievements: achievements.length,
      categories: {
        milestone: achievements.filter(a => a.category === 'milestone').length,
        completion: achievements.filter(a => a.category === 'completion').length,
        performance: achievements.filter(a => a.category === 'performance').length,
        consistency: achievements.filter(a => a.category === 'consistency').length
      }
    }
  });
}));

/**
 * @route   DELETE /api/user/:phoneNumber
 * @desc    Delete user account
 * @access  Public
 */
router.delete('/:phoneNumber', validatePhoneNumber, asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber } = req.params;
  
  const user = await User.findByPhoneNumber(phoneNumber);
  if (!user) {
    return next(new AppError('User not found', 404));
  }



  // Delete user account
  await User.findByIdAndDelete(user._id);

  res.status(200).json({
    success: true,
    message: 'User account deleted successfully'
  });
}));

/**
 * @route   POST /api/user/:phoneNumber/preferences
 * @desc    Update user preferences
 * @access  Public
 */
router.post('/:phoneNumber/preferences', validatePhoneNumber, asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 400, errors.array()));
  }

  const { phoneNumber } = req.params;
  const { notifications, language } = req.body;

  const user = await User.findByPhoneNumber(phoneNumber);
  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Update preferences
  if (notifications !== undefined) {
    user.preferences.notifications = notifications;
  }
  if (language !== undefined) {
    user.preferences.language = language;
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Preferences updated successfully',
    data: {
      preferences: user.preferences
    }
  });
}));

/**
 * @route   GET /api/user/rankings
 * @desc    Get user rankings/leaderboard
 * @access  Public
 */
router.get('/rankings', asyncHandler(async (req, res, next) => {
  const { limit = 20, page = 1 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const rankings = await User.aggregate([
    {
      $match: {
        'gameStats.completedGames': { $gt: 0 },
        isActive: true
      }
    },
    {
      $addFields: {
        rank: {
          $cond: {
            if: { $gt: ['$gameStats.bestTime', 0] },
            then: '$gameStats.bestTime',
            else: Number.MAX_SAFE_INTEGER
          }
        }
      }
    },
    {
      $sort: { rank: 1, 'gameStats.completedGames': -1, createdAt: 1 }
    },
    {
      $skip: skip
    },
    {
      $limit: parseInt(limit)
    },
    {
      $project: {
        phoneNumber: 1,
        'gameStats.bestTime': 1,
        'gameStats.completedGames': 1,
        'gameStats.totalRewards': 1,
        'gameStats.currentStreak': 1,
        createdAt: 1
      }
    }
  ]);

  // Add rank numbers
  const rankedUsers = rankings.map((user, index) => ({
    ...user,
    rank: skip + index + 1,
    phoneNumber: `***${user.phoneNumber.slice(-4)}`
  }));

  const totalUsers = await User.countDocuments({
    'gameStats.completedGames': { $gt: 0 },
    isActive: true
  });

  res.status(200).json({
    success: true,
    data: {
      rankings: rankedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalUsers / parseInt(limit)),
        totalUsers,
        hasNext: skip + parseInt(limit) < totalUsers,
        hasPrev: parseInt(page) > 1
      }
    }
  });
}));

module.exports = router;