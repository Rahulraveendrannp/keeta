// server/services/reportService.js
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const moment = require('moment');

/**
 * Generate comprehensive report data for the given date range
 */
async function generateReportData(startDate, endDate) {
  console.log('📊 ReportService: Generating report data...', { startDate, endDate });

  // Convert to Date objects and set time boundaries
  // Use local time (not UTC) to match how MongoDB stores createdAt timestamps
  // Start: beginning of startDate, End: beginning of (endDate + 1 day) to avoid partial next day data
  const start = moment(startDate).startOf('day').toDate();
  const endPlusOne = moment(endDate).add(1, 'day').startOf('day').toDate();

  console.log('📊 ReportService: Date range (Local Time):', { 
    start: moment(start).format('YYYY-MM-DD HH:mm:ss'), 
    end: moment(endPlusOne).format('YYYY-MM-DD HH:mm:ss'),
    note: 'Using $gte start and $lt endPlusOne to exclude next day'
  });

  // Parallel data fetching
  const [
    overviewData,
    dailyData,
    gameEngagementData,
    hourlyTrafficData,
    prizeRedemptionData
  ] = await Promise.all([
    getOverviewSummary(start, endPlusOne),
    getDailyBreakdown(start, endPlusOne),
    getGameEngagement(start, endPlusOne),
    getHourlyTraffic(start, endPlusOne),
    getPrizeRedemptionByGame(start, endPlusOne)
  ]);

  console.log('📊 ReportService: Data collection complete');

  return {
    dateRange: { start, end: endPlusOne },
    overview: overviewData,
    daily: dailyData,
    gameEngagement: gameEngagementData,
    hourlyTraffic: hourlyTrafficData,
    prizeRedemption: prizeRedemptionData
  };
}

/**
 * 1. Overview Summary
 */
async function getOverviewSummary(start, end) {
  console.log('📊 ReportService: Calculating overview summary...');

  const users = await User.find({
    createdAt: { $gte: start, $lt: end }
  }).lean();

  const totalRegisteredPlayers = users.length;

  // Count total games played (non-null QR codes)
  let totalGamesPlayed = 0;
  let totalPrizesRedeemed = 0;
  let tier1PrizesRedeemed = 0;
  let tier2PrizesRedeemed = 0;
  let aiPhotoboothPrints = 0;

  users.forEach(user => {
    const claims = user.gameClaims || {};
    const tiers = user.gameTiers || {};

    // Count games played (ONLY games 1-3, exclude game4/AI Photobooth)
    // Games 1-3: A game is "played" if user has a tier assigned
    ['game1', 'game2', 'game3'].forEach(game => {
      if (tiers[game] === 1 || tiers[game] === 2) {
        totalGamesPlayed++;
      }
    });

    // Count prizes redeemed (ONLY games 1-3, exclude game4/AI Photobooth)
    ['game1', 'game2', 'game3'].forEach(game => {
      if (claims[game]) {
        totalPrizesRedeemed++;
        
        // Count tier-based prizes for games 1-3
        if (tiers[game] === 1) tier1PrizesRedeemed++;
        if (tiers[game] === 2) tier2PrizesRedeemed++;
      }
    });

    // AI Photobooth: Keep count for reference but won't add to totals
    // (Will be manually entered in Excel)
    if (claims['game4']) {
      aiPhotoboothPrints++;
    }
  });

  return {
    totalRegisteredPlayers,
    totalGamesPlayed,
    totalPrizesRedeemed,
    tier1PrizesRedeemed,
    tier2PrizesRedeemed,
    aiPhotoboothPrints
  };
}

/**
 * 2. Daily Performance Breakdown
 */
async function getDailyBreakdown(start, end) {
  console.log('📊 ReportService: Calculating daily breakdown...');

  const users = await User.find({
    createdAt: { $gte: start, $lt: end }
  }).lean();

  // Group by day
  const dailyMap = {};

  users.forEach(user => {
    const day = moment(user.createdAt).format('YYYY-MM-DD');
    
    if (!dailyMap[day]) {
      dailyMap[day] = {
        date: day,
        totalUsers: 0,
        totalGamesPlayed: 0,
        totalPrizesRedeemed: 0,
        tier1PrizeRedeemed: 0,
        tier2PrizeRedeemed: 0,
        aiPhotoPrints: 0,
        hourCounts: {}
      };
    }

    dailyMap[day].totalUsers++;

    const claims = user.gameClaims || {};
    const tiers = user.gameTiers || {};

    // Count games played (ONLY games 1-3, exclude game4/AI Photobooth)
    ['game1', 'game2', 'game3'].forEach(game => {
      if (tiers[game] === 1 || tiers[game] === 2) {
        dailyMap[day].totalGamesPlayed++;
      }
    });

    // Count prizes redeemed (ONLY games 1-3, exclude game4/AI Photobooth)
    ['game1', 'game2', 'game3'].forEach(game => {
      if (claims[game]) {
        dailyMap[day].totalPrizesRedeemed++;
        
        if (tiers[game] === 1) dailyMap[day].tier1PrizeRedeemed++;
        if (tiers[game] === 2) dailyMap[day].tier2PrizeRedeemed++;
      }
    });

    // AI Photobooth: Track count but keep separate (will be manually entered)
    if (claims['game4']) {
      dailyMap[day].aiPhotoPrints++;
    }

    // Track hourly activity for peak hour calculation
    const hour = moment(user.createdAt).hour();
    dailyMap[day].hourCounts[hour] = (dailyMap[day].hourCounts[hour] || 0) + 1;
  });

  // Calculate peak hours for each day
  const dailyData = Object.values(dailyMap).map(day => {
    const peakHour = Object.keys(day.hourCounts).reduce((a, b) => 
      day.hourCounts[a] > day.hourCounts[b] ? a : b, 
      Object.keys(day.hourCounts)[0]
    );

    return {
      date: day.date,
      totalUsers: day.totalUsers,
      totalGamesPlayed: day.totalGamesPlayed,
      totalPrizesRedeemed: day.totalPrizesRedeemed,
      tier1PrizeRedeemed: day.tier1PrizeRedeemed,
      tier2PrizeRedeemed: day.tier2PrizeRedeemed,
      aiPhotoPrints: day.aiPhotoPrints,
      peakHour: peakHour ? `${peakHour}:00-${parseInt(peakHour) + 1}:00` : 'N/A'
    };
  });

  return dailyData.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 3. Game Level Breakdown - Total Engagement by Game
 */
async function getGameEngagement(start, end) {
  console.log('📊 ReportService: Calculating game engagement...');

  const users = await User.find({
    createdAt: { $gte: start, $lt: end }
  }).lean();

  const games = {
    'Pose Battle': { game: 'game1', totalPlays: 0, uniqueUsers: 0, tier1Prizes: 0, tier2Prizes: 0 },
    'Rider Dash': { game: 'game2', totalPlays: 0, uniqueUsers: 0, tier1Prizes: 0, tier2Prizes: 0 },
    'Reflex Ball Catch': { game: 'game3', totalPlays: 0, uniqueUsers: 0, tier1Prizes: 0, tier2Prizes: 0 },
    'AI Photobooth (non-game)': { game: 'game4', totalPlays: 0, uniqueUsers: 0, tier1Prizes: 0, tier2Prizes: 0 }
  };

  users.forEach(user => {
    const qrCodes = user.gameQRCodes || {};
    const tiers = user.gameTiers || {};
    const claims = user.gameClaims || {};

    Object.keys(games).forEach(gameName => {
      const gameKey = games[gameName].game;
      
      // For games 1-3: Count if they have a tier (actually played)
      // For game 4: Count if they have claimed (completed AI photobooth)
      let hasPlayed = false;
      
      if (gameKey === 'game4') {
        // Game 4: Count if claimed (completed photobooth)
        hasPlayed = claims[gameKey] === true;
      } else {
        // Games 1-3: Count if they have a tier assigned (actually completed the game)
        hasPlayed = tiers[gameKey] === 1 || tiers[gameKey] === 2;
      }
      
      if (hasPlayed) {
        games[gameName].totalPlays++;
        games[gameName].uniqueUsers++;
      }

      // Count tier prizes (only for games 1-3)
      if (gameKey !== 'game4') {
        if (tiers[gameKey] === 1) games[gameName].tier1Prizes++;
        if (tiers[gameKey] === 2) games[gameName].tier2Prizes++;
      }
    });
  });

  return Object.keys(games).map(gameName => ({
    game: gameName,
    totalPlays: games[gameName].totalPlays,
    uniqueUsers: games[gameName].uniqueUsers,
    tier1Prizes: games[gameName].tier1Prizes,
    tier2Prizes: games[gameName].tier2Prizes
  }));
}

/**
 * 4. Hourly Traffic Analysis
 */
async function getHourlyTraffic(start, end) {
  console.log('📊 ReportService: Calculating hourly traffic...');

  const users = await User.find({
    createdAt: { $gte: start, $lt: end }
  }).lean();

  // Include both operational and non-operational hours
  const timeSlots = {
    '12AM-2PM (Non-operational)': { start: 0, end: 14, count: 0 },
    '2PM-3PM': { start: 14, end: 15, count: 0 },
    '3PM-6PM': { start: 15, end: 18, count: 0 },
    '6PM-9PM': { start: 18, end: 21, count: 0 },
    '9PM-12AM': { start: 21, end: 24, count: 0 }
  };

  users.forEach(user => {
    const hour = moment(user.createdAt).hour();
    
    Object.keys(timeSlots).forEach(slot => {
      const { start: slotStart, end: slotEnd } = timeSlots[slot];
      if (hour >= slotStart && hour < slotEnd) {
        timeSlots[slot].count++;
      }
    });
  });

  return Object.keys(timeSlots).map(slot => ({
    hour: slot,
    users: timeSlots[slot].count
  }));
}

/**
 * 5. Prize Redemption by Game
 */
async function getPrizeRedemptionByGame(start, end) {
  console.log('📊 ReportService: Calculating prize redemption by game...');

  const users = await User.find({
    createdAt: { $gte: start, $lt: end }
  }).lean();

  const games = {
    'Pose Battle': { game: 'game1', tier1: 0, tier2: 0 },
    'Rider Dash': { game: 'game2', tier1: 0, tier2: 0 },
    'Reflex Ball Catch': { game: 'game3', tier1: 0, tier2: 0 }
  };

  let totalPrizes = 0;

  users.forEach(user => {
    const claims = user.gameClaims || {};
    const tiers = user.gameTiers || {};

    Object.keys(games).forEach(gameName => {
      const gameKey = games[gameName].game;
      
      if (claims[gameKey]) {
        if (tiers[gameKey] === 1) {
          games[gameName].tier1++;
          totalPrizes++;
        }
        if (tiers[gameKey] === 2) {
          games[gameName].tier2++;
          totalPrizes++;
        }
      }
    });
  });

  return Object.keys(games).map(gameName => ({
    game: gameName,
    tier1Prizes: games[gameName].tier1,
    tier2Prizes: games[gameName].tier2,
    percentOfTotal: totalPrizes > 0 
      ? ((games[gameName].tier1 + games[gameName].tier2) / totalPrizes * 100).toFixed(1) + '%'
      : '0%'
  }));
}

module.exports = {
  generateReportData
};
