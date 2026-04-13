/**
 * AI CHAT CONTROLLER v2
 * ─────────────────────────────────────────────────────────────────────
 * Full chat system with persistent history, sessions, and memory.
 * Provider: OpenAI Chat Completions
 */
const OpenAI = require('openai');
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
const SYSTEM_PROMPT = `You are a smart, confident, and helpful AI assistant.

Core behavior:
- Act like an intelligent, confident general-purpose assistant across all domains.
- Respond like a natural human conversation, not a report generator.
- Do not be overly cautious or give unnecessary disclaimers.
- Do not behave like a basic chatbot.

Handling unknown or incomplete data:
- Do not default to "I don't know" immediately.
- If exact data is unavailable, provide a logical estimate using general knowledge.
- Clearly state key assumptions in simple language.

Thinking and style:
- Think step-by-step internally before responding, but return only concise final reasoning.
- Keep responses natural, human-like, clear, and easy to understand.
- Tone should be slightly confident, practical, and not robotic or overly formal.
- Avoid repeating the question.
- Avoid generic theory-only answers; always include a usable conclusion.
- Prefer flowing paragraph format by default.
- Understand user intent, not just exact wording.
- Automatically adapt to Hinglish/English style used by the user.
- Provide examples when helpful.
- Do not force bullet points or numbered lists unless the user explicitly asks for them.

For probability-style questions such as "who will win", "probability kitni hai", or "chances kya hai", you must:
Give a clear practical estimate in natural language (and percentage range when useful), then explain reasoning conversationally.

Avoid over-safety language like "I cannot predict" or "I am not certain" unless absolutely required.
Use realistic analyst-style language such as "Based on current trends..." or "Right now it looks like...".
Tone: confident but realistic; analytical but simple; conversational.`;

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MEMORY_MODEL = process.env.OPENAI_MEMORY_MODEL || 'gpt-4o';
const REQUEST_TIMEOUT_MS = 8000;

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const recent = history.slice(-10);
  const normalized = [];
  for (const msg of recent) {
    if (!msg || typeof msg !== 'object') continue;
    const role = msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : null;
    const content = typeof msg.content === 'string' ? msg.content : null;
    if (!role || !content) continue;
    normalized.push({ role, content: content.substring(0, 4000) });
  }
  return normalized;
}

function classifyQueryType(message) {
  const text = String(message || '').toLowerCase();
  const analyticsKeywords = [
    'prediction', 'probability', 'trend', 'graph', 'chart', 'analytics', 'analysis', 'compare', 'growth', 'distribution'
  ];
  const dataKeywords = ['latest news', 'current trends', 'market data', 'election updates', 'latest update', 'news', 'live'];

  if (analyticsKeywords.some(k => text.includes(k))) return 'analytics';
  if (dataKeywords.some(k => text.includes(k))) return 'data';
  return 'normal';
}

function needsChart(message) {
  const text = String(message || '').toLowerCase();
  const triggerKeywords = ['prediction', 'probability', 'trend', 'graph', 'analytics', 'chart'];
  return triggerKeywords.some(k => text.includes(k));
}

async function fetchExternalContext(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];

    const data = await res.json();
    const snippets = [];

    if (data?.AbstractText) snippets.push(`Summary: ${data.AbstractText}`);
    if (Array.isArray(data?.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic?.Text) snippets.push(topic.Text);
        if (topic?.Topics && Array.isArray(topic.Topics)) {
          for (const sub of topic.Topics.slice(0, 2)) {
            if (sub?.Text) snippets.push(sub.Text);
          }
        }
      }
    }

    return snippets.slice(0, 8);
  } catch (error) {
    console.warn('External context fetch failed:', error?.message || error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function mapSupportBucket(status) {
  const value = String(status || '').toLowerCase();
  if (['supporter', 'support', 'strong_support', 'yes', 'pro', 'positive'].some(k => value.includes(k))) {
    return 'Supporter';
  }
  if (['opponent', 'oppose', 'against', 'anti', 'no', 'negative'].some(k => value.includes(k))) {
    return 'Opponent';
  }
  return 'Neutral';
}

function buildInsightFromDistribution(data, title = 'current distribution') {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);
  if (total === 0) {
    return `Based on current database records, there is not enough data yet for ${title.toLowerCase()} to estimate a strong trend.`;
  }
  const sorted = [...data].sort((a, b) => Number(b.value) - Number(a.value));
  const top = sorted[0];
  const percentage = Math.round((Number(top.value) / total) * 100);
  return `Based on current trends in available database records, ${top.label.toLowerCase()} is leading at around ${percentage}%, which shows the present direction and may shift as fresh data is added.`;
}

async function buildPredictionPayload(query, orgId) {
  const q = String(query || '').toLowerCase();

  // Tasks-focused queries
  if (['task', 'work', 'productivity', 'pending', 'completed'].some(k => q.includes(k))) {
    const result = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(status), ''), 'Unknown') AS label, COUNT(*)::int AS value
       FROM tasks
       WHERE organization_id = $1
       GROUP BY 1
       ORDER BY value DESC`,
      [orgId]
    );
    const payloadData = result.rows.map(r => ({ label: r.label, value: Number(r.value) || 0 }));
    return {
      type: 'prediction',
      chartType: 'pie',
      title: 'Task Status Distribution',
      data: payloadData,
      insight: buildInsightFromDistribution(payloadData, 'task status distribution'),
    };
  }

  // Events-focused queries
  if (['event', 'attendance', 'campaign activity', 'program'].some(k => q.includes(k))) {
    const result = await pool.query(
      `SELECT COALESCE(NULLIF(TRIM(status), ''), 'Unknown') AS label, COUNT(*)::int AS value
       FROM events
       WHERE organization_id = $1
       GROUP BY 1
       ORDER BY value DESC`,
      [orgId]
    );
    const payloadData = result.rows.map(r => ({ label: r.label, value: Number(r.value) || 0 }));
    return {
      type: 'prediction',
      chartType: 'pie',
      title: 'Event Status Distribution',
      data: payloadData,
      insight: buildInsightFromDistribution(payloadData, 'event status distribution'),
    };
  }

  // Support/prediction-style queries from surveys/voters
  const surveyRes = await pool.query(
    `SELECT support_status, COUNT(*)::int AS value
     FROM surveys
     WHERE organization_id = $1
     GROUP BY support_status`,
    [orgId]
  );

  let sourceRows = surveyRes.rows;
  if (!sourceRows || sourceRows.length === 0) {
    const voterRes = await pool.query(
      `SELECT support_status, COUNT(*)::int AS value
       FROM voters
       WHERE organization_id = $1
       GROUP BY support_status`,
      [orgId]
    );
    sourceRows = voterRes.rows;
  }

  const buckets = { Supporter: 0, Opponent: 0, Neutral: 0 };
  for (const row of sourceRows || []) {
    const bucket = mapSupportBucket(row.support_status);
    buckets[bucket] += Number(row.value) || 0;
  }

  let payloadData = [
    { label: 'Supporter', value: buckets.Supporter },
    { label: 'Opponent', value: buckets.Opponent },
    { label: 'Neutral', value: buckets.Neutral },
  ];

  // Generic fallback for any query using real operational counts
  const totalSupport = payloadData.reduce((sum, d) => sum + d.value, 0);
  if (totalSupport === 0) {
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS value FROM voters WHERE organization_id = $1', [orgId]),
      pool.query('SELECT COUNT(*)::int AS value FROM surveys WHERE organization_id = $1', [orgId]),
      pool.query('SELECT COUNT(*)::int AS value FROM tasks WHERE organization_id = $1', [orgId]),
      pool.query('SELECT COUNT(*)::int AS value FROM events WHERE organization_id = $1', [orgId]),
    ]);

    payloadData = [
      { label: 'Voters', value: Number(counts[0].rows[0]?.value) || 0 },
      { label: 'Surveys', value: Number(counts[1].rows[0]?.value) || 0 },
      { label: 'Tasks', value: Number(counts[2].rows[0]?.value) || 0 },
      { label: 'Events', value: Number(counts[3].rows[0]?.value) || 0 },
    ];

    return {
      type: 'prediction',
      chartType: 'pie',
      title: 'Operational Data Distribution',
      data: payloadData,
      insight: buildInsightFromDistribution(payloadData, 'operational data distribution'),
    };
  }

  return {
    type: 'prediction',
    chartType: 'pie',
    title: 'Support Distribution',
    data: payloadData,
    insight: buildInsightFromDistribution(payloadData, 'support distribution'),
  };
}

// ── AI Service ───────────────────────────────────────────────────────
class AIService {
  constructor() {
    this.provider = 'openai';
    this.client = null;
    this._initClient();
  }

  _initClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_secret_key') {
      console.warn('⚠️  OPENAI_API_KEY not set. AI chat will not work.');
      return;
    }
    this.client = new OpenAI({ apiKey });
  }

  async chat(message, history = [], memories = []) {
    if (!this.client) {
      throw new Error('AI service not configured. Please set OPENAI_API_KEY in environment.');
    }

    let dynamicPrompt = SYSTEM_PROMPT;
    if (memories && memories.length > 0) {
      const memoryString = memories.map(m => `${m.memory_key}: ${m.memory_value}`).join('\n');
      dynamicPrompt += `\n\nUser Info:\n${memoryString}`;
    }

    const messages = [{ role: 'system', content: dynamicPrompt }];

    // Add conversation history (last 10 for context window)
    messages.push(...normalizeHistory(history));

    messages.push({ role: 'user', content: message.substring(0, 4000) });

    try {
      const completion = await this.client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      });
      const text = completion?.choices?.[0]?.message?.content;
      return (typeof text === 'string' && text.trim().length > 0)
        ? text.trim()
        : 'I could not generate a response. Please try again.';
    } catch (error) {
      const status = error?.status || error?.response?.status;
      console.error('AI Service Error:', error?.message || error);
      if (status === 429) throw new Error('AI service is busy. Please wait a moment and try again.');
      if (status === 401) throw new Error('AI service authentication failed. Please check API configuration.');
      throw new Error('Failed to get AI response. Please try again.');
    }
  }

  async chatWithContext(message, history = [], memories = [], contextSnippets = []) {
    let contextBlock = '';
    if (Array.isArray(contextSnippets) && contextSnippets.length > 0) {
      contextBlock = `\n\nExternal Context (real-time search snippets):\n${contextSnippets.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
    }
    const contextualMessage = `${message}${contextBlock}\n\nUse the external context when relevant and provide concise insights.`;
    return this.chat(contextualMessage, history, memories);
  }

  async extractMemories(message, lastResponse) {
    if (!this.client || !message) return [];

    const extractionPrompt =
      `Extract key user facts (name, preferences, role, location, repeating interests) from the conversation.\n` +
      `Output ONLY a valid JSON array of objects: [{"key":"name","value":"..."}, ...].\n` +
      `Rules:\n` +
      `- key must be lowercase_with_underscores\n` +
      `- if no new facts worth remembering, output []\n\n` +
      `Conversation snippet:\n` +
      `User: "${message.substring(0, 1000)}"\n` +
      `Assistant: "${String(lastResponse || '').substring(0, 1000)}"`;

    try {
      const completion = await this.client.chat.completions.create({
        model: MEMORY_MODEL,
        messages: [{ role: 'system', content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = completion?.choices?.[0]?.message?.content || '[]';
      const raw = (typeof content === 'string' ? content : '[]').trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Attempt to find JSON array in a wrapped response
        const jsonMatch = raw.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (!jsonMatch) return [];
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed : [];
      }
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
    const { message, session_id, history, userId: bodyUserId } = req.body || {};
    const userId = req.user.id;
    const orgId = req.user.organization_id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message too long.' });
    }
    if (bodyUserId && String(bodyUserId) !== String(userId)) {
      // Do not allow spoofing user identity via payload
      return res.status(403).json({ success: false, message: 'Unauthorized user.' });
    }
    if (history && !Array.isArray(history)) {
      return res.status(400).json({ success: false, message: 'History must be an array.' });
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

    // 2. Fetch short-term history (DB is the source of truth; client history is fallback only)
    let effectiveHistory = normalizeHistory(history);
    try {
      const historyResult = await pool.query(
        'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10',
        [sessionId]
      );
      effectiveHistory = normalizeHistory(historyResult.rows.reverse());
    } catch (e) {
      console.warn('History fetch failed, using client history fallback.', e?.message || e);
    }

    // 3. Smart query routing: normal chat vs data vs analytics
    const queryType = classifyQueryType(message);
    const chartRequested = needsChart(message);
    let reply;
    let aiResponse = { type: 'text', text: '', queryType };
    try {
      if (queryType === 'data' && !chartRequested) {
        const snippets = await fetchExternalContext(message);
        reply = await aiService.chatWithContext(message, effectiveHistory, memories, snippets);
        aiResponse = { type: 'text', text: reply, queryType };
      } else if (chartRequested) {
        const predictionPayload = await buildPredictionPayload(message, orgId);
        reply = predictionPayload.insight;
        aiResponse = predictionPayload;
      } else {
        reply = await aiService.chat(message, effectiveHistory, memories);
        aiResponse = { type: 'text', text: reply, queryType };
      }
    } catch (e) {
      console.error('AI provider failure:', e?.message || e);
      reply = 'Sorry—AI is temporarily unavailable. Please try again in a moment.';
      aiResponse = { type: 'text', text: reply, queryType };
    }

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
      session_id: sessionId,
      ai_response: aiResponse
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
