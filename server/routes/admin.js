const express = require('express');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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
            { voucherCode: { $regex: search, $options: 'i' } }
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
          isClaimed: { $ifNull: ['$isClaimed', false] },
          voucherCode: 1,
          cardsCompleted: 1,
          totalCards: 1,
          gameCompleted: 1
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

// Generate voucher code for user
router.post('/generate-voucher', catchAsync(async (req, res) => {
  const { phoneNumber } = req.body;
  
  console.log('🎫 Admin: Generating voucher code...', { phoneNumber });

  if (!phoneNumber) {
    throw new AppError('Phone number is required', 400);
  }

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user already has a voucher code
    if (user.voucherCode) {
      // Return existing voucher code
      console.log(`🎫 Admin: User ${phoneNumber} already has voucher code: ${user.voucherCode}`);
      
      return res.status(200).json({
        success: true,
        data: {
          voucherCode: user.voucherCode,
          phoneNumber: user.phoneNumber,
          userId: user._id
        }
      });
    }

    // No generation here: voucher codes are created at registration time
    // If we reach here, this user unexpectedly has no voucher code
    throw new AppError('User has no voucher code. Voucher codes are created at registration.', 400);

  } catch (error) {
    console.error('❌ Admin: Error generating voucher code:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to generate voucher code', 500);
  }
}));

// Mark user as claimed (for voucher code)
router.post('/mark-claimed', catchAsync(async (req, res) => {
  const { voucherCode } = req.body;
  
  console.log('🏆 Admin: Processing voucher code for claim...', { voucherCode });

  if (!voucherCode) {
    throw new AppError('Voucher code is required', 400);
  }

  try {
    // Find user by voucher code
    const user = await User.findOne({ voucherCode: voucherCode.toUpperCase() });
    if (!user) {
      throw new AppError('Invalid voucher code or user not found', 404);
    }

    // Check if already claimed
    if (user.isClaimed) {
      throw new AppError('User has already claimed their reward', 400);
    }

    // Mark as claimed
    user.isClaimed = true;
    await user.save();

    console.log(`🏆 Admin: Successfully marked user ${user.phoneNumber} as claimed`);

    res.status(200).json({
      success: true,
      message: `User ${user.phoneNumber} marked as claimed successfully!`,
      data: {
        phoneNumber: user.phoneNumber,
        userId: user._id,
        isClaimed: true,
        voucherCode: user.voucherCode
      }
    });

  } catch (error) {
    console.error('❌ Admin: Error marking user as claimed:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to mark user as claimed', 500);
  }
}));

// Check if user is claimed
router.get('/check-claimed/:phoneNumber', catchAsync(async (req, res) => {
  const { phoneNumber } = req.params;
  
  console.log('🔍 Admin: Checking if user is claimed...', { phoneNumber });

  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      data: {
        isClaimed: user.isClaimed || false
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

// Toggle claim status for user
router.post('/toggle-claim-status', catchAsync(async (req, res) => {
  const { userId } = req.body;
  
  console.log('🔄 Admin: Toggling claim status...', { userId });

  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Toggle claim status
    user.isClaimed = !user.isClaimed;
    await user.save();

    console.log(`🔄 Admin: Successfully toggled claim status for user ${user.phoneNumber} to ${user.isClaimed}`);

    res.status(200).json({
      success: true,
      message: `User ${user.phoneNumber} claim status updated successfully!`,
      data: {
        phoneNumber: user.phoneNumber,
        userId: user._id,
        isClaimed: user.isClaimed,
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
          isClaimed: { $ifNull: ['$isClaimed', false] },
          cardsCompleted: 1,
          totalCards: 1,
          gameCompleted: 1,
          lastQRScanAt: 1
        }
      }
    ]);

    const totalUsers = users.length;
    const totalClaimed = users.filter((user) => user.isClaimed).length;
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
        totalClaimed,
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

module.exports = router;
