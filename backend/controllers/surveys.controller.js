const pool = require('../config/db');
const { logActivity, formatResponse, sendNotification } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

// Get surveys (tenant + scope filtered)
const getSurveys = async (req, res) => {
  try {
    const { page = 1, limit = 20, support_status, surveyor_id } = req.query;

    let query = `
      SELECT s.*, v.name as voter_name, v.phone as voter_phone,
             surveyor.name as surveyor_name,
             b.name as booth_name, w.name as ward_name,
             COALESCE(
               (SELECT json_agg(json_build_object('issue_id', sr.issue_id, 'issue_name', si.name, 'severity', sr.severity, 'notes', sr.notes))
                FROM survey_responses sr JOIN survey_issues si ON sr.issue_id = si.id WHERE sr.survey_id = s.id), '[]'
             ) as issues,
             COALESCE(
               (SELECT json_agg(json_build_object(
                  'question_id', sa.question_id, 
                  'question_text', sq.question_text, 
                  'answer_type', sq.answer_type,
                  'answer_text', sa.answer_text
                ) ORDER BY sq.order_index)
                FROM survey_answers sa 
                JOIN survey_questions sq ON sa.question_id = sq.id 
                WHERE sa.survey_id = s.id), '[]'
             ) as answers
      FROM surveys s
      LEFT JOIN voters v ON s.voter_id = v.id
      LEFT JOIN users surveyor ON s.surveyor_id = surveyor.id
      LEFT JOIN booths b ON s.booth_id = b.id
      LEFT JOIN wards w ON s.ward_id = w.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    const { clause, params: scopeParams, count } = buildScopeFilter(req, 's', paramCount);
    query += clause; params = [...params, ...scopeParams]; paramCount = count;

    if (support_status) { paramCount++; query += ` AND s.support_status = $${paramCount}`; params.push(support_status); }
    if (surveyor_id) { paramCount++; query += ` AND s.surveyor_id = $${paramCount}`; params.push(surveyor_id); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY s.created_at DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Surveys fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Create survey with org_id + Socket.io emission
const createSurvey = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { voter_id, booth_id, ward_id, support_status, satisfaction_level, remarks, latitude, longitude, issues, answers } = req.body;

    if (!support_status) return res.status(400).json(formatResponse(false, 'Support status is required.'));

    // Validate custom answers
    const questionsRes = await client.query(
      'SELECT id, question_text, answer_type FROM survey_questions WHERE is_active = true AND organization_id = $1 ORDER BY order_index',
      [req.tenant]
    );
    const activeQuestions = questionsRes.rows;

    if (activeQuestions.length > 0) {
      if (!answers || !Array.isArray(answers)) {
        await client.query('ROLLBACK');
        return res.status(400).json(formatResponse(false, 'Answers to all survey questions are required.'));
      }
      
      for (const q of activeQuestions) {
        const providedAns = answers.find(a => a.question_id === q.id);
        if (!providedAns || providedAns.answer_text === undefined || providedAns.answer_text === null || String(providedAns.answer_text).trim() === '') {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, `Answer to question "${q.question_text}" is required.`));
        }
      }
    }

    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      if (ward_id) {
        const wardCheck = await client.query('SELECT constituency_id FROM wards WHERE id = $1', [ward_id]);
        if (!wardCheck.rows.length || wardCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, 'Ward does not belong to your constituency.'));
        }
      }
      if (booth_id) {
        const boothCheck = await client.query('SELECT w.constituency_id FROM booths b JOIN wards w ON b.ward_id = w.id WHERE b.id = $1', [booth_id]);
        if (!boothCheck.rows.length || boothCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, 'Booth does not belong to your constituency.'));
        }
      }
      if (voter_id) {
        const voterCheck = await client.query('SELECT constituency_id FROM voters WHERE id = $1', [voter_id]);
        if (!voterCheck.rows.length || voterCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(formatResponse(false, 'Voter does not belong to your constituency.'));
        }
      }
    }

    const surveyResult = await client.query(
      `INSERT INTO surveys (voter_id, booth_id, ward_id, surveyor_id, support_status, satisfaction_level, remarks, latitude, longitude, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [voter_id || null, booth_id || null, ward_id || null, req.user.id, support_status, satisfaction_level || null, remarks, latitude || null, longitude || null, req.tenant]
    );

    const surveyId = surveyResult.rows[0].id;

    // Save custom answers
    if (answers && Array.isArray(answers) && answers.length > 0) {
      for (const ans of answers) {
        const isValidQuestion = activeQuestions.some(q => q.id === parseInt(ans.question_id));
        if (isValidQuestion) {
          await client.query(
            `INSERT INTO survey_answers (survey_id, question_id, answer_text) 
             VALUES ($1, $2, $3)
             ON CONFLICT (survey_id, question_id) DO UPDATE SET answer_text = EXCLUDED.answer_text`, 
            [surveyId, parseInt(ans.question_id), String(ans.answer_text)]
          );
        }
      }
    }

    if (issues && Array.isArray(issues) && issues.length > 0) {
      for (const issue of issues) {
        await client.query('INSERT INTO survey_responses (survey_id, issue_id, severity, notes) VALUES ($1, $2, $3, $4)', [surveyId, issue.issue_id, issue.severity || null, issue.notes || null]);
      }
    }

    if (voter_id) {
      await client.query('UPDATE voters SET support_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [support_status, voter_id]);
    }

    await client.query('COMMIT');
    await logActivity(req.user.id, 'SURVEY_SUBMITTED', 'surveys', { voter_id, support_status }, req.ip, req.tenant);

    // Real-time emission
    if (req.io) {
      req.io.to(`org_${req.tenant}`).emit('survey:created', surveyResult.rows[0]);
    }

    // Notify organization leads of new survey data
    await sendNotification(
      req, 
      null, // Broadcast to relevant managers in the org room (logic inside sendNotification)
      'New Survey Data', 
      `A new survey has been submitted for Booth ${booth_id || 'N/A'}.`, 
      'info', 
      '/dashboard/surveys'
    );

    res.status(201).json(formatResponse(true, 'Survey submitted.', surveyResult.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  } finally {
    client.release();
  }
};

// Delete survey
const deleteSurvey = async (req, res) => {
  try {
    let scopeClause = '';
    const scopeParams = [req.params.id, req.tenant];
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      scopeClause = ' AND EXISTS (SELECT 1 FROM wards w WHERE w.id = surveys.ward_id AND w.constituency_id = $3)';
      scopeParams.push(req.scope.constituency_id);
    }
    const result = await pool.query(`DELETE FROM surveys WHERE id = $1 AND organization_id = $2${scopeClause} RETURNING id`, scopeParams);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Survey deleted.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Survey analytics (org-scoped)
const getSurveyStats = async (req, res) => {
  try {
    const { clause, params } = buildScopeFilter(req, 's');
    const { clause: baseClause, params: baseParams } = buildScopeFilter(req);

    const totalSurveys = await pool.query(`SELECT COUNT(*) FROM surveys WHERE 1=1 ${baseClause}`, baseParams);
    
    const supportBreakdown = await pool.query(`
      SELECT support_status, COUNT(*) as count,
             ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM surveys WHERE 1=1 ${baseClause}), 0) * 100, 1) as percentage
      FROM surveys 
      WHERE 1=1 ${baseClause}
      GROUP BY support_status 
      ORDER BY count DESC
    `, baseParams);

    const topIssues = await pool.query(`
      SELECT si.name as issue, COUNT(sr.id) as count
      FROM survey_responses sr
      JOIN survey_issues si ON sr.issue_id = si.id
      JOIN surveys s ON sr.survey_id = s.id
      WHERE 1=1 ${clause}
      GROUP BY si.name ORDER BY count DESC LIMIT 10
    `, params);

    const boothWise = await pool.query(`
      SELECT b.name as booth_name, s.support_status, COUNT(*) as count
      FROM surveys s 
      JOIN booths b ON s.booth_id = b.id 
      WHERE 1=1 ${clause}
      GROUP BY b.name, s.support_status ORDER BY b.name
    `, params);

    const dailyTrend = await pool.query(`
      SELECT DATE(s.created_at) as date, s.support_status, COUNT(*) as count
      FROM surveys s
      WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days' ${clause}
      GROUP BY DATE(s.created_at), s.support_status ORDER BY date
    `, params);

    // Dynamic survey questions stats breakdown
    const questionStatsResult = await pool.query(`
      SELECT sq.id as question_id, sq.question_text, sq.answer_type, sa.answer_text, COUNT(*) as count
      FROM survey_answers sa
      JOIN survey_questions sq ON sa.question_id = sq.id
      JOIN surveys s ON sa.survey_id = s.id
      WHERE 1=1 ${clause}
      GROUP BY sq.id, sq.question_text, sq.answer_type, sa.answer_text
      ORDER BY sq.id, count DESC
    `, params);

    const questionsBreakdown = {};
    questionStatsResult.rows.forEach(row => {
      if (!questionsBreakdown[row.question_id]) {
        questionsBreakdown[row.question_id] = {
          question_id: row.question_id,
          question_text: row.question_text,
          answer_type: row.answer_type,
          responses: []
        };
      }
      questionsBreakdown[row.question_id].responses.push({
        answer: row.answer_text,
        count: parseInt(row.count)
      });
    });

    res.json(formatResponse(true, 'Survey stats fetched.', {
      total: parseInt(totalSurveys.rows[0].count),
      support_breakdown: supportBreakdown.rows,
      top_issues: topIssues.rows,
      booth_wise: boothWise.rows,
      daily_trend: dailyTrend.rows,
      questions_breakdown: Object.values(questionsBreakdown)
    }));
  } catch (error) {
    console.error('Survey stats error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const getSurveyIssues = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM survey_issues WHERE is_active = true ORDER BY name');
    res.json(formatResponse(true, 'Survey issues fetched.', result.rows));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const createSurveyIssue = async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const result = await pool.query('INSERT INTO survey_issues (name, category, description) VALUES ($1, $2, $3) RETURNING *', [name, category || null, description || null]);
    res.status(201).json(formatResponse(true, 'Issue created.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Get active survey questions
const getSurveyQuestions = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM survey_questions WHERE is_active = true AND organization_id = $1 ORDER BY order_index',
      [req.tenant]
    );
    res.json(formatResponse(true, 'Questions fetched.', result.rows));
  } catch (error) {
    console.error('Error fetching survey questions:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = { 
  getSurveys, 
  createSurvey, 
  deleteSurvey, 
  getSurveyStats, 
  getSurveyIssues, 
  createSurveyIssue,
  getSurveyQuestions
};
