const pool = require('../config/db');

async function migrate() {
  console.log('🔄 Running survey tables migration...');
  try {
    // 1. Create survey_questions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_questions (
        id SERIAL PRIMARY KEY,
        question_text TEXT NOT NULL,
        answer_type VARCHAR(50) NOT NULL, -- 'text', 'single_choice', 'multiple_choice', 'rating', 'yes_no'
        options JSONB,
        order_index INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        organization_id INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created survey_questions table');

    // 2. Create survey_answers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS survey_answers (
        id SERIAL PRIMARY KEY,
        survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES survey_questions(id) ON DELETE CASCADE,
        answer_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(survey_id, question_id)
      );
    `);
    console.log('✅ Created survey_answers table');

    // 3. Seed the 3 default questions
    const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
    const orgId = orgRes.rows.length > 0 ? orgRes.rows[0].id : 5;
    console.log(`ℹ️ Seeding questions using organization_id: ${orgId}`);

    const questions = [
      {
        question_text: 'What is the primary civic issue in your neighborhood?',
        answer_type: 'single_choice',
        options: JSON.stringify(['Water Supply', 'Road Conditions', 'Electricity', 'Healthcare', 'Security', 'Other']),
        order_index: 1
      },
      {
        question_text: 'Are you satisfied with the responsiveness of the current MLA office?',
        answer_type: 'yes_no',
        options: JSON.stringify(['Yes', 'No', 'Undecided']),
        order_index: 2
      },
      {
        question_text: 'How would you rate the overall development in your ward?',
        answer_type: 'rating',
        options: null,
        order_index: 3
      }
    ];

    const check = await pool.query('SELECT COUNT(*) FROM survey_questions');
    if (parseInt(check.rows[0].count) === 0) {
      for (const q of questions) {
        await pool.query(`
          INSERT INTO survey_questions (question_text, answer_type, options, order_index, organization_id)
          VALUES ($1, $2, $3, $4, $5)
        `, [q.question_text, q.answer_type, q.options, q.order_index, orgId]);
      }
      console.log('🌱 Seeded 3 default survey questions');
    } else {
      console.log('ℹ️ survey_questions table already contains records, skipping seeding');
    }

    console.log('🎉 Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
