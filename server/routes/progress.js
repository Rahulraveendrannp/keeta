// server/routes/progress.js
const express = require('express');
const router = express.Router();
const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// Get user progress
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber } = req.user;
    console.log('📊 Progress API: Fetching progress for phone:', phoneNumber);
    
    // Find user's progress using the safe method
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      console.log('❌ Progress API: User not found for phone:', phoneNumber);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log('📊 Progress API: User found, getting/creating progress...');
    let progress = await UserProgress.getOrCreateProgress(phoneNumber, user._id);
    console.log('📊 Progress API: Progress retrieved, populating user data...');
    
    // Populate user data for response
    await progress.populate('userId', 'phoneNumber profile');
    console.log('📊 Progress API: User data populated, preparing response...');
    
    res.json({
      success: true,
      data: {
        progress: progress,
        summary: progress.progressSummary,
        completionPercentage: progress.completionPercentage
      }
    });
    
  } catch (error) {
    console.error('Error fetching user progress:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user progress',
      details: error.message
    });
  }
});

// Complete a card in Find the Card game
router.post('/find-the-card/:cardId/complete', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber } = req.user;
    const { cardId } = req.params;
    const { scannedQRCode } = req.body;
    
    console.log('🎴 Find the Card API: Completing card:', cardId, 'for phone:', phoneNumber, 'QR Code:', scannedQRCode);
    
    const cardIdNum = parseInt(cardId);
    if (isNaN(cardIdNum) || cardIdNum < 1 || cardIdNum > 4) {
      return res.status(400).json({
        success: false,
        error: 'Invalid card ID. Must be between 1 and 4.'
      });
    }
    
    // Find user's progress using the safe method
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update game tier if it's a tier-based game (games 1-3) and QR code is provided
    if (cardIdNum <= 3 && scannedQRCode) {
      // Explicitly check for TIER1 or TIER2 in the QR code
      let tier = null;
      if (scannedQRCode.includes('TIER1')) {
        tier = 1;
      } else if (scannedQRCode.includes('TIER2')) {
        tier = 2;
      }
      
      if (tier !== null) {
        // Ensure gameTiers object exists
        if (!user.gameTiers) {
          user.gameTiers = {};
        }
        user.gameTiers[`game${cardIdNum}`] = tier;
        await user.save();
        console.log(`✅ Updated game ${cardIdNum} tier to ${tier} based on QR code: ${scannedQRCode}`);
      } else {
        console.warn(`⚠️ Could not determine tier from QR code: ${scannedQRCode}`);
      }
    }
    
    let progress = await UserProgress.getOrCreateProgress(phoneNumber, user._id);
    
    // Mark card as completed
    progress.markCardComplete(cardIdNum);
    progress.updateCurrentState('find-the-card');
    
    await progress.save();
    
    // Update User's lastQRScanAt field
    try {
      await User.findByIdAndUpdate(
        progress.userId,
        { lastQRScanAt: new Date() },
        { new: true }
      );
      console.log('✅ Updated User lastQRScanAt for card completion');
    } catch (error) {
      console.error('❌ Error updating User lastQRScanAt:', error);
    }
    
    console.log('🎴 Find the Card API: Card completed and saved to database');
    
    // Check if all cards are completed
    const allCompleted = progress.findTheCard.completedCards.length >= progress.findTheCard.totalCards;
    
    res.json({
      success: true,
      data: {
        cardCompleted: cardIdNum,
        totalCompleted: progress.findTheCard.completedCards.length,
        totalCards: progress.findTheCard.totalCards,
        allCardsCompleted: allCompleted,
        completedCards: progress.findTheCard.completedCards.map(card => card.cardId),
        progress: progress.progressSummary
      }
    });
    
  } catch (error) {
    console.error('Error completing card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete card'
    });
  }
});


// Update current state/page
router.post('/state', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber } = req.user;
    const { currentPage } = req.body;
    
    // Find user's progress using the safe method
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    let progress = await UserProgress.getOrCreateProgress(phoneNumber, user._id);
    
    progress.updateCurrentState(currentPage);
    await progress.save();
    
    res.json({
      success: true,
      data: {
        currentState: progress.currentState
      }
    });
    
  } catch (error) {
    console.error('Error updating state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update state'
    });
  }
});

// Get leaderboard/stats
router.get('/leaderboard', async (req, res) => {
  try {
    const topUsers = await UserProgress.find({ isGameCompleted: true })
      .populate('userId', 'phoneNumber profile')
      .sort({ completedAt: 1 }) // Fastest completion first
      .limit(10)
      .select('phoneNumber gameStats completedAt findTheCard.completedCards');
    
    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      phoneNumber: user.phoneNumber.replace(/(\+974)(\d{4})(\d{4})/, '$1****$3'), // Mask phone number
      totalTime: user.gameStats.totalTimeSpent,
      completedAt: user.completedAt,
      cardsFound: user.findTheCard.completedCards.length
    }));
    
    res.json({
      success: true,
      data: leaderboard
    });
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard'
    });
  }
});

// Complete entire game
router.post('/complete', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber } = req.user;
    const { finalScore, timeElapsed } = req.body;
    
    // Find user's progress using the safe method
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    let progress = await UserProgress.getOrCreateProgress(phoneNumber, user._id);
    
    if (!progress.isGameCompleted) {
      progress.isGameCompleted = true;
      progress.completedAt = new Date();
      progress.finalScore = finalScore || 0;
      progress.findTheCard.completedAt = new Date();
      progress.updateCurrentState('completed');
      
      await progress.save();
    }
    
    res.json({
      success: true,
      data: {
        gameCompleted: true,
        finalScore: progress.finalScore,
        completionTime: progress.gameStats.totalTimeSpent,
        rank: await getUserRank(progress._id)
      }
    });
    
  } catch (error) {
    console.error('Error completing game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete game'
    });
  }
});

// Helper function to get user rank
async function getUserRank(progressId) {
  try {
    const userProgress = await UserProgress.findById(progressId);
    if (!userProgress || !userProgress.isGameCompleted) return null;
    
    const betterUsers = await UserProgress.countDocuments({
      isGameCompleted: true,
      completedAt: { $lt: userProgress.completedAt }
    });
    
    return betterUsers + 1;
  } catch (error) {
    console.error('Error calculating rank:', error);
    return null;
  }
}

module.exports = router;