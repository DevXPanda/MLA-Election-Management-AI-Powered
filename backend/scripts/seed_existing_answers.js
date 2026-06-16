const pool = require('../config/db');

async function run() {
  console.log('🔄 Seeding dummy answers for existing surveys...');
  try {
    const questionsRes = await pool.query('SELECT id, question_text FROM survey_questions ORDER BY order_index');
    const questions = questionsRes.rows;
    if (questions.length === 0) {
      console.log('❌ No questions found. Run migration first.');
      return;
    }

    const surveysRes = await pool.query('SELECT id FROM surveys');
    const surveys = surveysRes.rows;

    const dummyAnswers = [
      ['Water Supply', 'Road Conditions', '4'],
      ['Road Conditions', 'No', '2'],
      ['Electricity', 'Yes', '5'],
      ['Healthcare', 'No', '1'],
      ['Security', 'Undecided', '3'],
      ['Other', 'Yes', '4'],
      ['Water Supply', 'No', '2'],
      ['Road Conditions', 'Yes', '3'],
      ['Electricity', 'Yes', '5'],
      ['Healthcare', 'No', '2']
    ];

    for (let i = 0; i < surveys.length; i++) {
      const surveyId = surveys[i].id;
      const setIdx = i % dummyAnswers.length;

      for (let qIdx = 0; qIdx < questions.length; qIdx++) {
        await pool.query(
          `INSERT INTO survey_answers (survey_id, question_id, answer_text)
           VALUES ($1, $2, $3)
           ON CONFLICT (survey_id, question_id) DO NOTHING`,
          [surveyId, questions[qIdx].id, dummyAnswers[setIdx][qIdx] || 'Yes']
        );
      }
    }
    console.log('🎉 Seeded dummy answers successfully!');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
