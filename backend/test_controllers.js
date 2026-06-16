require('dotenv').config();
const { createMember, getMembers, updateMember, getSummary } = require('./controllers/party-members.controller');
const pool = require('./config/db');

// Helper to create a mock response object
function createMockResponse() {
  const res = {
    statusCode: 200,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  try {
    console.log('🧪 Starting Controller Unit Tests...');

    // Fetch a valid user ID to avoid foreign key violations
    const userRes = await pool.query('SELECT id, name FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
      console.error('❌ No users found in database to run tests.');
      return;
    }
    const testUser = userRes.rows[0];
    console.log(`ℹ️ Using test user: ${testUser.name} (ID: ${testUser.id})`);

    // 1. Test createMember
    console.log('\nTesting createMember...');
    const createReq = {
      body: {
        full_name: 'Test Controller Vol ' + Date.now(),
        phone: '9988776600',
        ward_id: 1,
        support_preference: 'BJP',
        help_preference: 'Door-to-Door Campaigning, Social Media Promotion, Custom Java Developer'
      },
      user: { id: testUser.id },
      userRole: 'super_admin',
      tenant: 1,
      ip: '127.0.0.1'
    };
    const createRes = createMockResponse();

    await createMember(createReq, createRes);
    
    if (createRes.statusCode === 201 && createRes.body.success) {
      console.log('✅ createMember succeeded!');
      const createdMember = createRes.body.data;
      console.log('   Saved Member:', createdMember.full_name);
      console.log('   Saved help_preference:', createdMember.help_preference);
      
      // 2. Test getMembers filtering by capability
      console.log('\nTesting getMembers with help_preference filter...');
      const getReq = {
        query: {
          help_preference: 'Custom Java Developer'
        },
        user: { id: 1 },
        userRole: 'super_admin',
        tenant: 1
      };
      const getRes = createMockResponse();

      await getMembers(getReq, getRes);

      if (getRes.statusCode === 200 && getRes.body.success) {
        const list = getRes.body.data;
        const matched = list.some(m => m.id === createdMember.id);
        console.log(`✅ getMembers succeeded! Found ${list.length} matches.`);
        console.log(`   Is our created member in the filtered list? ${matched ? 'YES' : 'NO'}`);
      } else {
        console.error('❌ getMembers failed:', getRes.statusCode, getRes.body);
      }

      // 3. Test getSummary aggregations
      console.log('\nTesting getSummary capability breakdown aggregation...');
      const summaryReq = {
        user: { id: 1 },
        userRole: 'super_admin',
        tenant: 1
      };
      const summaryRes = createMockResponse();

      await getSummary(summaryReq, summaryRes);

      if (summaryRes.statusCode === 200 && summaryRes.body.success) {
        console.log('✅ getSummary succeeded!');
        const helpDistribution = summaryRes.body.data.charts.help_distribution;
        console.log('   Help Distribution Breakdown:');
        console.log(helpDistribution);
        const hasJava = helpDistribution.some(h => h.area === 'Custom Java Developer');
        console.log(`   Has 'Custom Java Developer' in distribution? ${hasJava ? 'YES' : 'NO'}`);
      } else {
        console.error('❌ getSummary failed:', summaryRes.statusCode, summaryRes.body);
      }

    } else {
      console.error('❌ createMember failed:', createRes.statusCode, createRes.body);
    }

  } catch (err) {
    console.error('❌ Error running tests:', err);
  } finally {
    // Clean up connections
    await pool.end();
    console.log('\n🏁 Tests finished.');
  }
}

runTests();
