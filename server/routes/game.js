// src/routes/game.js
const express = require('express');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const { asyncHandler } = require('../middleware/asyncHandler');
const { authMiddleware } = require('../middleware/auth');
const AppError = require('../utils/appError');

const router = express.Router();

/**
 * @route   GET /api/game/progress
 * @desc    Get current game progress
 * @access  Private
 */
router.get('/progress', authMiddleware, asyncHandler(async (req, res, next) => {
  const { phoneNumber } = req.user;
  console.log('🎮 Game Progress API: Fetching progress for phone:', phoneNumber);

  // Find user's progress using the safe method
  const user = await User.findOne({ phoneNumber });
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  let userProgress = await UserProgress.getOrCreateProgress(phoneNumber, user._id);

  // Get Find the Card progress
  const findTheCardProgress = userProgress.findTheCard;
  const totalFound = findTheCardProgress.completedCards.length;
  const totalCards = findTheCardProgress.totalCards || 4;

  // Check if game is completed
  const isCompleted = findTheCardProgress.isCompleted || totalFound >= totalCards;

  console.log('🎮 Game Progress API: Progress found:', { totalFound, totalCards, isCompleted });

  res.status(200).json({
    success: true,
    data: {
      totalFound,
      totalCards,
      isCompleted,
      completedCards: findTheCardProgress.completedCards.map(card => card.cardId),
      userName: user.profile?.name || 'Player'
    }
  });
}));

module.exports = router;