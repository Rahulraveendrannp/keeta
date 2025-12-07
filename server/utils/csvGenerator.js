// server/utils/csvGenerator.js
const moment = require('moment');

/**
 * Generate CSV report matching the exact template structure
 */
function generateCSV(reportData) {
  const { dateRange, overview, daily, gameEngagement, hourlyTraffic, prizeRedemption } = reportData;
  
  const startDateFormatted = moment(dateRange.start).format('MMMM Do, YYYY');
  const endDateFormatted = moment(dateRange.end).format('MMMM Do, YYYY');
  const issueDateFormatted = moment().format('MMMM Do, YYYY');
  const reportPeriod = `From ${moment(dateRange.start).format('Do MMM')} to ${moment(dateRange.end).format('Do MMM YYYY')}`;

  let csv = '';

  // Helper function to create a row with exact number of commas
  const row = (...cells) => {
    const paddedCells = [...cells];
    while (paddedCells.length < 10) paddedCells.push('');
    return paddedCells.join(',') + '\n';
  };

  // Empty rows at top
  csv += row();
  csv += row();
  csv += row();
  csv += row();
  csv += row();

  // Header
  csv += row('Activation Report');
  csv += row();

  // Metadata
  csv += row('Project', 'Keeta Arab Cup & QND Activations Q4 2025');
  csv += row('Project ID', '100-P002');
  csv += row('Client', 'Keeta Qatar');
  csv += row('Issue Date', issueDateFormatted);
  csv += row('Issued by', 'Descifer Agency LLC');
  csv += row('Supervisors', 'Anjanette Anudon & Jawzeeth Jaufar');
  csv += row();

  // 1. Overview Summary
  csv += row('1. Overview Summary');
  csv += row(reportPeriod);
  csv += row();
  csv += row('Metric', '', '', 'Total');
  csv += row('Total Registered Players', '', '', overview.totalRegisteredPlayers);
  csv += row('Total Games Played', '', '', overview.totalGamesPlayed);
  csv += row('Total Prizes Redeemed', '', '', overview.totalPrizesRedeemed);
  csv += row('Tier 1 Prizes Redeemed', '', '', overview.tier1PrizesRedeemed);
  csv += row('Tier 2 Prizes Redeemed', '', '', overview.tier2PrizesRedeemed);
  csv += row('AI Photobooth Prints Redeemed', '', '', overview.aiPhotoboothPrints);
  csv += row();

  // 2. Daily Performance Breakdown
  csv += row('2. Daily Performance Breakdown');
  csv += row();
  csv += row('Date', 'Total Users', 'Total Games Played', 'Total Prizes Redeemed', '"Tier 1\nPrize Redeemed"', '"Tier 2\nPrize Redeemed"', 'AI Photo Prints', 'Peak Hour(s)', 'Notes');

  // Fill daily data
  daily.forEach((day, index) => {
    csv += row(
      `Day ${index + 1}`,
      day.totalUsers,
      day.totalGamesPlayed,
      day.totalPrizesRedeemed,
      day.tier1PrizeRedeemed,
      day.tier2PrizeRedeemed,
      day.aiPhotoPrints,
      day.peakHour,
      '' // Notes - empty for manual entry
    );
  });
  csv += row();

  // 3. Game Level Breakdown
  csv += row('3. Game Level Breakdown');
  csv += row();

  // 3.1 Total Engagement by Game
  csv += row('3.1 Total Engagement by Game');
  csv += row('Game', 'Total Plays', 'Unique Users', '', 'Tier 1 Prizes', 'Tier 2 Prizes');
  gameEngagement.forEach(game => {
    csv += row(
      game.game,
      game.totalPlays,
      game.uniqueUsers,
      '',
      game.tier1Prizes,
      game.tier2Prizes
    );
  });
  csv += row();

  // 3.2 Prize Redemption by Game
  csv += row('3.1 Prize Redemption by Game');
  csv += row('Game', 'Tier 1 Prizes', 'Tier 2 Prizes', '% of Total Prizes');
  prizeRedemption.forEach(game => {
    csv += row(
      game.game,
      game.tier1Prizes,
      game.tier2Prizes,
      game.percentOfTotal
    );
  });
  csv += row();

  // 4. Hourly Traffic Analysis
  csv += row('4. Hourly Traffic Analysis');
  csv += row();
  csv += row('Week 1', 'Hour', '# Users', 'Notes (crowd trend, weather, mall activity)');
  hourlyTraffic.forEach(slot => {
    csv += row('Week 1', slot.hour, slot.users, ''); // Notes empty for manual entry
  });
  csv += row();

  // 5. Operational Notes
  csv += row('5. Operational Notes');
  csv += row();

  // 5.1 Incident Log
  csv += row('5.1 Incident Log');
  csv += row('Date', 'Time', 'Issue', '', '', 'Action Taken', 'Status');
  csv += row(); // Empty row for manual entry
  csv += row();
  csv += row();
  csv += row();
  csv += row();
  csv += row();
  csv += row();
  csv += row();

  // 5.2 Supervisor Weekly Notes
  csv += row('5.2 Supervisor Weekly Notes');
  csv += row('Week', 'What Went Well', '', '', 'Challenges', '', 'Lessons Learned', '', '', 'Recommendations for Next Week');
  csv += row('Week 1'); // Empty rows for manual entry
  csv += row('Week 2');
  csv += row('Week 3');

  return csv;
}

module.exports = {
  generateCSV
};
