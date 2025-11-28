// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^(\+974|974)?[123456789]\d{7}$/, 'Please enter a valid Qatar phone number']
  },

  isVerified: {
    type: Boolean,
    default: false
  },
  otpCode: {
    type: String,
    select: false // Don't include in queries by default
  },
  otpExpires: {
    type: Date,
    select: false
  },
  otpAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  lastOtpRequest: {
    type: Date,
    select: false
  },
  profile: {
    name: String,
    email: String,
    avatar: String
  },
  gameStats: {
    totalGames: {
      type: Number,
      default: 0
    },
    completedGames: {
      type: Number,
      default: 0
    },
    bestTime: Number, // in seconds
    totalRewards: {
      type: Number,
      default: 0
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    lastPlayedAt: Date
  },
  // Removed global isClaimed - now per-game tracking
  voucherCode: {
    type: String,
    required: true,
    unique: true
  },
  // QR codes for each game (generated at login)
  gameQRCodes: {
    game1: { type: String, unique: true, sparse: true },
    game2: { type: String, unique: true, sparse: true },
    game3: { type: String, unique: true, sparse: true },
    game4: { type: String, unique: true, sparse: true }
  },
  // Track which tier was completed for games 1-3 (1 or 2) based on station QR code scanned
  gameTiers: {
    game1: { type: Number, enum: [1, 2], default: null },
    game2: { type: Number, enum: [1, 2], default: null },
    game3: { type: Number, enum: [1, 2], default: null }
  },
  // Per-game claim status
  gameClaims: {
    game1: { type: Boolean, default: false },
    game2: { type: Boolean, default: false },
    game3: { type: Boolean, default: false },
    game4: { type: Boolean, default: false }
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    language: {
      type: String,
      enum: ['en', 'ar'],
      default: 'en'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },

  lastQRScanAt: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance optimization
userSchema.index({ phoneNumber: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastQRScanAt: -1 }); // For sorting by recent QR scans
userSchema.index({ 'gameStats.bestTime': 1 });
userSchema.index({ voucherCode: 1 }, { unique: true });
userSchema.index({ 'gameQRCodes.game1': 1 }, { unique: true, sparse: true });
userSchema.index({ 'gameQRCodes.game2': 1 }, { unique: true, sparse: true });
userSchema.index({ 'gameQRCodes.game3': 1 }, { unique: true, sparse: true });
userSchema.index({ 'gameQRCodes.game4': 1 }, { unique: true, sparse: true });
userSchema.index({ lastQRScanAt: -1, createdAt: -1 }); // Compound index for sorting


// Pre-save middleware to hash OTP only
userSchema.pre('save', async function(next) {
  try {
    // Update the updatedAt field
    this.updatedAt = new Date();

    // Hash OTP if modified
    if (this.isModified('otpCode') && this.otpCode) {
      this.otpCode = await bcrypt.hash(this.otpCode, 10);
    }

    next();
  } catch (error) {
    console.error('❌ Pre-save middleware error:', error);
    next(error);
  }
});

// Instance method to check OTP
userSchema.methods.compareOTP = async function(candidateOTP) {
  if (!this.otpCode) return false;
  return await bcrypt.compare(candidateOTP, this.otpCode);
};

// Instance method to check if OTP is expired
userSchema.methods.isOTPExpired = function() {
  return !this.otpExpires || this.otpExpires < new Date();
};

// Instance method to update game stats
userSchema.methods.updateGameStats = function(gameResult) {
  this.gameStats.totalGames += 1;
  
  if (gameResult.completed) {
    this.gameStats.completedGames += 1;
    
    // Update best time if this is better
    if (!this.gameStats.bestTime || gameResult.timeElapsed < this.gameStats.bestTime) {
      this.gameStats.bestTime = gameResult.timeElapsed;
    }
    
    // Update current streak
    const lastPlayed = this.gameStats.lastPlayedAt;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (!lastPlayed || lastPlayed < yesterday) {
      this.gameStats.currentStreak = 1;
    } else {
      this.gameStats.currentStreak += 1;
    }
    
    // Add rewards based on tier
    const rewardPoints = {
      'Gold': 100,
      'Silver': 75,
      'Bronze': 50
    };
    this.gameStats.totalRewards += rewardPoints[gameResult.tier] || 0;
  }
  
  this.gameStats.lastPlayedAt = new Date();
  return this.save();
};

// Static method to get leaderboard
userSchema.statics.getLeaderboard = function(limit = 10) {
  return this.find({
    'gameStats.completedGames': { $gt: 0 },
    isActive: true
  })
  .select('phoneNumber gameStats.bestTime gameStats.completedGames gameStats.totalRewards')
  .sort({ 'gameStats.bestTime': 1, 'gameStats.completedGames': -1 })
  .limit(limit)
  .lean();
};

// Static method to find by phone number
userSchema.statics.findByPhoneNumber = function(phoneNumber) {
  return this.findOne({ phoneNumber });
};

// Static method to create user with voucher code
userSchema.statics.createUserWithVoucherCode = async function(userData) {
  try {
    // Generate voucher code first
    const voucherCode = await this.generateUniqueVoucherCode();
    console.log('✅ Generated voucher code for new user:', voucherCode);
    
    // Create user with voucher code
    const user = new this({
      ...userData,
      voucherCode: voucherCode
    });
    
    return user;
  } catch (error) {
    console.error('❌ Error creating user with voucher code:', error);
    throw error;
  }
};

// Static method to generate unique voucher code
userSchema.statics.generateUniqueVoucherCode = async function() {
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  try {
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const voucherCode = generateCode();
      
      // Check if this voucher code already exists
      const existingUser = await this.findOne({ voucherCode });
      if (!existingUser) {
        console.log('✅ Generated unique voucher code:', voucherCode);
        return voucherCode; // Return the unique code
      }
      
      attempts++;
      console.log(`🔄 Attempt ${attempts}: Code ${voucherCode} already exists, trying again...`);
    }
    
    // If we can't generate a unique code after max attempts, use timestamp-based fallback
    const fallbackCode = 'TEMP_' + Date.now().toString().slice(-6);
    console.log('⚠️ Using fallback voucher code:', fallbackCode);
    return fallbackCode;
    
  } catch (error) {
    console.error('❌ Error in generateUniqueVoucherCode:', error);
    // Return a guaranteed unique fallback code
    const fallbackCode = 'ERROR_' + Date.now().toString().slice(-6);
    console.log('🆘 Using error fallback voucher code:', fallbackCode);
    return fallbackCode;
  }
};

// Static method to generate unique QR code for a specific game
userSchema.statics.generateUniqueGameQRCode = async function(gameNumber) {
  const generateQRCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = `KEETO_GAME${gameNumber}_`;
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  try {
    let attempts = 0;
    const maxAttempts = 20;
    const fieldName = `gameQRCodes.game${gameNumber}`;

    while (attempts < maxAttempts) {
      const qrCode = generateQRCode();
      
      // Check if this QR code already exists for this game
      const query = {};
      query[fieldName] = qrCode;
      const existingUser = await this.findOne(query);
      
      if (!existingUser) {
        console.log(`✅ Generated unique QR code for game ${gameNumber}:`, qrCode);
        return qrCode;
      }
      
      attempts++;
      console.log(`🔄 Attempt ${attempts}: QR code ${qrCode} already exists, trying again...`);
    }
    
    // Fallback with timestamp
    const fallbackCode = `KEETO_GAME${gameNumber}_TEMP_${Date.now().toString().slice(-8)}`;
    console.log('⚠️ Using fallback QR code:', fallbackCode);
    return fallbackCode;
    
  } catch (error) {
    console.error('❌ Error in generateUniqueGameQRCode:', error);
    const fallbackCode = `KEETO_GAME${gameNumber}_ERROR_${Date.now().toString().slice(-8)}`;
    console.log('🆘 Using error fallback QR code:', fallbackCode);
    return fallbackCode;
  }
};

// Static method to generate all 4 game QR codes for a user
userSchema.statics.generateAllGameQRCodes = async function() {
  try {
    const qrCodes = {};
    for (let i = 1; i <= 4; i++) {
      qrCodes[`game${i}`] = await this.generateUniqueGameQRCode(i);
    }
    console.log('✅ Generated all 4 game QR codes:', qrCodes);
    return qrCodes;
  } catch (error) {
    console.error('❌ Error generating all game QR codes:', error);
    throw error;
  }
};

module.exports = mongoose.model('User', userSchema);