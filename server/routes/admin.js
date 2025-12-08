const express = require('express');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { generateReportData } = require('../services/reportService');
const { generateCSV } = require('../utils/csvGenerator');
const { generateExcel } = require('../utils/excelGenerator');
const moment = require('moment');

const router = express.Router();

// No authentication required for admin routes

// Get total users count
router.get('/total-users', catchAsync(async (req, res) => {
  console.log('📊 Admin: Getting total users count...');

  try {
    const totalUsers = await User.countDocuments();
    console.log(`📊 Admin: Total users: ${totalUsers}`);

    res.status(200).json({
      success: true,
      totalUsers
    });

  } catch (error) {
    console.error('❌ Admin: Error getting total users:', error);
    throw new AppError('Failed to get total users', 500);
  }
}));

// Get all users with progress and claim status, sorted by recent QR scan activity
router.get('/all-users', catchAsync(async (req, res) => {
  console.log('📊 Admin: Getting all users with progress, sorted by recent QR scan activity...');

  try {
    // Parse pagination and search parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25; // Default to 25 users per page
    const search = req.query.search || ''; // Search term for phone number or voucher code
    const skip = (page - 1) * limit;
    
    console.log('📊 Admin: Search parameters:', { page, limit, search, skip });

    // Use aggregation pipeline for efficient data retrieval with pagination
    const pipeline = [
      // Add search filter if search term is provided
      ...(search ? [{
        $match: {
          $or: [
            { phoneNumber: { $regex: search, $options: 'i' } },
            { voucherCode: { $regex: search, $options: 'i' } },
            { 'profile.name': { $regex: search, $options: 'i' } }
          ]
        }
      }] : []),
      {
        $lookup: {
          from: 'userprogresses', // MongoDB collection name for UserProgress
          localField: '_id',
          foreignField: 'userId',
          as: 'progress'
        }
      },
      {
        $addFields: {
          // Get the first (most recent) progress record, or null if no progress
          progress: {
            $cond: [
              { $gt: [{ $size: '$progress' }, 0] },
              { $arrayElemAt: ['$progress', 0] },
              null
            ]
          }
        }
      },
      {
        $addFields: {
          cardsCompleted: {
            $size: {
              $ifNull: ['$progress.findTheCard.completedCards', []]
            }
          },
          totalCards: {
            $ifNull: ['$progress.findTheCard.totalCards', 4]
          },
          gameCompleted: {
            $ifNull: ['$progress.findTheCard.isCompleted', false]
          }
        }
      },
      {
        $project: {
          _id: 1,
          phoneNumber: 1,
          createdAt: 1,
          lastQRScanAt: 1,
          voucherCode: 1,
          cardsCompleted: 1,
          totalCards: 1,
          gameCompleted: 1,
          gameClaims: { $ifNull: ['$gameClaims', { game1: false, game2: false, game3: false, game4: false }] },
          gameQRCodes: 1,
          gameTiers: { $ifNull: ['$gameTiers', { game1: null, game2: null, game3: null, game4: null }] },
          'profile.name': 1
        }
      },
      {
        $sort: { lastQRScanAt: -1, createdAt: -1 }
      }
    ];

    // Get total count for pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await User.aggregate(countPipeline);
    const totalUsers = totalResult[0]?.total || 0;

    // Add pagination to main pipeline
    pipeline.push(
      { $skip: skip },
      { $limit: limit }
    );

    const usersWithProgress = await User.aggregate(pipeline);

    console.log(`📊 Admin: Found ${usersWithProgress.length} users (page ${page}/${Math.ceil(totalUsers / limit)}) with optimized query`);
    if (search) {
      console.log(`📊 Admin: Search results for "${search}": ${totalUsers} total matches, showing ${usersWithProgress.length} on this page`);
    }
    console.log('📊 Admin: Successfully loaded users with progress, sorted by recent QR scan activity');
    
    res.status(200).json({
      success: true,
      users: usersWithProgress,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers: totalUsers,
        usersPerPage: limit,
        hasNextPage: page < Math.ceil(totalUsers / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Admin: Error loading users:', error);
    throw new AppError('Failed to load users', 500);
  }
}));


// Scan QR code and mark specific game as claimed
router.post('/scan-qr', catchAsync(async (req, res) => {
  const { qrCode } = req.body;
  
  console.log('📱 Admin: Processing QR code scan...', { qrCode });

  if (!qrCode) {
    throw new AppError('QR code is required', 400);
  }

  try {
    // Determine which game this QR code belongs to
    let gameNumber = null;
    let user = null;

    // Try to find user with this QR code in any of the game fields
    for (let i = 1; i <= 4; i++) {
      const query = {};
      query[`gameQRCodes.game${i}`] = qrCode;
      const foundUser = await User.findOne(query);
      if (foundUser) {
        user = foundUser;
        gameNumber = i;
        break;
      }
    }

    if (!user || !gameNumber) {
      throw new AppError('Invalid QR code or user not found', 404);
    }

    const gameKey = `game${gameNumber}`;

    // Check if already claimed
    if (user.gameClaims[gameKey]) {
      throw new AppError(`User has already claimed reward for game ${gameNumber}`, 400);
    }

    // Mark game as claimed
    user.gameClaims[gameKey] = true;
    user.markModified('gameClaims');
    await user.save();

    console.log(`📱 Admin: Successfully marked game ${gameNumber} as claimed for user ${user.phoneNumber}`);

    res.status(200).json({
      success: true,
      data: {
        gameNumber: gameNumber,
        phoneNumber: user.phoneNumber,
        gameClaimed: true,
        allGamesClaimed: Object.values(user.gameClaims).every(claimed => claimed)
      },
      message: `Game ${gameNumber} marked as claimed for user ${user.phoneNumber}`
    });

  } catch (error) {
    console.error('❌ Admin: Error scanning QR code:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to process QR code scan', 500);
  }
}));


// Check if user games are claimed
router.get('/check-claimed/:phoneNumber', catchAsync(async (req, res) => {
  const { phoneNumber } = req.params;
  
  console.log('🔍 Admin: Checking game claim status...', { phoneNumber });

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        gameClaims: user.gameClaims || { game1: false, game2: false, game3: false, game4: false },
        allGamesClaimed: user.gameClaims ? Object.values(user.gameClaims).every(claimed => claimed) : false
      }
    });

  } catch (error) {
    console.error('❌ Admin: Error checking claim status:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to check claim status', 500);
  }
}));

// Toggle claim status for specific game
router.post('/toggle-claim-status', catchAsync(async (req, res) => {
  const { userId, gameNumber } = req.body;
  
  console.log('🔄 Admin: Toggling game claim status...', { userId, gameNumber });

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // If gameNumber specified, toggle that game only; otherwise toggle all games
    if (gameNumber && gameNumber >= 1 && gameNumber <= 4) {
      const gameKey = `game${gameNumber}`;
      user.gameClaims[gameKey] = !user.gameClaims[gameKey];
      console.log(`🔄 Admin: Toggled game ${gameNumber} claim status to ${user.gameClaims[gameKey]}`);
    } else {
      // Toggle all games
      const allClaimed = Object.values(user.gameClaims).every(claimed => claimed);
      user.gameClaims = {
        game1: !allClaimed,
        game2: !allClaimed,
        game3: !allClaimed,
        game4: !allClaimed
      };
      console.log(`🔄 Admin: Toggled all games claim status to ${!allClaimed}`);
    }

    user.markModified('gameClaims');
    await user.save();

    console.log(`🔄 Admin: Successfully toggled claim status for user ${user.phoneNumber}`);

    res.status(200).json({
      success: true,
      message: `User ${user.phoneNumber} claim status updated successfully!`,
      data: {
        phoneNumber: user.phoneNumber,
        userId: user._id,
        gameClaims: user.gameClaims,
        voucherCode: user.voucherCode
      }
    });

  } catch (error) {
    console.error('❌ Admin: Error toggling claim status:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to toggle claim status', 500);
  }
}));

// Get detailed statistics for admin dashboard
router.get('/statistics', catchAsync(async (req, res) => {
  console.log('📊 Admin: Getting detailed statistics...');

  try {
    const recentThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const users = await User.aggregate([
      {
        $lookup: {
          from: 'userprogresses',
          localField: '_id',
          foreignField: 'userId',
          as: 'progress'
        }
      },
      {
        $addFields: {
          progress: { $arrayElemAt: ['$progress', 0] },
          cardsCompleted: {
            $size: {
              $ifNull: ['$progress.findTheCard.completedCards', []]
            }
          },
          totalCards: { $ifNull: ['$progress.findTheCard.totalCards', 4] },
          gameCompleted: { $ifNull: ['$progress.findTheCard.isCompleted', false] }
        }
      },
      {
        $project: {
          gameClaims: { $ifNull: ['$gameClaims', { game1: false, game2: false, game3: false, game4: false }] },
          cardsCompleted: 1,
          totalCards: 1,
          gameCompleted: 1,
          lastQRScanAt: 1
        }
      }
    ]);

    const totalUsers = users.length;
    
    // Count users with at least one game claimed
    const totalClaimed = users.filter((user) => {
      const claims = user.gameClaims || {};
      return Object.values(claims).some(claimed => claimed);
    }).length;
    
    // Count total game claims across all users
    let totalGameClaims = 0;
    users.forEach((user) => {
      const claims = user.gameClaims || {};
      totalGameClaims += Object.values(claims).filter(claimed => claimed).length;
    });

    const completionBuckets = {
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0
    };

    let totalCardsCompleted = 0;
    let playersCompletedAll = 0;
    let playersWithProgress = 0;
    let recentActivity = 0;

    users.forEach((user) => {
      const cardsCompleted = Math.min(user.cardsCompleted || 0, 4);
      totalCardsCompleted += cardsCompleted;

      if (completionBuckets[String(cardsCompleted)] !== undefined) {
        completionBuckets[String(cardsCompleted)] += 1;
      }

      if (cardsCompleted > 0) {
        playersWithProgress += 1;
      }

      if (user.gameCompleted) {
        playersCompletedAll += 1;
      }

      if (user.lastQRScanAt && user.lastQRScanAt >= recentThreshold) {
        recentActivity += 1;
      }
    });

    const averageCardsCompleted =
      totalUsers > 0 ? Number((totalCardsCompleted / totalUsers).toFixed(2)) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalClaimed, // Users with at least one game claimed
        totalGameClaims, // Total number of game claims
        totalUnclaimed: totalUsers - totalClaimed,
        completionBuckets: {
          '0/4': completionBuckets['0'],
          '1/4': completionBuckets['1'],
          '2/4': completionBuckets['2'],
          '3/4': completionBuckets['3'],
          '4/4': completionBuckets['4']
        },
        overview: {
          averageCardsCompleted,
          playersCompletedAll,
          playersWithProgress,
          recentActivity
        }
      }
    });
  } catch (error) {
    console.error('❌ Admin: Error getting statistics:', error);
    console.error('❌ Admin: Error stack:', error.stack);
    throw new AppError('Failed to get statistics', 500);
  }
}));

// Get user QR codes
router.get('/user-qr-codes/:phoneNumber', catchAsync(async (req, res) => {
  const { phoneNumber } = req.params;
  
  console.log('🎫 Admin: Getting user QR codes...', { phoneNumber });

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        phoneNumber: user.phoneNumber,
        userName: user.profile?.name || 'Player',
        gameQRCodes: user.gameQRCodes || {},
        gameClaims: user.gameClaims || { game1: false, game2: false, game3: false, game4: false },
        gameTiers: user.gameTiers || { game1: null, game2: null, game3: null, game4: null }
      }
    });

  } catch (error) {
    console.error('❌ Admin: Error getting user QR codes:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to get user QR codes', 500);
  }
}));

// Generate CSV Report
router.post('/generate-report', catchAsync(async (req, res) => {
  const { startDate, endDate } = req.body;
  
  console.log('📊 Admin: Generating Excel report...', { startDate, endDate });

  // Validate input
  if (!startDate || !endDate) {
    throw new AppError('Start date and end date are required', 400);
  }

  // Validate date format
  if (!moment(startDate, 'YYYY-MM-DD', true).isValid() || !moment(endDate, 'YYYY-MM-DD', true).isValid()) {
    throw new AppError('Invalid date format. Use YYYY-MM-DD (e.g., 2025-12-01)', 400);
  }

  // Validate date range
  const start = moment(startDate);
  const end = moment(endDate);
  
  if (end.isBefore(start)) {
    throw new AppError('End date must be after start date', 400);
  }

  const daysDiff = end.diff(start, 'days');
  if (daysDiff > 90) {
    throw new AppError('Date range cannot exceed 90 days', 400);
  }

  try {
    // Generate report data
    const reportData = await generateReportData(startDate, endDate);
    
    // Generate Excel workbook
    const workbook = await generateExcel(reportData);
    
    // Set response headers for Excel download
    const filename = `keeta-report-${startDate}-to-${endDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    console.log('📊 Admin: Excel report generated successfully:', filename);
    
    // Write to buffer and send
    const buffer = await workbook.xlsx.writeBuffer();
    res.status(200).send(buffer);

  } catch (error) {
    console.error('❌ Admin: Error generating report:', error);
    console.error('❌ Admin: Error stack:', error.stack);
    console.error('❌ Admin: Error message:', error.message);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`Failed to generate report: ${error.message}`, 500);
  }
}));

module.exports = router;
