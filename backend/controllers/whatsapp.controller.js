const pool = require('../config/db');
const { formatResponse, logActivity } = require('../utils/helpers');

// Fetch WhatsApp Templates
const getTemplates = async (req, res) => {
  try {
    const orgId = req.tenant;
    const query = `
      SELECT * FROM whatsapp_templates 
      WHERE organization_id = $1 OR organization_id = 1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [orgId]);
    res.json(formatResponse(true, 'Templates fetched successfully.', result.rows));
  } catch (error) {
    console.error('[WhatsApp Controller] getTemplates Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Create a new WhatsApp Template
const createTemplate = async (req, res) => {
  try {
    const { name, category, language, body_text } = req.body;
    if (!name || !body_text) {
      return res.status(400).json(formatResponse(false, 'Name and body text are required.'));
    }
    const orgId = req.tenant;

    const query = `
      INSERT INTO whatsapp_templates (name, category, language, body_text, organization_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      name,
      category || 'utility',
      language || 'en',
      body_text,
      orgId
    ]);

    await logActivity(req.user.id, 'WHATSAPP_TEMPLATE_CREATED', 'whatsapp', { name }, req.ip, orgId);
    res.status(201).json(formatResponse(true, 'Template created successfully.', result.rows[0]));
  } catch (error) {
    console.error('[WhatsApp Controller] createTemplate Error:', error.message);
    if (error.code === '23505') {
      return res.status(400).json(formatResponse(false, 'A template with this name already exists.'));
    }
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Delete a WhatsApp Template
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.tenant;

    const result = await pool.query(
      `DELETE FROM whatsapp_templates WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, 'Template not found or unauthorized.'));
    }

    res.json(formatResponse(true, 'Template deleted successfully.'));
  } catch (error) {
    console.error('[WhatsApp Controller] deleteTemplate Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Fetch potential message recipients (Voters, Party Members, Workers)
const getRecipients = async (req, res) => {
  try {
    const orgId = req.tenant;
    const { type, search, ward_id, booth_id } = req.query;

    const isMLA = req.userRole === 'mla';
    const mlaConstituencyId = req.scope?.constituency_id;

    let params = [orgId];
    let paramCount = 1;

    let constituencyFilter = '';
    if (isMLA && mlaConstituencyId) {
      paramCount++;
      constituencyFilter = ` AND constituency_id = $${paramCount}`;
      params.push(mlaConstituencyId);
    }

    let searchFilter = '';
    if (search) {
      paramCount++;
      searchFilter = ` AND (name ILIKE $${paramCount} OR phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    let wardFilter = '';
    if (ward_id) {
      paramCount++;
      wardFilter = ` AND ward_id = $${paramCount}`;
      params.push(ward_id);
    }

    let boothFilter = '';
    if (booth_id) {
      paramCount++;
      boothFilter = ` AND booth_id = $${paramCount}`;
      params.push(booth_id);
    }

    let votersQuery = `
      SELECT v.id, v.name, v.phone, 'voter' as type,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name,
             v.constituency_id, v.ward_id, v.booth_id
      FROM voters v
      LEFT JOIN constituencies c ON v.constituency_id = c.id
      LEFT JOIN wards w ON v.ward_id = w.id
      LEFT JOIN booths b ON v.booth_id = b.id
      WHERE v.organization_id = $1 AND v.phone IS NOT NULL AND v.phone != ''
      ${constituencyFilter} ${searchFilter} ${wardFilter} ${boothFilter}
    `;

    // Party members: column full_name instead of name
    let pmSearchFilter = '';
    if (search) {
      pmSearchFilter = ` AND (full_name ILIKE $${params.indexOf(`%${search}%`) + 1} OR phone ILIKE $${params.indexOf(`%${search}%`) + 1})`;
    }
    let partyMembersQuery = `
      SELECT pm.id, pm.full_name as name, pm.phone, 'party_member' as type,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name,
             pm.constituency_id, pm.ward_id, pm.booth_id
      FROM party_members pm
      LEFT JOIN constituencies c ON pm.constituency_id = c.id
      LEFT JOIN wards w ON pm.ward_id = w.id
      LEFT JOIN booths b ON pm.booth_id = b.id
      WHERE pm.organization_id = $1 AND pm.phone IS NOT NULL AND pm.phone != ''
      ${constituencyFilter} ${pmSearchFilter} ${wardFilter} ${boothFilter}
    `;

    // Workers: users with roles campaign_manager, ward_head, booth_worker
    let workersQuery = `
      SELECT u.id, u.name, u.phone, 'worker' as type,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name,
             u.constituency_id, u.ward_id, u.booth_id
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN constituencies c ON u.constituency_id = c.id
      LEFT JOIN wards w ON u.ward_id = w.id
      LEFT JOIN booths b ON u.booth_id = b.id
      WHERE u.organization_id = $1 AND u.phone IS NOT NULL AND u.phone != ''
        AND r.name IN ('campaign_manager', 'ward_head', 'booth_worker')
      ${constituencyFilter} ${searchFilter} ${wardFilter} ${boothFilter}
    `;

    let finalQuery = '';
    if (type === 'voters') {
      finalQuery = votersQuery;
    } else if (type === 'party_members') {
      finalQuery = partyMembersQuery;
    } else if (type === 'workers') {
      finalQuery = workersQuery;
    } else {
      finalQuery = `${votersQuery} UNION ALL ${partyMembersQuery} UNION ALL ${workersQuery}`;
    }

    finalQuery += ' ORDER BY name ASC LIMIT 500';

    const result = await pool.query(finalQuery, params);
    res.json(formatResponse(true, 'Recipients fetched successfully.', result.rows));
  } catch (error) {
    console.error('[WhatsApp Controller] getRecipients Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Clean phone numbers to format: country code followed by number without + or leading zeros (e.g. 919876543210)
const formatWhatsAppPhone = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
};

// Send / Queue WhatsApp messages using official WhatsApp Business Cloud API
const sendWhatsAppMessages = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orgId = req.tenant;
    const isMLA = req.userRole === 'mla';
    const mlaConstituencyId = req.scope?.constituency_id;

    const { campaign_name, recipients, template_name, message_text, event_details } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json(formatResponse(false, 'Recipients list is required and cannot be empty.'));
    }

    if (!template_name && !message_text) {
      return res.status(400).json(formatResponse(false, 'Template name or custom message text is required.'));
    }

    // 1. Fetch settings to ensure we are configured
    const settingsRes = await client.query(
      `SELECT * FROM whatsapp_settings WHERE organization_id = $1 LIMIT 1`,
      [orgId]
    );

    let settings;
    if (settingsRes.rows.length > 0) {
      settings = settingsRes.rows[0];
    } else if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN !== 'your_meta_access_token_here') {
      settings = {
        access_token: process.env.WHATSAPP_ACCESS_TOKEN,
        phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
        business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
        webhook_verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || ''
      };
    } else if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
      settings = {
        access_token: process.env.WHATSAPP_API_TOKEN,
        phone_number_id: process.env.WHATSAPP_INSTANCE_ID || '',
        business_account_id: process.env.WHATSAPP_API_URL,
        webhook_verify_token: 'rest'
      };
    } else {
      return res.status(400).json(formatResponse(false, 'WhatsApp Business Cloud API credentials are not configured. Please configure them in the Admin Settings tab or .env file.'));
    }

    const campaignTitle = campaign_name || `Campaign - ${new Date().toLocaleString()}`;

    // 2. Create a Campaign record
    const campaignResult = await client.query(
      `INSERT INTO whatsapp_campaigns (name, sent_by, template_name, message_text, recipient_count, constituency_id, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        campaignTitle,
        req.user.id,
        template_name || null,
        message_text || null,
        recipients.length,
        isMLA ? mlaConstituencyId : null,
        orgId
      ]
    );

    const campaignId = campaignResult.rows[0].id;
    const messageIds = [];

    // 3. Loop through recipients, compile message and insert log
    for (const rec of recipients) {
      // Security Enforcement: MLA can only message contacts in their constituency
      if (isMLA && mlaConstituencyId && rec.constituency_id !== mlaConstituencyId) {
        continue; // Skip unauthorized recipients to prevent bypasses
      }

      let textToRender = message_text || '';
      if (template_name) {
        // Find template
        const templRes = await client.query(
          `SELECT body_text FROM whatsapp_templates WHERE name = $1 AND (organization_id = $2 OR organization_id = 1) LIMIT 1`,
          [template_name, orgId]
        );
        if (templRes.rows.length > 0) {
          textToRender = templRes.rows[0].body_text;
        }
      }

      // Compile placeholders
      const renderedText = textToRender
        .replace(/{{Name}}/g, rec.name || '')
        .replace(/{{Ward}}/g, rec.ward_name || 'N/A')
        .replace(/{{Booth}}/g, rec.booth_name || 'N/A')
        .replace(/{{Constituency}}/g, rec.constituency_name || 'N/A')
        .replace(/{{Event}}/g, event_details || 'N/A');

      const msgResult = await client.query(
        `INSERT INTO whatsapp_messages (campaign_id, sender_id, recipient_type, recipient_id, recipient_name, recipient_phone, message_text, status, constituency_id, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          campaignId,
          req.user.id,
          rec.type || 'custom',
          rec.id || null,
          rec.name,
          rec.phone,
          renderedText,
          'pending',
          rec.constituency_id || null,
          orgId
        ]
      );
      messageIds.push(msgResult.rows[0].id);
    }

    await client.query('COMMIT');

    // 4. Trigger asynchronous Meta API delivery flow (chunked batches of 20 with 500ms intervals, with retries)
    if (messageIds.length > 0) {
      processBackgroundCampaign(campaignId, messageIds, recipients, template_name, message_text, event_details, settings, orgId, req.io);
    }

    await logActivity(
      req.user.id,
      'WHATSAPP_CAMPAIGN_SENT',
      'whatsapp',
      { campaign_name: campaignTitle, recipient_count: messageIds.length },
      req.ip,
      orgId
    );

    res.status(201).json(
      formatResponse(true, 'Campaign created and messages initiated.', {
        campaign_id: campaignId,
        sent_count: messageIds.length
      })
    );
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[WhatsApp Controller] sendWhatsAppMessages Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  } finally {
    client.release();
  }
};

// Process Meta/REST API delivery in background
const processBackgroundCampaign = async (campaignId, messageDbIds, recipients, templateName, messageText, eventDetails, settings, orgId, io) => {
  const isRestProvider = (settings.business_account_id && settings.business_account_id.startsWith('http')) || settings.webhook_verify_token === 'rest';
  const url = isRestProvider ? settings.business_account_id : `https://graph.facebook.com/v19.0/${settings.phone_number_id}/messages`;
  const token = isRestProvider ? null : settings.access_token;
  const chunkSize = 20;

  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunkRecipients = recipients.slice(i, i + chunkSize);
    const chunkDbIds = messageDbIds.slice(i, i + chunkSize);

    await Promise.all(chunkRecipients.map(async (rec, idx) => {
      const dbId = chunkDbIds[idx];
      const cleanPhone = formatWhatsAppPhone(rec.phone);

      if (!cleanPhone) {
        await pool.query(
          `UPDATE whatsapp_messages SET status = 'failed', error_message = 'Invalid phone number format', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [dbId]
        );
        if (io) {
          io.to(`org_${orgId}`).emit('whatsapp:status_update', {
            campaignId,
            messageId: dbId,
            status: 'failed',
            error_message: 'Invalid phone number format'
          });
        }
        return;
      }

      // Pre-compile body text (for custom and REST template messages)
      let textToRender = messageText || '';
      if (templateName) {
        const templRes = await pool.query(
          `SELECT body_text FROM whatsapp_templates WHERE name = $1 AND (organization_id = $2 OR organization_id = 1) LIMIT 1`,
          [templateName, orgId]
        );
        if (templRes.rows.length > 0) {
          textToRender = templRes.rows[0].body_text;
        }
      }

      const renderedText = textToRender
        .replace(/{{Name}}/g, rec.name || '')
        .replace(/{{Ward}}/g, rec.ward_name || 'N/A')
        .replace(/{{Booth}}/g, rec.booth_name || 'N/A')
        .replace(/{{Constituency}}/g, rec.constituency_name || 'N/A')
        .replace(/{{Event}}/g, eventDetails || 'N/A');

      let payload = {};
      if (isRestProvider) {
        payload = {
          access_token: settings.access_token,
          instance_id: settings.phone_number_id,
          number: cleanPhone,
          message: renderedText,
          type: "text"
        };
      } else {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone
        };

        if (templateName) {
          const templRes = await pool.query(
            `SELECT body_text, language FROM whatsapp_templates WHERE name = $1 AND (organization_id = $2 OR organization_id = 1) LIMIT 1`,
            [templateName, orgId]
          );

          let bodyText = '';
          let langCode = 'en';
          if (templRes.rows.length > 0) {
            bodyText = templRes.rows[0].body_text;
            langCode = templRes.rows[0].language || 'en';
          }

          const parameters = [];
          const matches = bodyText.match(/{{(?:Name|Ward|Booth|Constituency|Event)}}/g) || [];
          for (const match of matches) {
            let val = 'N/A';
            if (match === '{{Name}}') val = rec.name || '';
            else if (match === '{{Ward}}') val = rec.ward_name || 'N/A';
            else if (match === '{{Booth}}') val = rec.booth_name || 'N/A';
            else if (match === '{{Constituency}}') val = rec.constituency_name || 'N/A';
            else if (match === '{{Event}}') val = eventDetails || 'N/A';
            parameters.push({ type: "text", text: String(val) });
          }

          payload.type = "template";
          payload.template = {
            name: templateName,
            language: {
              code: langCode
            },
            components: [
              {
                type: "body",
                parameters: parameters
              }
            ]
          };
        } else {
          payload.type = "text";
          payload.text = {
            body: renderedText
          };
        }
      }

      const result = await sendMetaWhatsAppMessageWithRetry(url, token, payload);

      if (result.success) {
        const wamid = (result.data?.messages && result.data.messages[0]?.id) || result.data?.message_id || `rest-${Date.now()}-${dbId}`;
        await pool.query(
          `UPDATE whatsapp_messages 
           SET whatsapp_message_id = $1, status = 'sent', retry_count = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [wamid, result.attempt, dbId]
        );

        if (io) {
          io.to(`org_${orgId}`).emit('whatsapp:status_update', {
            campaignId,
            messageId: dbId,
            status: 'sent'
          });
        }
      } else {
        await pool.query(
          `UPDATE whatsapp_messages 
           SET status = 'failed', error_message = $1, retry_count = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [result.error, result.attempt, dbId]
        );

        if (io) {
          io.to(`org_${orgId}`).emit('whatsapp:status_update', {
            campaignId,
            messageId: dbId,
            status: 'failed',
            error_message: result.error
          });
        }
      }
    }));

    if (i + chunkSize < recipients.length) {
      await sleep(500);
    }
  }
};

// Fetch list of sent campaigns
const getCampaigns = async (req, res) => {
  try {
    const orgId = req.tenant;
    const isMLA = req.userRole === 'mla';
    const mlaConstituencyId = req.scope?.constituency_id;

    let query = `
      SELECT wc.*, u.name as sender_name,
             (SELECT COUNT(*) FROM whatsapp_messages wm WHERE wm.campaign_id = wc.id) as message_count,
             (SELECT COUNT(*) FROM whatsapp_messages wm WHERE wm.campaign_id = wc.id AND wm.status = 'sent') as sent_count,
             (SELECT COUNT(*) FROM whatsapp_messages wm WHERE wm.campaign_id = wc.id AND wm.status = 'delivered') as delivered_count,
             (SELECT COUNT(*) FROM whatsapp_messages wm WHERE wm.campaign_id = wc.id AND wm.status = 'read') as read_count,
             (SELECT COUNT(*) FROM whatsapp_messages wm WHERE wm.campaign_id = wc.id AND wm.status = 'failed') as failed_count
      FROM whatsapp_campaigns wc
      LEFT JOIN users u ON wc.sent_by = u.id
      WHERE wc.organization_id = $1
    `;
    const params = [orgId];

    if (isMLA && mlaConstituencyId) {
      query += ` AND wc.constituency_id = $2`;
      params.push(mlaConstituencyId);
    }

    query += ' ORDER BY wc.created_at DESC';

    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Campaigns fetched successfully.', result.rows));
  } catch (error) {
    console.error('[WhatsApp Controller] getCampaigns Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Fetch messages under a specific campaign
const getCampaignMessages = async (req, res) => {
  try {
    const orgId = req.tenant;
    const { id } = req.params;

    // First check campaign exists in org
    const campCheck = await pool.query(
      `SELECT id FROM whatsapp_campaigns WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    if (campCheck.rows.length === 0) {
      return res.status(404).json(formatResponse(false, 'Campaign not found or unauthorized.'));
    }

    const messages = await pool.query(
      `SELECT * FROM whatsapp_messages WHERE campaign_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    res.json(formatResponse(true, 'Campaign messages fetched successfully.', messages.rows));
  } catch (error) {
    console.error('[WhatsApp Controller] getCampaignMessages Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Fetch overall campaign analytics metrics
const getCampaignAnalytics = async (req, res) => {
  try {
    const orgId = req.tenant;
    const isMLA = req.userRole === 'mla';
    const mlaConstituencyId = req.scope?.constituency_id;

    let params = [orgId];
    let scopeClause = '';
    if (isMLA && mlaConstituencyId) {
      scopeClause = ' AND constituency_id = $2';
      params.push(mlaConstituencyId);
    }

    const totalsQuery = `
      SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM whatsapp_messages
      WHERE organization_id = $1 ${scopeClause}
    `;

    const totalsResult = await pool.query(totalsQuery, params);

    const campaignsQuery = `
      SELECT COUNT(*) as total_campaigns
      FROM whatsapp_campaigns
      WHERE organization_id = $1 ${scopeClause}
    `;
    const campaignsResult = await pool.query(campaignsQuery, params);

    const timeSeriesQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_count
      FROM whatsapp_messages
      WHERE organization_id = $1 ${scopeClause}
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
      LIMIT 15
    `;
    const timeSeriesResult = await pool.query(timeSeriesQuery, params);

    const row = totalsResult.rows[0];
    const total = parseInt(row.total_messages || 0);
    const sent = parseInt(row.sent_count || 0);
    const delivered = parseInt(row.delivered_count || 0);
    const read = parseInt(row.read_count || 0);
    const failed = parseInt(row.failed_count || 0);

    const analytics = {
      total_campaigns: parseInt(campaignsResult.rows[0].total_campaigns || 0),
      total_messages: total,
      sent_count: sent,
      delivered_count: delivered,
      read_count: read,
      failed_count: failed,
      delivered_rate: total > 0 ? parseFloat(((delivered + read) / total * 100).toFixed(1)) : 0,
      read_rate: (delivered + read) > 0 ? parseFloat((read / (delivered + read) * 100).toFixed(1)) : 0,
      failed_rate: total > 0 ? parseFloat((failed / total * 100).toFixed(1)) : 0,
      time_series: timeSeriesResult.rows
    };

    res.json(formatResponse(true, 'Campaign analytics fetched successfully.', analytics));
  } catch (error) {
    console.error('[WhatsApp Controller] getCampaignAnalytics Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Fetch WhatsApp Settings (Restricted to super_admin)
const getWhatsAppSettings = async (req, res) => {
  try {
    const orgId = req.tenant;
    const result = await pool.query(
      `SELECT access_token, phone_number_id, business_account_id, webhook_verify_token 
       FROM whatsapp_settings WHERE organization_id = $1`,
      [orgId]
    );
    if (result.rows.length === 0) {
      if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN !== 'your_meta_access_token_here') {
        return res.json(formatResponse(true, 'Settings fetched successfully.', {
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || '',
          phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
          webhook_verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || ''
        }));
      }
      if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN) {
        return res.json(formatResponse(true, 'Settings fetched successfully.', {
          access_token: process.env.WHATSAPP_API_TOKEN || '',
          phone_number_id: process.env.WHATSAPP_INSTANCE_ID || '',
          business_account_id: process.env.WHATSAPP_API_URL || '',
          webhook_verify_token: 'rest'
        }));
      }
      return res.json(formatResponse(true, 'Settings fetched successfully.', {
        access_token: '',
        phone_number_id: '',
        business_account_id: '',
        webhook_verify_token: ''
      }));
    }
    res.json(formatResponse(true, 'Settings fetched successfully.', result.rows[0]));
  } catch (error) {
    console.error('[WhatsApp Controller] getWhatsAppSettings Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Save WhatsApp Settings (Restricted to super_admin)
const saveWhatsAppSettings = async (req, res) => {
  try {
    const orgId = req.tenant;
    const { access_token, phone_number_id, business_account_id, webhook_verify_token } = req.body;

    if (!access_token || !phone_number_id || !business_account_id || !webhook_verify_token) {
      return res.status(400).json(formatResponse(false, 'All settings fields are required.'));
    }

    const query = `
      INSERT INTO whatsapp_settings (organization_id, access_token, phone_number_id, business_account_id, webhook_verify_token, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (organization_id) 
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        phone_number_id = EXCLUDED.phone_number_id,
        business_account_id = EXCLUDED.business_account_id,
        webhook_verify_token = EXCLUDED.webhook_verify_token,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const result = await pool.query(query, [
      orgId,
      access_token,
      phone_number_id,
      business_account_id,
      webhook_verify_token
    ]);

    await logActivity(req.user.id, 'WHATSAPP_SETTINGS_UPDATED', 'whatsapp', { phone_number_id }, req.ip, orgId);
    res.json(formatResponse(true, 'Settings updated successfully.', result.rows[0]));
  } catch (error) {
    console.error('[WhatsApp Controller] saveWhatsAppSettings Error:', error.message);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Webhook Verification (GET /webhook)
const verifyWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token) {
      const result = await pool.query(
        `SELECT organization_id FROM whatsapp_settings WHERE webhook_verify_token = $1 LIMIT 1`,
        [token]
      );
      if (result.rows.length > 0 || (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)) {
        console.log('✅ WhatsApp Webhook verified successfully!');
        return res.status(200).send(challenge);
      }
    }
    console.error('❌ WhatsApp Webhook verification failed.');
    res.status(403).send('Verification token mismatch or invalid mode.');
  } catch (error) {
    console.error('[WhatsApp Webhook Verification] Error:', error.message);
    res.status(500).send('Internal server error.');
  }
};

// Webhook Event Receiver (POST /webhook)
const receiveWebhook = async (req, res) => {
  try {
    const { body } = req;
    
    // Respond to Meta immediately with 200 OK
    res.status(200).send('EVENT_RECEIVED');
    
    if (body.object === 'whatsapp_business_account' && body.entry) {
      for (const entry of body.entry) {
        if (!entry.changes) continue;
        for (const change of entry.changes) {
          if (change.field !== 'messages') continue;
          
          const value = change.value;
          if (!value.statuses) continue;
          
          for (const statusObj of value.statuses) {
            const wamid = statusObj.id;
            const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
            
            let errorMessage = null;
            if (status === 'failed' && statusObj.errors && statusObj.errors.length > 0) {
              errorMessage = `${statusObj.errors[0].title} (Code ${statusObj.errors[0].code})`;
            }
            
            // Find and update the message
            const updateResult = await pool.query(
              `UPDATE whatsapp_messages 
               SET status = $1, 
                   error_message = COALESCE($2, error_message),
                   updated_at = CURRENT_TIMESTAMP
               WHERE whatsapp_message_id = $3
               RETURNING id, campaign_id, organization_id`,
              [status, errorMessage, wamid]
            );
            
            if (updateResult.rows.length > 0) {
              const msg = updateResult.rows[0];
              if (req.io) {
                req.io.to(`org_${msg.organization_id}`).emit('whatsapp:status_update', {
                  campaignId: msg.campaign_id,
                  messageId: msg.id,
                  status: status,
                  error_message: errorMessage
                });
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Webhook Receiver] Error:', error.message);
  }
};

// Helper utilities
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendMetaWhatsAppMessageWithRetry = async (url, token, payload, maxRetries = 3) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      const responseData = await response.json();
      if (response.ok) {
        return { success: true, data: responseData, attempt };
      } else {
        console.error(`[WhatsApp API] Attempt ${attempt + 1} failed:`, responseData);
        attempt++;
        if (attempt >= maxRetries) {
          return { success: false, error: responseData.error?.message || responseData.message || 'Meta API failure', attempt };
        }
        await sleep(Math.pow(2, attempt) * 1000);
      }
    } catch (error) {
      console.error(`[WhatsApp Network] Attempt ${attempt + 1} failed:`, error.message);
      attempt++;
      if (attempt >= maxRetries) {
        return { success: false, error: error.message, attempt };
      }
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
};

module.exports = {
  getTemplates,
  createTemplate,
  deleteTemplate,
  getRecipients,
  sendWhatsAppMessages,
  getCampaigns,
  getCampaignMessages,
  getCampaignAnalytics,
  getWhatsAppSettings,
  saveWhatsAppSettings,
  verifyWebhook,
  receiveWebhook
};
