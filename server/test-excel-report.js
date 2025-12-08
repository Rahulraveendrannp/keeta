// server/test-excel-report.js
// Quick test script to verify Excel report generation

const http = require('http');
const fs = require('fs');
const path = require('path');

const postData = JSON.stringify({
  startDate: '2025-12-01',
  endDate: '2025-12-03'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/admin/generate-report',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📊 Testing Excel Report Generation...');
console.log('Request:', { startDate: '2025-12-01', endDate: '2025-12-03' });

const req = http.request(options, (res) => {
  console.log('\n✅ Response Status:', res.statusCode);
  console.log('📄 Content-Type:', res.headers['content-type']);
  console.log('📥 Content-Disposition:', res.headers['content-disposition']);
  
  const chunks = [];

  res.on('data', (chunk) => {
    chunks.push(chunk);
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const buffer = Buffer.concat(chunks);
      const filename = path.join(__dirname, 'test-report.xlsx');
      
      fs.writeFileSync(filename, buffer);
      
      console.log('\n✅ Excel File Generated Successfully!');
      console.log('📁 Saved to:', filename);
      console.log('📏 File Size:', (buffer.length / 1024).toFixed(2), 'KB');
      console.log('\n🎯 Open the file to verify formatting:');
      console.log('   - Section headers with blue background');
      console.log('   - Table headers with light blue background');
      console.log('   - Borders around all data cells');
      console.log('   - Bold text for headers');
      console.log('   - Proper column widths');
    } else {
      const data = Buffer.concat(chunks).toString();
      console.log('\n❌ Error Response:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request Error:', error.message);
});

req.write(postData);
req.end();
