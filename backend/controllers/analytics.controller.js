/**
 * ANALYTICS CONTROLLER — Advanced Election Intelligence
 * ─────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   GET /analytics/booth-strength     → Win probability per booth
 *   GET /analytics/ward-survey-count  → Surveys aggregated by ward
 *   GET /analytics/top-issues         → Top issues by frequency
 *   GET /analytics/worker-performance → Worker ranking by completed tasks
 *   GET /analytics/daily-trends       → Daily survey submission trends
 *   GET /analytics/overview           → All-in-one analytics summary
 */
const pool = require('../config/db');
const { formatResponse } = require('../utils/helpers');

// ── Booth-level win probability ─────────────────────────────────────
const getBoothStrength = async (req, res) => {
  try {
    const orgAnd = req.scope?.unrestricted ? '' : ` AND s.organization_id = ${req.tenant}`;

    const result = await pool.query(`
      SELECT
        b.id as booth_id,
        b.name as booth_name,
        w.name as ward_name,
        COUNT(s.id) as total_surveys,
        COUNT(CASE WHEN s.support_status = 'supporter' THEN 1 END) as supporters,
        COUNT(CASE WHEN s.support_status = 'opponent' THEN 1 END) as opponents,
        COUNT(CASE WHEN s.support_status = 'neutral' THEN 1 END) as neutral,
        COUNT(CASE WHEN s.support_status = 'undecided' THEN 1 END) as undecided,
        CASE
          WHEN COUNT(s.id) = 0 THEN 0
          ELSE ROUND(COUNT(CASE WHEN s.support_status = 'supporter' THEN 1 END)::numeric / COUNT(s.id) * 100, 1)
        END as support_percentage
      FROM booths b
      LEFT JOIN surveys s ON s.booth_id = b.id${orgAnd}
      LEFT JOIN wards w ON b.ward_id = w.id
      GROUP BY b.id, b.name, w.name
      ORDER BY support_percentage DESC
    `);

    // Classify each booth
    const booths = result.rows.map(booth => {
      const pct = parseFloat(booth.support_percentage);
      let classification;
      if (pct > 60) classification = 'strong';
      else if (pct >= 40) classification = 'competitive';
      else if (booth.total_surveys == 0) classification = 'no_data';
      else classification = 'weak';

      return { ...booth, classification };
    });

    // Summary counts
    const summary = {
      total_booths: booths.length,
      strong: booths.filter(b => b.classification === 'strong').length,
      competitive: booths.filter(b => b.classification === 'competitive').length,
      weak: booths.filter(b => b.classification === 'weak').length,
      no_data: booths.filter(b => b.classification === 'no_data').length,
    };

    res.json(formatResponse(true, 'Booth strength analysis.', { booths, summary }));
  } catch (error) {
    console.error('Booth strength error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── Ward-wise survey count ──────────────────────────────────────────
const getWardSurveyCount = async (req, res) => {
  try {
    const orgAnd = req.scope?.unrestricted ? '' : ` AND s.organization_id = ${req.tenant}`;

    const result = await pool.query(`
      SELECT w.id as ward_id, w.name as ward_name,
             COUNT(s.id) as total_surveys,
             COUNT(CASE WHEN s.support_status = 'supporter' THEN 1 END) as supporters,
             COUNT(CASE WHEN s.support_status = 'opponent' THEN 1 END) as opponents,
             COUNT(CASE WHEN s.support_status = 'neutral' THEN 1 END) as neutral
      FROM wards w
      LEFT JOIN surveys s ON s.ward_id = w.id${orgAnd}
      GROUP BY w.id, w.name
      ORDER BY total_surveys DESC
    `);

    res.json(formatResponse(true, 'Ward survey count.', result.rows));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// ── Top issues by frequency ─────────────────────────────────────────
const getTopIssues = async (req, res) => {
  try {
    const orgAnd = req.scope?.unrestricted ? '' : ` AND s.organization_id = ${req.tenant}`;

    const result = await pool.query(`
      SELECT si.id, si.name as issue_name, si.category,
             COUNT(sr.id) as frequency,
             ROUND(AVG(CASE sr.severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END), 1) as avg_severity
      FROM survey_responses sr
      JOIN survey_issues si ON sr.issue_id = si.id
      JOIN surveys s ON sr.survey_id = s.id
      WHERE 1=1${orgAnd}
      GROUP BY si.id, si.name, si.category
      ORDER BY frequency DESC
      LIMIT 20
    `);

    res.json(formatResponse(true, 'Top issues.', result.rows));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// ── Worker performance ranking ──────────────────────────────────────
const getWorkerPerformance = async (req, res) => {
  try {
    const orgAnd = req.scope?.unrestricted ? '' : ` AND u.organization_id = ${req.tenant}`;

    const result = await pool.query(`
      SELECT u.id, u.name, u.phone,
             r.display_name as role_name,
             COUNT(DISTINCT t_all.id) as total_tasks,
             COUNT(DISTINCT t_done.id) as completed_tasks,
             COUNT(DISTINCT sv.id) as surveys_done,
             CASE WHEN COUNT(DISTINCT t_all.id) = 0 THEN 0
                  ELSE ROUND(COUNT(DISTINCT t_done.id)::numeric / COUNT(DISTINCT t_all.id) * 100, 0)
             END as completion_rate
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN tasks t_all ON t_all.assigned_to = u.id
      LEFT JOIN tasks t_done ON t_done.assigned_to = u.id AND t_done.status = 'completed'
      LEFT JOIN surveys sv ON sv.surveyor_id = u.id
      WHERE u.status = 'active'${orgAnd}
      GROUP BY u.id, u.name, u.phone, r.display_name
      HAVING COUNT(DISTINCT t_all.id) > 0 OR COUNT(DISTINCT sv.id) > 0
      ORDER BY completion_rate DESC, surveys_done DESC
      LIMIT 50
    `);

    res.json(formatResponse(true, 'Worker performance ranking.', result.rows));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// ── Daily survey trends (30 days) ───────────────────────────────────
const getDailyTrends = async (req, res) => {
  try {
    const orgAnd = req.scope?.unrestricted ? '' : ` AND organization_id = ${req.tenant}`;

    const result = await pool.query(`
      SELECT DATE(created_at) as date, support_status, COUNT(*) as count
      FROM surveys
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'${orgAnd}
      GROUP BY DATE(created_at), support_status
      ORDER BY date
    `);

    res.json(formatResponse(true, 'Daily survey trends.', result.rows));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// ── Combined overview ───────────────────────────────────────────────
const getAnalyticsOverview = async (req, res) => {
  try {
    const orgFilter = req.scope?.unrestricted ? '' : ` WHERE organization_id = ${req.tenant}`;
    const orgAnd = req.scope?.unrestricted ? '' : ` AND organization_id = ${req.tenant}`;

    const [totalVoters, totalSurveys, totalTasks, completedTasks] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM voters${orgFilter}`),
      pool.query(`SELECT COUNT(*) FROM surveys${orgFilter}`),
      pool.query(`SELECT COUNT(*) FROM tasks${orgFilter}`),
      pool.query(`SELECT COUNT(*) FROM tasks WHERE status = 'completed'${orgAnd}`),
    ]);

    const surveyRate = parseInt(totalVoters.rows[0].count) > 0
      ? Math.round(parseInt(totalSurveys.rows[0].count) / parseInt(totalVoters.rows[0].count) * 100)
      : 0;

    const taskCompletionRate = parseInt(totalTasks.rows[0].count) > 0
      ? Math.round(parseInt(completedTasks.rows[0].count) / parseInt(totalTasks.rows[0].count) * 100)
      : 0;

    res.json(formatResponse(true, 'Analytics overview.', {
      total_voters: parseInt(totalVoters.rows[0].count),
      total_surveys: parseInt(totalSurveys.rows[0].count),
      survey_coverage_rate: surveyRate,
      total_tasks: parseInt(totalTasks.rows[0].count),
      completed_tasks: parseInt(completedTasks.rows[0].count),
      task_completion_rate: taskCompletionRate,
    }));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

module.exports = {
  getBoothStrength,
  getWardSurveyCount,
  getTopIssues,
  getWorkerPerformance,
  getDailyTrends,
  getAnalyticsOverview,
};
