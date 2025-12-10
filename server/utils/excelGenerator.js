// server/utils/excelGenerator.js
const ExcelJS = require('exceljs');
const moment = require('moment');

/**
 * Generate formatted Excel report matching the template structure with styling
 */
async function generateExcel(reportData) {
  const { dateRange, overview, daily, gameEngagement, hourlyTraffic, prizeRedemption } = reportData;
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Activation Report');
  
  // Set column widths
  worksheet.columns = [
    { width: 25 },  // A
    { width: 18 },  // B
    { width: 20 },  // C
    { width: 22 },  // D
    { width: 18 },  // E
    { width: 18 },  // F
    { width: 20 },  // G
    { width: 18 },  // H
    { width: 35 },  // I
    { width: 28 }   // J
  ];

  const startDateFormatted = moment(dateRange.start).format('MMMM Do, YYYY');
  const endDateFormatted = moment(dateRange.end).format('MMMM Do, YYYY');
  const issueDateFormatted = moment().format('MMMM Do, YYYY');
  const reportPeriod = `From ${moment(dateRange.start).format('Do MMM')} to ${moment(dateRange.end).format('Do MMM YYYY')}`;

  let currentRow = 1;

  // Helper function to add empty rows
  const addEmptyRows = (count) => {
    for (let i = 0; i < count; i++) {
      currentRow++;
    }
  };

  // Helper function to merge cells and add value (simple, no background)
  const addHeaderRow = (text) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = text;
    row.getCell(1).font = { bold: true, size: 11 };
    currentRow++;
  };

  // Helper function to add metadata row
  const addMetadataRow = (label, value) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    currentRow++;
  };

  // Helper for section headers (simple bold text)
  const addSectionHeader = (text) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = text;
    row.getCell(1).font = { bold: true, size: 11 };
    currentRow++;
  };

  // Helper for table headers (simple bold text)
  const addTableHeader = (values) => {
    const row = worksheet.getRow(currentRow);
    values.forEach((value, index) => {
      const cell = row.getCell(index + 1);
      cell.value = value;
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    });
    currentRow++;
  };

  // Helper for data rows (simple, no borders)
  const addDataRow = (values) => {
    const row = worksheet.getRow(currentRow);
    values.forEach((value, index) => {
      const cell = row.getCell(index + 1);
      cell.value = value;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    currentRow++;
  };

  // Empty rows at top
  addEmptyRows(5);

  // Main Header
  addHeaderRow('Activation Report');
  currentRow++;

  // Metadata
  addMetadataRow('Project', 'Keeta Arab Cup & QND Activations Q4 2025');
  addMetadataRow('Project ID', '100-P002');
  addMetadataRow('Client', 'Keeta Qatar');
  addMetadataRow('Issue Date', issueDateFormatted);
  addMetadataRow('Issued by', 'Descifer Agency LLC');
  addMetadataRow('Supervisors', 'Anjanette Anudon & Jawzeeth Jaufar');
  currentRow++;

  // 1. Overview Summary
  addSectionHeader('1. Overview Summary');
  const periodRow = worksheet.getRow(currentRow);
  periodRow.getCell(1).value = reportPeriod;
  currentRow++;
  currentRow++;

  addTableHeader(['Metric', '', '', 'Total', '', '', '', '', '', '']);
  addDataRow(['Total Registered Players', '', '', overview.totalRegisteredPlayers]);
  addDataRow(['Total Games Played', '', '', overview.totalGamesPlayed]);
  addDataRow(['Total Prizes Redeemed', '', '', overview.totalPrizesRedeemed]);
  addDataRow(['Tier 1 Prizes Redeemed', '', '', overview.tier1PrizesRedeemed]);
  addDataRow(['Tier 2 Prizes Redeemed', '', '', overview.tier2PrizesRedeemed]);
  addDataRow(['AI Photobooth Prints Redeemed (non-game)', '', '', overview.aiPhotoboothPrints]);
  currentRow++;

  // 2. Daily Performance Breakdown
  addSectionHeader('2. Daily Performance Breakdown');
  currentRow++;
  addTableHeader([
    'Date',
    'Total Users',
    'Total Games Played',
    'Total Prizes Redeemed',
    'Tier 1\nPrize Redeemed',
    'Tier 2\nPrize Redeemed',
    'AI Photo Prints',
    'Peak Hour(s)',
    'Notes',
    ''
  ]);

  daily.forEach((day, index) => {
    addDataRow([
      `Day ${index + 1}`,
      day.totalUsers,
      day.totalGamesPlayed,
      day.totalPrizesRedeemed,
      day.tier1PrizeRedeemed,
      day.tier2PrizeRedeemed,
      day.aiPhotoPrints,
      day.peakHour,
      '',
      ''
    ]);
  });
  currentRow++;

  // 3. Game Level Breakdown
  // 3. Game Level Breakdown
  addSectionHeader('3. Game Level Breakdown');
  currentRow++;

  // 3.1 Total Engagement by Game
  const subHeaderRow = worksheet.getRow(currentRow);
  subHeaderRow.getCell(1).value = '3.1 Total Engagement by Game';
  currentRow++;
  addTableHeader(['Game', 'Total Plays', 'Unique Users', '', 'Tier 1 Earned', 'Tier 2 Earned', '', '', '', '']);
  gameEngagement.forEach(game => {
    addDataRow([
      game.game,
      game.totalPlays,
      game.uniqueUsers,
      '',
      game.tier1Prizes,
      game.tier2Prizes,
      '',
      '',
      '',
      ''
    ]);
  });
  currentRow++;

  // 3.2 Prize Redemption by Game
  const subHeaderRow2 = worksheet.getRow(currentRow);
  subHeaderRow2.getCell(1).value = '3.2 Prize Redemption by Game';
  currentRow++;

  addTableHeader(['Game', 'Tier 1 Prizes', 'Tier 2 Prizes', '% of Total Prizes', '', '', '', '', '', '']);
  prizeRedemption.forEach(game => {
    addDataRow([
      game.game,
      game.tier1Prizes,
      game.tier2Prizes,
      game.percentOfTotal,
      '',
      '',
      '',
      '',
      '',
      ''
    ]);
  });
  currentRow++;

  // 4. Hourly Traffic Analysis
  addSectionHeader('4. Hourly Traffic Analysis');
  currentRow++;
  addTableHeader(['Week 1', 'Hour', '# Users', 'Notes (crowd trend, weather, mall activity)', '', '', '', '', '', '']);
  hourlyTraffic.forEach(slot => {
    addDataRow(['Week 1', slot.hour, slot.users, '', '', '', '', '', '', '']);
  });
  currentRow++;

  // 5. Operational Notes
  addSectionHeader('5. Operational Notes');
  currentRow++;

  // 5.1 Incident Log
  const subHeaderRow3 = worksheet.getRow(currentRow);
  subHeaderRow3.getCell(1).value = '5.1 Incident Log';
  currentRow++;

  addTableHeader(['Date', 'Time', 'Issue', '', '', 'Action Taken', 'Status', '', '', '']);
  // Add 7 empty rows for manual entry
  for (let i = 0; i < 7; i++) {
    addDataRow(['', '', '', '', '', '', '', '', '', '']);
  }
  currentRow++;

  // 5.2 Supervisor Weekly Notes
  const subHeaderRow4 = worksheet.getRow(currentRow);
  subHeaderRow4.getCell(1).value = '5.2 Supervisor Weekly Notes';
  currentRow++;

  addTableHeader(['Week', 'What Went Well', '', '', 'Challenges', '', 'Lessons Learned', '', '', 'Recommendations for Next Week']);
  addDataRow(['Week 1', '', '', '', '', '', '', '', '', '']);
  addDataRow(['Week 2', '', '', '', '', '', '', '', '', '']);
  addDataRow(['Week 3', '', '', '', '', '', '', '', '', '']);

  // Freeze top rows
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 6 }
  ];

  return workbook;
}

module.exports = {
  generateExcel
};
