const pool = require('../config/db');
const { buildScopeFilter } = require('../middleware/tenant');

/**
 * Role-Based Dashboard Controller
 * ─────────────────────────────────────────────────────────────────────
 * Securely aggregates data based on user role and geographical scope.
 * ─────────────────────────────────────────────────────────────────────
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { clause, params } = buildScopeFilter(req);
    const role = req.userRole;
    const userId = req.user.id;
    const orgId = req.tenant;

    let stats = {};
    let charts = {};
    let lists = {};

    // ─── ROLE-BASED DATA AGGREGATION ───

    // 1. BOOTH WORKER (Field Operations)
    // Focused strictly on personal productivity. Zero global analytics.
    if (role === 'booth_worker') {
      const myStats = await pool.query(`
        SELECT 
          COUNT(*) filter (where status = 'completed') as my_completed_tasks,
          COUNT(*) filter (where status = 'pending' OR status = 'in_progress') as my_pending_tasks,
          (SELECT COUNT(*) FROM surveys WHERE surveyor_id = $1) as total_surveys_submitted,
          (SELECT COUNT(*) FROM surveys WHERE surveyor_id = $1 AND DATE(created_at) = CURRENT_DATE) as surveys_today
        FROM tasks
        WHERE assigned_to = $1 AND organization_id = $2
      `, [userId, orgId]);

      const myTasks = await pool.query(`
        SELECT * FROM tasks 
        WHERE assigned_to = $1 AND status != 'completed'
        ORDER BY priority DESC, due_date ASC
        LIMIT 5
      `, [userId]);

      stats = myStats.rows[0];
      lists.tasks = myTasks.rows;
      // No charts for workers — keep it tactical
    }

    // 2. WARD HEAD (Localized Execution)
    // Focused on booth-level progress within their ward.
    else if (role === 'ward_head') {
      const { clause: uClause, params: uParams } = buildScopeFilter(req, 'u');
      
      const wardMetrics = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM voters WHERE 1=1${clause}`, params),
        pool.query(`SELECT COUNT(*) FROM surveys WHERE 1=1${clause}`, params),
        pool.query(`SELECT COUNT(*) FROM tasks WHERE 1=1${clause}`, params),
        pool.query(`SELECT COUNT(*) FROM users u WHERE 1=1${uClause}`, uParams),
      ]);

      const boothProgress = await pool.query(`
        SELECT b.id, b.name, COUNT(v.id) as voter_count, 
               COUNT(s.id) as survey_count,
               (COUNT(s.id) * 100.0 / NULLIF(COUNT(v.id), 0)) as coverage
        FROM booths b
        LEFT JOIN voters v ON b.id = v.booth_id
        LEFT JOIN surveys s ON v.id = s.voter_id
        WHERE b.ward_id = $1
        GROUP BY b.id, b.name
        ORDER BY coverage ASC
      `, [req.scope.ward_id]);

      stats = {
        total_voters: wardMetrics[0].rows[0].count,
        total_surveys: wardMetrics[1].rows[0].count,
        total_tasks: wardMetrics[2].rows[0].count,
        active_workers: wardMetrics[3].rows[0].count
      };
      lists.booth_progress = boothProgress.rows;
    }

    // 3. MLA / CAMPAIGN MANAGER (Strategic Insights)
    // Full constituency overview, sentiment, and trends.
    else if (role === 'mla' || role === 'campaign_manager' || role === 'super_admin') {
      const baseCounts = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM voters WHERE 1=1${clause}`, params),
        pool.query(`SELECT COUNT(*) FROM surveys WHERE 1=1${clause}`, params),
        pool.query(`SELECT COUNT(*) FROM tasks WHERE 1=1${clause}`, params),
        pool.query(`SELECT COUNT(*) FROM team_members WHERE status = 'active'${clause}`, params),
      ]);

      const sentiment = await pool.query(`
        SELECT support_status, COUNT(*) as count 
        FROM voters 
        WHERE 1=1${clause}
        GROUP BY support_status
      `, params);

      const boothStrengths = await pool.query(`
        WITH BoothStats AS (
          SELECT booth_id, COUNT(*) filter (where support_status = 'supporter') * 100.0 / NULLIF(COUNT(*), 0) as support_pct
          FROM voters WHERE 1=1${clause} GROUP BY booth_id
        )
        SELECT 
          COUNT(*) filter (where support_pct >= 60) as strong_booths,
          COUNT(*) filter (where support_pct >= 40 AND support_pct < 60) as competitive_booths,
          COUNT(*) filter (where support_pct < 40) as weak_booths
        FROM BoothStats
      `, params);

      const scopeS = buildScopeFilter(req, 's');
      const topIssues = await pool.query(`
        SELECT si.name, COUNT(sr.id) as count
        FROM survey_responses sr
        JOIN survey_issues si ON sr.issue_id = si.id
        JOIN surveys s ON sr.survey_id = s.id
        WHERE 1=1 ${scopeS.clause}
        GROUP BY si.name ORDER BY count DESC LIMIT 5
      `, scopeS.params);

      const genderBreakdown = await pool.query(`
        SELECT gender, COUNT(*) as count 
        FROM voters 
        WHERE gender IS NOT NULL AND 1=1${clause}
        GROUP BY gender
      `, params);

      const taskStatus = await pool.query(`
        SELECT status, COUNT(*) as count 
        FROM tasks 
        WHERE 1=1${clause}
        GROUP BY status
      `, params);

      const topPerformers = await pool.query(`
        SELECT u.name, COUNT(s.id) as surveys_count, 
               (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id AND t.status = 'completed') as tasks_completed
        FROM users u
        JOIN surveys s ON u.id = s.surveyor_id
        WHERE 1=1${clause.replace('organization_id', 'u.organization_id')}
        GROUP BY u.id, u.name
        ORDER BY surveys_count DESC
        LIMIT 5
      `, params);

      const surveyTrend = await pool.query(`
        WITH days AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date as day
        )
        SELECT 
          d.day as date, 
          COUNT(s.id) as count
        FROM days d
        LEFT JOIN surveys s ON DATE(s.created_at) = d.day AND 1=1${clause}
        GROUP BY d.day
        ORDER BY d.day ASC
      `, params);

      stats = {
        total_voters: baseCounts[0].rows[0].count,
        total_surveys: baseCounts[1].rows[0].count,
        total_tasks: baseCounts[2].rows[0].count,
        active_workers: baseCounts[3].rows[0].count,
        booth_strength: boothStrengths.rows[0],
        top_issues: topIssues.rows
      };
      charts.support_stats = sentiment.rows;
      charts.survey_trend = surveyTrend.rows;
      charts.gender_breakdown = genderBreakdown.rows;
      charts.task_status = taskStatus.rows;
      lists.top_performers = topPerformers.rows;
    }

    // 4. SUPER ADMIN (System Logs)
    if (role === 'super_admin') {
      const globalCounts = await Promise.all([
        pool.query('SELECT COUNT(*) FROM users'),
        pool.query('SELECT COUNT(*) FROM voters'),
        pool.query('SELECT COUNT(*) FROM surveys'),
        pool.query('SELECT COUNT(*) FROM tasks'),
        pool.query('SELECT COUNT(*) FROM events'),
        pool.query("SELECT COUNT(*) FROM users WHERE role_id IN (SELECT id FROM roles WHERE name = 'booth_worker')")
      ]);

      stats = {
        total_users: globalCounts[0].rows[0].count,
        total_voters: globalCounts[1].rows[0].count,
        total_surveys: globalCounts[2].rows[0].count,
        total_tasks: globalCounts[3].rows[0].count,
        total_events: globalCounts[4].rows[0].count,
        active_workers: globalCounts[5].rows[0].count
      };

      const logs = await pool.query(`
        SELECT al.*, u.name as user_name FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC LIMIT 10
      `);
      lists.recent_activity = logs.rows;
    }

    res.json({
      success: true,
      data: { stats, charts, lists, role }
    });

  } catch (error) {
    console.error('Dashboard logic error:', error);
    res.status(500).json({ success: false, message: 'Dashboard generation failed.' });
  }
};

exports.getActivityLog = async (req, res) => {
  try {
    const { clause, params } = buildScopeFilter(req, 'al');
    const logs = await pool.query(`
      SELECT al.*, u.name as user_name
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      WHERE 1=1 ${clause}
      ORDER BY al.created_at DESC
      LIMIT 100
    `, params);

    res.json({ success: true, data: logs.rows });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
  }
};
