const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');

// Get all media (tenant-scoped)
const getMedia = async (req, res) => {
  try {
    const { page = 1, limit = 20, file_type, category } = req.query;

    let query = `
      SELECT m.*, u.name as uploaded_by_name
      FROM media m
      LEFT JOIN users u ON m.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (!req.scope?.unrestricted) {
      paramCount++; query += ` AND m.organization_id = $${paramCount}`; params.push(req.tenant);
    }
    if (file_type) { paramCount++; query += ` AND m.file_type = $${paramCount}`; params.push(file_type); }
    if (category) { paramCount++; query += ` AND m.category = $${paramCount}`; params.push(category); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY m.created_at DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Media fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const createMedia = async (req, res) => {
  try {
    const { title, file_url, file_type, file_size, category } = req.body;
    if (!file_url || !file_type) return res.status(400).json(formatResponse(false, 'File URL and type are required.'));

    const result = await pool.query(
      `INSERT INTO media (title, file_url, file_type, file_size, category, uploaded_by, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, file_url, file_type, file_size || 0, category || null, req.user.id, req.tenant]
    );

    await logActivity(req.user.id, 'MEDIA_UPLOADED', 'media', { title, file_type }, req.ip, req.tenant);
    res.status(201).json(formatResponse(true, 'Media uploaded.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const trackDownload = async (req, res) => {
  try {
    await pool.query('UPDATE media SET download_count = download_count + 1 WHERE id = $1 AND organization_id = $2', [req.params.id, req.tenant]);
    res.json(formatResponse(true, 'Download tracked.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const deleteMedia = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM media WHERE id = $1 AND organization_id = $2 RETURNING id', [req.params.id, req.tenant]);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Not found.'));
    await logActivity(req.user.id, 'MEDIA_DELETED', 'media', { id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Media deleted.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

module.exports = { getMedia, createMedia, trackDownload, deleteMedia };
