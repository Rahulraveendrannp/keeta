// server/models/UserProgress.js
const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  
  // Find the Card game progress - 4 scan points
  findTheCard: {
    completedCards: {
      type: [{
        cardId: Number,
        completedAt: Date
      }],
      default: []
    },
    totalCards: { type: Number, default: 4 },
    isCompleted: { type: Boolean, default: false },
    completedAt: Date
  },

  // Overall game statistics
  gameStats: {
    totalTimeSpent: { type: Number, default: 0 }, // in seconds
    totalScans: { type: Number, default: 0 },
    gameStartedAt: Date,
    lastLoginAt: Date,
    loginCount: { type: Number, default: 0 }
  },

  // Current state for resuming
  currentState: {
    currentPage: {
      type: String,
      enum: ['registration', 'otp', 'dashboard', 'find-the-card', 'completed'],
      default: 'registration'
    },
    canResume: { type: Boolean, default: false }
  },

  // Completion status
  isGameCompleted: { type: Boolean, default: false },
  completedAt: Date,
  finalScore: Number,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance optimization
userProgressSchema.index({ phoneNumber: 1 }, { unique: true }); // Make phoneNumber unique
userProgressSchema.index({ userId: 1 }, { unique: true }); // Also make userId unique
userProgressSchema.index({ 'currentState.currentPage': 1 });
userProgressSchema.index({ isGameCompleted: 1 });

// Virtual for completion percentage
userProgressSchema.virtual('completionPercentage').get(function() {
  const cardsCompleted = this.findTheCard.completedCards.length;
  const totalCards = this.findTheCard.totalCards || 4;
  
  return Math.round((cardsCompleted / totalCards) * 100);
});

// Virtual for current progress summary
userProgressSchema.virtual('progressSummary').get(function() {
  return {
    cardsCompleted: this.findTheCard.completedCards.length,
    totalCards: this.findTheCard.totalCards || 4,
    isCompleted: this.findTheCard.isCompleted,
    canResume: this.currentState.canResume,
    currentPage: this.currentState.currentPage
  };
});

// Methods
userProgressSchema.methods.markCardComplete = function(cardId) {
  console.log('🎴 markCardComplete: Starting with cardId:', cardId);
  console.log('🎴 markCardComplete: Current completed cards:', this.findTheCard.completedCards);
  
  // Check if already completed
  const existingIndex = this.findTheCard.completedCards.findIndex(
    card => card.cardId === cardId
  );
  
  if (existingIndex === -1) {
    console.log('🎴 markCardComplete: Adding new card to completed list');
    this.findTheCard.completedCards.push({
      cardId,
      completedAt: new Date()
    });
    
    // Check if all cards are completed
    if (this.findTheCard.completedCards.length >= this.findTheCard.totalCards) {
      this.findTheCard.isCompleted = true;
      this.findTheCard.completedAt = new Date();
    }
  }
  
  this.gameStats.totalScans += 1;
  this.markModified('findTheCard');
  this.markModified('gameStats');
  
  // Also update the User's lastQRScanAt field
  this.updateUserLastQRScan();
  
  console.log('🎴 markCardComplete: After update - completed cards:', this.findTheCard.completedCards);
};

userProgressSchema.methods.updateCurrentState = function(page) {
  this.currentState.currentPage = page;
  this.currentState.canResume = page !== 'registration' && page !== 'completed';
  this.markModified('currentState');
};

// Method to update User's lastQRScanAt field
userProgressSchema.methods.updateUserLastQRScan = async function() {
  try {
    const User = require('./User');
    await User.findByIdAndUpdate(
      this.userId,
      { lastQRScanAt: new Date() },
      { new: true }
    );
    console.log('✅ Updated User lastQRScanAt for user:', this.phoneNumber);
  } catch (error) {
    console.error('❌ Error updating User lastQRScanAt:', error);
  }
};

// Static method to safely get or create user progress (race condition safe)
userProgressSchema.statics.getOrCreateProgress = async function(phoneNumber, userId) {
  try {
    // First try to find existing progress
    let progress = await this.findOne({ phoneNumber: phoneNumber });
    
    if (progress) {
      // Update existing progress
      progress.gameStats.lastLoginAt = new Date();
      progress.gameStats.loginCount += 1;
      await progress.save();
      console.log('📊 Found existing UserProgress for phone:', phoneNumber, 'login count:', progress.gameStats.loginCount);
      return progress;
    }
    
    // If no existing progress, create new one
    console.log('📊 Creating new UserProgress for phone:', phoneNumber);
    try {
      progress = new this({
        userId: userId,
        phoneNumber: phoneNumber,
        gameStats: {
          gameStartedAt: new Date(),
          lastLoginAt: new Date(),
          loginCount: 1
        }
      });
      
      await progress.save();
      console.log('📊 Successfully created new UserProgress for phone:', phoneNumber);
      return progress;
    } catch (saveError) {
      // If save fails due to duplicate key (race condition), try to find the existing one
      if (saveError.code === 11000) {
        console.log('⚠️ Duplicate key error, trying to find existing UserProgress for phone:', phoneNumber);
        const existingProgress = await this.findOne({ phoneNumber: phoneNumber });
        if (existingProgress) {
          // Update login count
          existingProgress.gameStats.lastLoginAt = new Date();
          existingProgress.gameStats.loginCount += 1;
          await existingProgress.save();
          console.log('📊 Found existing UserProgress after duplicate key error for phone:', phoneNumber);
          return existingProgress;
        }
      }
      throw saveError;
    }
    
  } catch (error) {
    console.error('❌ Error in getOrCreateProgress:', error);
    throw error;
  }
};

// Pre-save middleware
userProgressSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update total time spent
  if (this.gameStats.gameStartedAt) {
    this.gameStats.totalTimeSpent = Math.floor((Date.now() - this.gameStats.gameStartedAt.getTime()) / 1000);
  }
  
  // Check if game is completed (all 4 cards found)
  if (this.findTheCard.completedCards.length >= this.findTheCard.totalCards && !this.isGameCompleted) {
    this.isGameCompleted = true;
    this.completedAt = new Date();
    this.findTheCard.isCompleted = true;
    this.findTheCard.completedAt = new Date();
    this.currentState.currentPage = 'completed';
    this.currentState.canResume = false;
  }
  
  next();
});

module.exports = mongoose.model('UserProgress', userProgressSchema);