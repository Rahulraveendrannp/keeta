// server/test-csv-report.js
// Quick test script to verify CSV report generation

const http = require('http');

const postData = JSON.stringify({
  startDate: '2025-12-01',
  endDate: '2025-12-06'
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

console.log('📊 Testing CSV Report Generation...');
console.log('Request:', { startDate: '2025-12-01', endDate: '2025-12-06' });

const req = http.request(options, (res) => {
  console.log('\n✅ Response Status:', res.statusCode);
  console.log('📄 Content-Type:', res.headers['content-type']);
  console.log('📥 Content-Disposition:', res.headers['content-disposition']);
  
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('\n✅ CSV Generated Successfully!');
      console.log('\n📊 CSV Preview (first 500 characters):');
      console.log('─'.repeat(60));
      console.log(data.substring(0, 500));
      console.log('─'.repeat(60));
      console.log('\n📊 CSV Preview (last 300 characters):');
      console.log('─'.repeat(60));
      console.log(data.substring(data.length - 300));
      console.log('─'.repeat(60));
      console.log('\n📏 Total CSV Length:', data.length, 'characters');
      console.log('📊 Total Lines:', data.split('\n').length);
    } else {
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
