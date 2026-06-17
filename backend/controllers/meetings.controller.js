const pool = require('../config/db');
const { formatResponse, logActivity, sendNotification } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

// ── Zoom OAuth Token Cache ────────────────────────────────────────────
let zoomTokenCache = { token: null, expiresAt: 0 };

/**
 * Get Zoom OAuth Access Token (Server-to-Server OAuth)
 */
const getZoomAccessToken = async () => {
  const now = Date.now();
  if (zoomTokenCache.token && zoomTokenCache.expiresAt > now + 60000) {
    return zoomTokenCache.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  console.log('[Meetings debug] Loaded Zoom credentials:', {
    ZOOM_ACCOUNT_ID: accountId ? `"${accountId}"` : 'undefined',
    ZOOM_CLIENT_ID: clientId ? `"${clientId}"` : 'undefined',
    ZOOM_CLIENT_SECRET: clientSecret ? 'defined' : 'undefined'
  });

  if (!accountId || !clientId || !clientSecret) {
    console.warn('[Meetings] Zoom credentials not configured. Meeting links will not be generated.');
    return null;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Meetings] Zoom OAuth error:', errText);
      return null;
    }

    const data = await response.json();
    zoomTokenCache = {
      token: data.access_token,
      expiresAt: now + (data.expires_in * 1000),
    };
    return data.access_token;
  } catch (err) {
    console.error('[Meetings] Zoom OAuth fetch error:', err.message);
    return null;
  }
};

/**
 * Create a Zoom meeting via API
 */
const createZoomMeeting = async (title, startTime, duration, description) => {
  const token = await getZoomAccessToken();
  if (!token) return null;

  try {
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: title,
        type: 2, // scheduled
        start_time: startTime,
        duration: duration || 60,
        agenda: description || '',
        settings: {
          join_before_host: true,
          waiting_room: false,
          mute_upon_entry: true,
          auto_recording: 'none',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Meetings] Zoom create meeting error:', errText);
      return null;
    }

    const data = await response.json();
    return {
      zoom_meeting_id: String(data.id),
      zoom_join_url: data.join_url,
      zoom_start_url: data.start_url,
      zoom_passcode: data.password || '',
    };
  } catch (err) {
    console.error('[Meetings] Zoom create meeting fetch error:', err.message);
    return null;
  }
};

/**
 * Update a Zoom meeting via API
 */
const updateZoomMeeting = async (zoomMeetingId, title, startTime, duration, description) => {
  const token = await getZoomAccessToken();
  if (!token || !zoomMeetingId) return false;

  try {
    const response = await fetch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: title,
        start_time: startTime,
        duration: duration || 60,
        agenda: description || '',
      }),
    });

    return response.ok || response.status === 204;
  } catch (err) {
    console.error('[Meetings] Zoom update error:', err.message);
    return false;
  }
};

/**
 * Delete a Zoom meeting via API
 */
const deleteZoomMeeting = async (zoomMeetingId) => {
  const token = await getZoomAccessToken();
  if (!token || !zoomMeetingId) return false;

  try {
    const response = await fetch(`https://api.zoom.us/v2/meetings/${zoomMeetingId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    return response.ok || response.status === 204;
  } catch (err) {
    console.error('[Meetings] Zoom delete error:', err.message);
    return false;
  }
};

/**
 * Send WhatsApp message using the existing REST API config from .env
 */
const sendWhatsAppInvite = async (phone, message) => {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const instanceId = process.env.WHATSAPP_INSTANCE_ID;
  const defaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';

  if (!apiUrl || !apiToken || !instanceId) {
    console.warn('[Meetings] WhatsApp API not configured. Skipping invite.');
    return false;
  }

  let cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = defaultCountryCode + cleanPhone;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: cleanPhone,
        type: 'text',
        message: message,
        instance_id: instanceId,
        access_token: apiToken,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('[Meetings] WhatsApp send error:', err.message);
    return false;
  }
};

// ── GET /api/meetings ─────────────────────────────────────────────────
const getMeetings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, tab } = req.query;

    let query = `
      SELECT m.*, c.name as constituency_name, creator.name as created_by_name,
             (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id) as participant_count
      FROM meetings m
      LEFT JOIN constituencies c ON m.constituency_id = c.id
      LEFT JOIN users creator ON m.created_by = creator.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // Tenant + scope filter
    const { clause, params: scopeParams, count } = buildScopeFilter(req, 'm', paramCount);
    query += clause; params = [...params, ...scopeParams]; paramCount = count;

    if (status) {
      paramCount++;
      query += ` AND m.status = $${paramCount}`;
      params.push(status);
    }

    if (tab === 'upcoming') {
      query += ` AND m.meeting_date >= NOW() AND m.status IN ('scheduled')`;
    } else if (tab === 'past') {
      query += ` AND (m.meeting_date < NOW() OR m.status IN ('completed', 'cancelled'))`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY m.meeting_date DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Meetings fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) {
    console.error('[Meetings] getMeetings error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── GET /api/meetings/stats ───────────────────────────────────────────
const getMeetingStats = async (req, res) => {
  try {
    let baseFilter = ' WHERE 1=1';
    const params = [];
    let paramCount = 0;

    const { clause, params: scopeParams, count } = buildScopeFilter(req, 'm', paramCount);
    baseFilter += clause; params.push(...scopeParams); paramCount = count;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_meetings,
        COUNT(*) FILTER (WHERE m.status = 'scheduled' AND m.meeting_date >= NOW()) as upcoming_meetings,
        COUNT(*) FILTER (WHERE m.status = 'completed') as completed_meetings,
        COUNT(*) FILTER (WHERE m.status = 'cancelled') as cancelled_meetings,
        (SELECT COUNT(*) FROM meeting_participants mp 
         INNER JOIN meetings m2 ON mp.meeting_id = m2.id 
         ${baseFilter.replace(/m\./g, 'm2.')}) as total_participants
      FROM meetings m
      ${baseFilter}
    `;

    const result = await pool.query(statsQuery, params);
    res.json(formatResponse(true, 'Meeting stats fetched.', result.rows[0]));
  } catch (error) {
    console.error('[Meetings] getMeetingStats error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── GET /api/meetings/:id ─────────────────────────────────────────────
const getMeetingById = async (req, res) => {
  try {
    const meetingId = req.params.id;

    const meetingResult = await pool.query(
      `SELECT m.*, c.name as constituency_name, creator.name as created_by_name
       FROM meetings m
       LEFT JOIN constituencies c ON m.constituency_id = c.id
       LEFT JOIN users creator ON m.created_by = creator.id
       WHERE m.id = $1 AND m.organization_id = $2`,
      [meetingId, req.tenant]
    );

    if (!meetingResult.rows.length) {
      return res.status(404).json(formatResponse(false, 'Meeting not found.'));
    }

    const participantsResult = await pool.query(
      `SELECT mp.*, u.name, u.phone, u.email, r.display_name as role_name
       FROM meeting_participants mp
       JOIN users u ON mp.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE mp.meeting_id = $1
       ORDER BY mp.created_at`,
      [meetingId]
    );

    const meeting = meetingResult.rows[0];
    meeting.participants = participantsResult.rows;

    res.json(formatResponse(true, 'Meeting fetched.', meeting));
  } catch (error) {
    console.error('[Meetings] getMeetingById error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── POST /api/meetings ────────────────────────────────────────────────
const createMeeting = async (req, res) => {
  try {
    let {
      title, description, meeting_type, meeting_date, duration,
      constituency_id, participant_ids, send_whatsapp
    } = req.body;

    if (!title || !meeting_date) {
      return res.status(400).json(formatResponse(false, 'Title and meeting date are required.'));
    }

    // MLA scope enforcement
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      constituency_id = req.scope.constituency_id;
    }

    // Create Zoom meeting
    const zoomData = await createZoomMeeting(title, meeting_date, duration || 60, description);

    const insertResult = await pool.query(
      `INSERT INTO meetings (title, description, meeting_type, meeting_date, duration,
        zoom_meeting_id, zoom_join_url, zoom_start_url, zoom_passcode,
        status, constituency_id, created_by, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        title, description || null, meeting_type || 'scheduled', meeting_date, duration || 60,
        zoomData?.zoom_meeting_id || null,
        zoomData?.zoom_join_url || null,
        zoomData?.zoom_start_url || null,
        zoomData?.zoom_passcode || null,
        'scheduled',
        constituency_id || null,
        req.user.id,
        req.tenant
      ]
    );

    const meeting = insertResult.rows[0];

    // Add participants
    if (participant_ids && participant_ids.length > 0) {
      for (const userId of participant_ids) {
        await pool.query(
          `INSERT INTO meeting_participants (meeting_id, user_id, status)
           VALUES ($1, $2, 'invited')
           ON CONFLICT (meeting_id, user_id) DO NOTHING`,
          [meeting.id, userId]
        );
      }

      // Send in-app notifications
      for (const userId of participant_ids) {
        await sendNotification(req, userId,
          'Meeting Invitation',
          `You have been invited to "${title}" on ${new Date(meeting_date).toLocaleString()}.`,
          'meeting',
          `/dashboard/meetings`
        );
      }

      // Send WhatsApp invites
      if (send_whatsapp && zoomData?.zoom_join_url) {
        const usersResult = await pool.query(
          `SELECT id, name, phone FROM users WHERE id = ANY($1)`,
          [participant_ids]
        );

        for (const user of usersResult.rows) {
          if (user.phone) {
            const dateStr = new Date(meeting_date).toLocaleString('en-IN', {
              dateStyle: 'full', timeStyle: 'short'
            });
            const msg = `🎥 *Meeting Invitation*\n\n` +
              `📌 *${title}*\n` +
              `📅 ${dateStr}\n` +
              `⏱ Duration: ${duration || 60} min\n\n` +
              `🔗 *Join Link:* ${zoomData.zoom_join_url}\n` +
              (zoomData.zoom_passcode ? `🔑 Passcode: ${zoomData.zoom_passcode}\n\n` : '\n') +
              `You are invited by ${req.user.name || 'the admin'}. Please join on time.`;

            await sendWhatsAppInvite(user.phone, msg);
          }
        }
      }
    }

    await logActivity(req.user.id, 'MEETING_CREATED', 'meetings', { title, meeting_type }, req.ip, req.tenant);
    res.status(201).json(formatResponse(true, 'Meeting created successfully.', meeting));
  } catch (error) {
    console.error('[Meetings] createMeeting error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── PUT /api/meetings/:id ─────────────────────────────────────────────
const updateMeeting = async (req, res) => {
  try {
    const meetingId = req.params.id;
    const { title, description, meeting_date, duration, status, constituency_id } = req.body;

    // Get existing meeting
    const existing = await pool.query(
      'SELECT * FROM meetings WHERE id = $1 AND organization_id = $2',
      [meetingId, req.tenant]
    );

    if (!existing.rows.length) {
      return res.status(404).json(formatResponse(false, 'Meeting not found.'));
    }

    const oldMeeting = existing.rows[0];

    // MLA scope check
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      if (oldMeeting.constituency_id && oldMeeting.constituency_id !== req.scope.constituency_id) {
        return res.status(403).json(formatResponse(false, 'Access denied. Meeting outside constituency.'));
      }
    }

    // Update Zoom meeting if applicable
    if (oldMeeting.zoom_meeting_id && (title || meeting_date || duration)) {
      await updateZoomMeeting(
        oldMeeting.zoom_meeting_id,
        title || oldMeeting.title,
        meeting_date || oldMeeting.meeting_date,
        duration || oldMeeting.duration,
        description || oldMeeting.description
      );
    }

    const result = await pool.query(
      `UPDATE meetings SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        meeting_date = COALESCE($3, meeting_date),
        duration = COALESCE($4, duration),
        status = COALESCE($5, status),
        constituency_id = COALESCE($6, constituency_id),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND organization_id = $8
       RETURNING *`,
      [title, description, meeting_date, duration, status, constituency_id, meetingId, req.tenant]
    );

    if (!result.rows.length) {
      return res.status(404).json(formatResponse(false, 'Meeting not found.'));
    }

    await logActivity(req.user.id, 'MEETING_UPDATED', 'meetings', { title: title || oldMeeting.title }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Meeting updated successfully.', result.rows[0]));
  } catch (error) {
    console.error('[Meetings] updateMeeting error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── DELETE /api/meetings/:id ──────────────────────────────────────────
const deleteMeeting = async (req, res) => {
  try {
    const meetingId = req.params.id;

    const existing = await pool.query(
      'SELECT * FROM meetings WHERE id = $1 AND organization_id = $2',
      [meetingId, req.tenant]
    );

    if (!existing.rows.length) {
      return res.status(404).json(formatResponse(false, 'Meeting not found.'));
    }

    const oldMeeting = existing.rows[0];

    // MLA scope check
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      if (oldMeeting.constituency_id && oldMeeting.constituency_id !== req.scope.constituency_id) {
        return res.status(403).json(formatResponse(false, 'Access denied. Meeting outside constituency.'));
      }
    }

    // Delete from Zoom
    if (oldMeeting.zoom_meeting_id) {
      await deleteZoomMeeting(oldMeeting.zoom_meeting_id);
    }

    await pool.query('DELETE FROM meetings WHERE id = $1 AND organization_id = $2', [meetingId, req.tenant]);
    await logActivity(req.user.id, 'MEETING_DELETED', 'meetings', { title: oldMeeting.title }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Meeting deleted successfully.'));
  } catch (error) {
    console.error('[Meetings] deleteMeeting error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── POST /api/meetings/:id/participants ───────────────────────────────
const addParticipants = async (req, res) => {
  try {
    const meetingId = req.params.id;
    const { participant_ids } = req.body;

    if (!participant_ids || !participant_ids.length) {
      return res.status(400).json(formatResponse(false, 'Participant IDs are required.'));
    }

    // Verify meeting exists
    const meetingCheck = await pool.query(
      'SELECT id, title FROM meetings WHERE id = $1 AND organization_id = $2',
      [meetingId, req.tenant]
    );
    if (!meetingCheck.rows.length) {
      return res.status(404).json(formatResponse(false, 'Meeting not found.'));
    }

    for (const userId of participant_ids) {
      await pool.query(
        `INSERT INTO meeting_participants (meeting_id, user_id, status)
         VALUES ($1, $2, 'invited')
         ON CONFLICT (meeting_id, user_id) DO NOTHING`,
        [meetingId, userId]
      );
    }

    res.json(formatResponse(true, 'Participants added.'));
  } catch (error) {
    console.error('[Meetings] addParticipants error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── DELETE /api/meetings/:id/participants/:userId ─────────────────────
const removeParticipant = async (req, res) => {
  try {
    const { id: meetingId, userId } = req.params;

    const result = await pool.query(
      'DELETE FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2 RETURNING *',
      [meetingId, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json(formatResponse(false, 'Participant not found.'));
    }

    res.json(formatResponse(true, 'Participant removed.'));
  } catch (error) {
    console.error('[Meetings] removeParticipant error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── POST /api/meetings/:id/send-invites ──────────────────────────────
const sendInvites = async (req, res) => {
  try {
    const meetingId = req.params.id;
    const { participant_ids } = req.body; // optional filter

    const meetingResult = await pool.query(
      'SELECT * FROM meetings WHERE id = $1 AND organization_id = $2',
      [meetingId, req.tenant]
    );

    if (!meetingResult.rows.length) {
      return res.status(404).json(formatResponse(false, 'Meeting not found.'));
    }

    const meeting = meetingResult.rows[0];

    if (!meeting.zoom_join_url) {
      return res.status(400).json(formatResponse(false, 'No Zoom link available for this meeting.'));
    }

    let participantQuery = `
      SELECT u.id, u.name, u.phone FROM meeting_participants mp
      JOIN users u ON mp.user_id = u.id
      WHERE mp.meeting_id = $1
    `;
    const queryParams = [meetingId];

    if (participant_ids && participant_ids.length > 0) {
      participantQuery += ` AND mp.user_id = ANY($2)`;
      queryParams.push(participant_ids);
    }

    const participants = await pool.query(participantQuery, queryParams);

    let sentCount = 0;
    for (const user of participants.rows) {
      if (user.phone) {
        const dateStr = new Date(meeting.meeting_date).toLocaleString('en-IN', {
          dateStyle: 'full', timeStyle: 'short'
        });
        const msg = `🎥 *Meeting Reminder*\n\n` +
          `📌 *${meeting.title}*\n` +
          `📅 ${dateStr}\n` +
          `⏱ Duration: ${meeting.duration} min\n\n` +
          `🔗 *Join Link:* ${meeting.zoom_join_url}\n` +
          (meeting.zoom_passcode ? `🔑 Passcode: ${meeting.zoom_passcode}\n\n` : '\n') +
          `Please join on time.`;

        const sent = await sendWhatsAppInvite(user.phone, msg);
        if (sent) sentCount++;
      }
    }

    // Also send in-app notifications
    for (const user of participants.rows) {
      await sendNotification(req, user.id,
        'Meeting Reminder',
        `Reminder: "${meeting.title}" is coming up. Join via the Meetings module.`,
        'meeting',
        `/dashboard/meetings`
      );
    }

    res.json(formatResponse(true, `Invites sent to ${sentCount}/${participants.rows.length} participants.`));
  } catch (error) {
    console.error('[Meetings] sendInvites error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = {
  getMeetings,
  getMeetingStats,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  addParticipants,
  removeParticipant,
  sendInvites,
};
