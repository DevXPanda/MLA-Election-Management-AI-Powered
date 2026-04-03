const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');

// --- States ---
const getStates = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM states ORDER BY name');
    res.json(formatResponse(true, 'States fetched.', result.rows));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const createState = async (req, res) => {
  try {
    const { name, code } = req.body;
    const result = await pool.query(
      'INSERT INTO states (name, code) VALUES ($1, $2) RETURNING *',
      [name, code]
    );
    await logActivity(req.user.id, 'STATE_CREATED', 'constituency', { name }, req.ip);
    res.status(201).json(formatResponse(true, 'State created.', result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// --- Districts ---
const getDistricts = async (req, res) => {
  try {
    const { state_id } = req.query;
    let query = 'SELECT d.*, s.name as state_name FROM districts d LEFT JOIN states s ON d.state_id = s.id';
    const params = [];
    if (state_id) {
      query += ' WHERE d.state_id = $1';
      params.push(state_id);
    }
    query += ' ORDER BY d.name';
    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Districts fetched.', result.rows));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const createDistrict = async (req, res) => {
  try {
    const { name, state_id } = req.body;
    const result = await pool.query(
      'INSERT INTO districts (name, state_id) VALUES ($1, $2) RETURNING *',
      [name, state_id]
    );
    await logActivity(req.user.id, 'DISTRICT_CREATED', 'constituency', { name }, req.ip);
    res.status(201).json(formatResponse(true, 'District created.', result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// --- Constituencies ---
const getConstituencies = async (req, res) => {
  try {
    const { district_id } = req.query;
    let query = `SELECT c.*, d.name as district_name, s.name as state_name 
                 FROM constituencies c 
                 LEFT JOIN districts d ON c.district_id = d.id 
                 LEFT JOIN states s ON d.state_id = s.id`;
    const params = [];
    if (district_id) {
      query += ' WHERE c.district_id = $1';
      params.push(district_id);
    }
    query += ' ORDER BY c.name';
    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Constituencies fetched.', result.rows));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const createConstituency = async (req, res) => {
  try {
    const { name, number, district_id, mla_name } = req.body;
    const result = await pool.query(
      'INSERT INTO constituencies (name, number, district_id, mla_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, number, district_id, mla_name]
    );
    await logActivity(req.user.id, 'CONSTITUENCY_CREATED', 'constituency', { name }, req.ip);
    res.status(201).json(formatResponse(true, 'Constituency created.', result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const updateConstituency = async (req, res) => {
  try {
    const { name, number, district_id, mla_name } = req.body;
    const result = await pool.query(
      `UPDATE constituencies SET name = COALESCE($1, name), number = COALESCE($2, number), 
       district_id = COALESCE($3, district_id), mla_name = COALESCE($4, mla_name) 
       WHERE id = $5 RETURNING *`,
      [name, number, district_id, mla_name, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Constituency updated.', result.rows[0]));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const deleteConstituency = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM constituencies WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json(formatResponse(false, 'Not found.'));
    await logActivity(req.user.id, 'CONSTITUENCY_DELETED', 'constituency', { id: req.params.id }, req.ip);
    res.json(formatResponse(true, 'Constituency deleted.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// --- Wards ---
const getWards = async (req, res) => {
  try {
    const { constituency_id } = req.query;
    let query = `SELECT w.*, c.name as constituency_name 
                 FROM wards w LEFT JOIN constituencies c ON w.constituency_id = c.id`;
    const params = [];
    if (constituency_id) {
      query += ' WHERE w.constituency_id = $1';
      params.push(constituency_id);
    }
    query += ' ORDER BY w.number, w.name';
    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Wards fetched.', result.rows));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const createWard = async (req, res) => {
  try {
    const { name, number, constituency_id } = req.body;
    const result = await pool.query(
      'INSERT INTO wards (name, number, constituency_id) VALUES ($1, $2, $3) RETURNING *',
      [name, number, constituency_id]
    );
    await logActivity(req.user.id, 'WARD_CREATED', 'constituency', { name }, req.ip);
    res.status(201).json(formatResponse(true, 'Ward created.', result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const updateWard = async (req, res) => {
  try {
    const { name, number, constituency_id } = req.body;
    const result = await pool.query(
      'UPDATE wards SET name = COALESCE($1, name), number = COALESCE($2, number), constituency_id = COALESCE($3, constituency_id) WHERE id = $4 RETURNING *',
      [name, number, constituency_id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Ward updated.', result.rows[0]));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const deleteWard = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM wards WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Ward deleted.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// --- Booths ---
const getBooths = async (req, res) => {
  try {
    const { ward_id } = req.query;
    let query = `SELECT b.*, w.name as ward_name, c.name as constituency_name
                 FROM booths b 
                 LEFT JOIN wards w ON b.ward_id = w.id
                 LEFT JOIN constituencies c ON w.constituency_id = c.id`;
    const params = [];
    if (ward_id) {
      query += ' WHERE b.ward_id = $1';
      params.push(ward_id);
    }
    query += ' ORDER BY b.number, b.name';
    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Booths fetched.', result.rows));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const createBooth = async (req, res) => {
  try {
    const { name, number, ward_id, address, latitude, longitude } = req.body;
    const result = await pool.query(
      'INSERT INTO booths (name, number, ward_id, address, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, number, ward_id, address, latitude || null, longitude || null]
    );
    await logActivity(req.user.id, 'BOOTH_CREATED', 'constituency', { name }, req.ip);
    res.status(201).json(formatResponse(true, 'Booth created.', result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const updateBooth = async (req, res) => {
  try {
    const { name, number, ward_id, address, latitude, longitude } = req.body;
    const result = await pool.query(
      `UPDATE booths SET name = COALESCE($1, name), number = COALESCE($2, number), 
       ward_id = COALESCE($3, ward_id), address = COALESCE($4, address),
       latitude = COALESCE($5, latitude), longitude = COALESCE($6, longitude)
       WHERE id = $7 RETURNING *`,
      [name, number, ward_id, address, latitude, longitude, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Booth updated.', result.rows[0]));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const deleteBooth = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM booths WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Booth deleted.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Get full hierarchy
const getHierarchy = async (req, res) => {
  try {
    const states = await pool.query(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM districts WHERE state_id = s.id) as district_count,
        (SELECT COUNT(*) FROM constituencies c JOIN districts d ON c.district_id = d.id WHERE d.state_id = s.id) as constituency_count
      FROM states s ORDER BY s.name
    `);
    res.json(formatResponse(true, 'Hierarchy fetched.', states.rows));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = {
  getStates, createState,
  getDistricts, createDistrict,
  getConstituencies, createConstituency, updateConstituency, deleteConstituency,
  getWards, createWard, updateWard, deleteWard,
  getBooths, createBooth, updateBooth, deleteBooth,
  getHierarchy
};
