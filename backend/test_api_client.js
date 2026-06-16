require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

// Helper to make HTTP requests
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function testAPI() {
  try {
    console.log('🔑 Authenticating as Super Admin...');
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: 'admin@missionftc.com',
      password: 'admin123'
    });

    if (loginRes.status !== 200 || !loginRes.body.success) {
      console.error('❌ Authentication failed:', loginRes.body);
      return;
    }

    const token = loginRes.body.data.token;
    console.log('✅ Authenticated successfully!');

    // Create a new Party Member
    console.log('\n➕ Registering a new party member with capabilities...');
    const createRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/party-members',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, {
      full_name: 'Test Volunteer ' + Date.now(),
      phone: '9988776655',
      ward_id: 1, // Seeded Aminabad Ward
      support_preference: 'BJP',
      help_preference: 'Door-to-Door Campaigning, Volunteer Coordination, Social Media Promotion, Custom Java Developer'
    });

    if (createRes.status !== 201) {
      console.error('❌ Failed to create party member:', createRes.status, createRes.body);
      return;
    }

    const member = createRes.body.data;
    console.log('✅ Created party member:', member.full_name);
    console.log('   Saved help_preference:', member.help_preference);

    // List and filter by capability
    console.log('\n🔍 Filtering party members list by capability (Door-to-Door Campaigning)...');
    const filterRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: `/api/party-members?help_preference=${encodeURIComponent('Door-to-Door Campaigning')}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (filterRes.status !== 200) {
      console.error('❌ Failed to list party members:', filterRes.body);
      return;
    }

    const matched = filterRes.body.data.some(m => m.id === member.id);
    console.log(`✅ Fetched ${filterRes.body.data.length} members. Is our created member present? ${matched ? 'YES' : 'NO'}`);

    // Fetch Analytics Summary
    console.log('\n📊 Checking analytics breakdown for capabilities...');
    const summaryRes = await makeRequest({
      hostname: 'localhost',
      port: PORT,
      path: '/api/party-members/analytics/summary',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (summaryRes.status !== 200) {
      console.error('❌ Failed to fetch analytics summary:', summaryRes.body);
      return;
    }

    const helpDistribution = summaryRes.body.data.charts.help_distribution;
    console.log('✅ Capability Distribution breakdown:');
    console.log(helpDistribution);

    // Check if custom java developer and door to door campaigning are in there
    const hasD2D = helpDistribution.some(h => h.area === 'Door-to-Door Campaigning');
    const hasJava = helpDistribution.some(h => h.area === 'Custom Java Developer');
    console.log(`   Has Door-to-Door Campaigning? ${hasD2D ? 'YES' : 'NO'}`);
    console.log(`   Has Custom Java Developer? ${hasJava ? 'YES' : 'NO'}`);

  } catch (err) {
    console.error('❌ Error during API test:', err);
  }
}

testAPI();
