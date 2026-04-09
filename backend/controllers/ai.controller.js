/**
 * AI CHAT CONTROLLER v2
 * ─────────────────────────────────────────────────────────────────────
 * Full chat system with persistent history, sessions, and memory.
 * Modular AI service: Groq → OpenAI → Claude
 */
const Groq = require('groq-sdk');
const pool = require('../config/db');
require('dotenv').config();

// ── Rate limiting (in-memory) ────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now - val.windowStart > RATE_LIMIT_WINDOW * 2) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

// ── System Prompt ────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer user questions clearly, accurately, and naturally. You can help with any topic including general knowledge, coding, strategy, or explanations. Keep responses simple and useful.

When providing code, use proper markdown code blocks with language identifiers.
When listing items, use clean formatting with bullet points or numbered lists.
Be conversational and friendly, but stay focused and informative.`;

// ── AI Service ───────────────────────────────────────────────────────
class AIService {
  constructor() {
    this.provider = 'groq';
    this.client = null;
    this._initClient();
  }

  _initClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      console.warn('⚠️  GROQ_API_KEY not set. AI chat will not work.');
      return;
    }
    this.client = new Groq({ apiKey });
  }

  async chat(message, history = [], memories = []) {
    if (!this.client) {
      throw new Error('AI service not configured. Please set GROQ_API_KEY in environment.');
    }

    let dynamicPrompt = SYSTEM_PROMPT;
    if (memories && memories.length > 0) {
      const memoryString = memories.map(m => `${m.memory_key}: ${m.memory_value}`).join('\n');
      dynamicPrompt += `\n\nUSER INFORMATION (Long-term memory):\n${memoryString}`;
    }

    const messages = [{ role: 'system', content: dynamicPrompt }];

    // Add conversation history (last 10 for context window)
    const recent = history.slice(-10);
    for (const msg of recent) {
      if (msg.role && msg.content) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content.substring(0, 4000),
        });
      }
    }

    messages.push({ role: 'user', content: message.substring(0, 4000) });

    try {
      const completion = await this.client.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.9,
      });
      return completion.choices[0]?.message?.content || 'I could not generate a response. Please try again.';
    } catch (error) {
      console.error('AI Service Error:', error.message);
      if (error.status === 429) throw new Error('AI service is busy. Please wait a moment and try again.');
      if (error.status === 401) throw new Error('AI service authentication failed. Please check API configuration.');
      throw new Error('Failed to get AI response. Please try again.');
    }
  }

  async extractMemories(message, lastResponse) {
    if (!this.client || !message) return [];

    const extractionPrompt = `You are a memory extraction unit. Extract key user facts (name, personal preferences, role, location, or repeating interests) from the conversation.
    Output ONLY a valid JSON array of objects: [{"key": "name", "value": "Satyam Pandey"}, ...].
    Rule: Key should be a simple identifier (lowercase_with_underscores).
    If no new facts worth remembering, output [].
    
    Conversation snippet:
    User: "${message.substring(0, 1000)}"
    AI: "${lastResponse.substring(0, 1000)}"`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'system', content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = completion.choices[0]?.message?.content || '[]';
      // Attempt to find JSON array in response
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (error) {
      console.error('Memory Extraction Error:', error.message);
      return [];
    }
  }
}

const aiService = new AIService();

// ── Memory Management ────────────────────────────────────────────────
async function getUserMemories(userId) {
  try {
    const res = await pool.query(
      'SELECT memory_key, memory_value FROM user_memories WHERE user_id = $1',
      [userId]
    );
    return res.rows;
  } catch (err) {
    console.error('Failed to fetch memories:', err);
    return [];
  }
}

async function saveMemories(userId, memories) {
  if (!memories || memories.length === 0) return;
  for (const m of memories) {
    try {
      await pool.query(
        `INSERT INTO user_memories (user_id, memory_key, memory_value, updated_at) 
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, memory_key) 
         DO UPDATE SET memory_value = EXCLUDED.memory_value, updated_at = NOW()`,
        [userId, m.key, m.value]
      );
    } catch (err) {
      console.error('Failed to save memory:', err);
    }
  }
}

// ── Auto-title from first message ────────────────────────────────────
function generateTitle(msg) {
  const cleaned = msg.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const words = cleaned.split(/\s+/).slice(0, 6).join(' ');
  return words.length > 0 ? words.charAt(0).toUpperCase() + words.slice(1) : 'New Chat';
}

// ═══════════════════════════════════════════════════════════════════
//  CONTROLLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * POST /api/ai/chat
 * Send message, get AI response, handle persistent memory
 */
const chat = async (req, res) => {
  try {
    const { message, session_id } = req.body;
    const userId = req.user.id;
    const orgId = req.user.organization_id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message too long.' });
    }
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ success: false, message: 'Too many requests.' });
    }

    let sessionId = session_id;

    // Create session if needed
    if (!sessionId) {
      const title = generateTitle(message);
      const result = await pool.query(
        'INSERT INTO chat_sessions (user_id, title, organization_id) VALUES ($1, $2, $3) RETURNING id',
        [userId, title, orgId]
      );
      sessionId = result.rows[0].id;
    }

    // Auth check for session
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized session.' });
    }

    // Save user message
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message]
    );

    // 1. Fetch long-term memory
    const memories = await getUserMemories(userId);

    // 2. Fetch short-term history
    const historyResult = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10',
      [sessionId]
    );
    const history = historyResult.rows.reverse();

    // 3. Get AI response with memories injected
    const reply = await aiService.chat(message, history, memories);

    // Save AI response
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'assistant', reply]
    );

    // 4. Update session timestamp
    await pool.query(
      'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
      [sessionId]
    );

    // 5. Background: Trigger memory extraction (async)
    aiService.extractMemories(message, reply).then(newMemories => {
      if (newMemories && newMemories.length > 0) {
        saveMemories(userId, newMemories);
      }
    }).catch(err => console.error('BG Memory Sync Error:', err));

    return res.json({
      success: true,
      reply,
      session_id: sessionId
    });
  } catch (error) {
    console.error('AI Chat Error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
  }
};

/**
 * GET /api/ai/sessions
 * List all chat sessions for the current user
 */
const getSessions = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT cs.id, cs.title, cs.created_at, cs.updated_at,
              (SELECT content FROM chat_messages WHERE session_id = cs.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id)::int as message_count
       FROM chat_sessions cs
       WHERE cs.user_id = $1
       ORDER BY cs.updated_at DESC`,
      [userId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get Sessions Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch sessions.' });
  }
};

/**
 * GET /api/ai/sessions/:id/messages
 * Get all messages for a specific session
 */
const getSessionMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.id;

    // Verify ownership
    const sessionCheck = await pool.query(
      'SELECT id, title FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    const result = await pool.query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [sessionId]
    );

    return res.json({
      success: true,
      session: sessionCheck.rows[0],
      data: result.rows,
    });
  } catch (error) {
    console.error('Get Messages Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
};

/**
 * DELETE /api/ai/sessions/:id
 * Delete a chat session and all its messages
 */
const deleteSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.id;

    const result = await pool.query(
      'DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    return res.json({ success: true, message: 'Chat deleted successfully.' });
  } catch (error) {
    console.error('Delete Session Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to delete session.' });
  }
};

/**
 * PUT /api/ai/sessions/:id
 * Rename a chat session
 */
const updateSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.id;
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }

    const result = await pool.query(
      'UPDATE chat_sessions SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING id, title',
      [title.substring(0, 200), sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update Session Error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to update session.' });
  }
};

module.exports = { chat, getSessions, getSessionMessages, deleteSession, updateSession };
