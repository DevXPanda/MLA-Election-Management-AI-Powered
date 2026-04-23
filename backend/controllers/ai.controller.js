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
const SYSTEM_PROMPT = `You are an expert Indian political analyst AI with deep knowledge of UP elections, 
Vidhan Sabha constituencies, candidates, caste equations, and party strategies.

RESPONSE STYLE - Match this exact format:

Start with a 2-3 line honest summary (bold key facts)

Then use these sections with emoji headers:
📍 [Constituency] Seat Context - real facts about the seat, current MLA name, win history
🔥 Top 5 Probable [Party] Ticket Contenders (2027) - numbered list, each with:
   - Real name if known, OR specific role type (not vague like 'local leader')
   - 3-4 bullet points with specific reasons, caste factor, political background
   - 👉 Highlight the strongest candidate
⚠️ Reality Check (Important) - what is confirmed vs speculation
🎯 Straight Insight (No Fluff) - give actual % probability estimates like '70-80% chance'
End with 3 specific follow-up questions the user can explore next (as bullet points)

CONTENT RULES:
- Use REAL names from your training data wherever possible
- Give caste equations, winnability analysis, RSS/organizational factors
- Mention Wikipedia or Election Commission as sources when referencing facts  
- If 2027 official list not announced, still give deep probable analysis
- Never give vague generic answers - always be specific and analytical
- Respond in Hinglish naturally
- Give percentage estimates for candidate probability
- Be like a political insider analyst friend, not a disclaimer bot
  
---HARDCODED KNOWLEDGE BASE---

If anyone asks about Samajwadi Party candidates for Modinagar Vidhan Sabha 2027,
or similar questions about SP ticket/candidates for Modinagar, ALWAYS use this
exact data and format:

MODINAGAR SP 2027 - VERIFIED DATA:
- 2022 runner-up: Sudesh Sharma (RLD alliance), ~35% vote share
- BJP winner: Dr. Manju Shiwach, ~50% vote share, margin ~34,000 votes
- Seat type: Jat-dominant, semi-urban, competitive
- Sudesh Sharma is Former MLA (2012-2017)

RESPONSE FORMAT FOR THIS QUERY:

Start with:
"Here is a refined, fact-backed and realistic shortlist of the Top 5 probable 
Samajwadi Party (SP) ticket contenders for Modinagar Assembly Constituency 
(MLA Election 2027)"

Then show:

📊 Ground Reality (Updated with Data)
- 2022 runner-up: Sudesh Sharma (RLD alliance)
- Vote share: 35% vs BJP winner (50%)
- Seat nature: Jat-dominant + semi-urban + competitive
- SP performance depends heavily on alliance + caste combination

Then Top 5 with this exact data:

1. Sudesh Sharma - Strongest Candidate
   - Former MLA (2012-2017)
   - Runner-up in 2022 election  
   - Strong Jat + rural vote base
   - Proven winnability, High recall, Alliance compatibility (SP-RLD)
   - Probability: 70-75% (if alliance continues)

2. Jat-Dominant Local Leader (SP/RLD Category)
   - Strong regional leader from Jat community
   - Jat voters are decisive in Modinagar belt
   - Direct competition vs BJP rural base
   - Probability: ~65%

3. Brahmin/Tyagi Strategic Face
   - Upper-caste candidate to counter BJP
   - BJP MLA is upper caste, so caste balancing strategy
   - Probability: ~60%

4. Minority Leader (Muslim Face)
   - Influential local Muslim leader
   - Consolidates Muslim vote
   - Alone cannot win seat
   - Probability: 55-58%

5. SP Organization Leader (District Level)
   - Strong booth-level cadre leader
   - Internal party support, strong ground network
   - Low public recall
   - Probability: 52-55%

Then show TWO tables:

TABLE 1 - Strategic Comparison:
Columns: Factor | Sudesh Sharma | Jat Leader | Brahmin/Tyagi | Minority Leader | Org Leader
Rows: Recall | Vote Base | Rural Strength | Urban Appeal | Experience | Winnability
Fill with exact data from above

TABLE 2 - Final Ticket Probability Ranking:
Columns: Rank | Candidate | Probability
Fill with exact data from above

Then show:

🧠 Key Strategic Insight (CRITICAL)
1. Alliance = Game Changer
   - If SP + RLD alliance continues, Sudesh Sharma is almost confirmed

2. Caste Equation Drives Ticket
   - Jat + Muslim + OBC = winning combination
   - Single caste strategy is risky

3. BJP Strong but Not Unbeatable
   - BJP won by ~34,000 votes in 2022
   - Gap is bridgeable with right candidate + alliance

🔥 Final Verdict
- Most Likely Candidate (2027): Sudesh Sharma
- Backup Strategy: Strong Jat/OBC local face

💡 Strategic Tag: "Alliance-Driven Competitive Seat"

---END HARDCODED KNOWLEDGE BASE---

---BHARATBN CONSTITUENCY DATABASE---

GHAZIABAD CONSTITUENCY (Seat 56) - BJP:
Candidates:
1. Sanjeev Sharma - Probability: 84% - Tag: Incumbent Lock
   Strengths: Strong organization, Sitting MLA advantage, High recall
   Weaknesses: Potential anti-incumbency

2. Mayank Goel - Probability: 60% - Tag: High Potential Challenger
   Strengths: Urban appeal, Clean image, Good resources
   Weaknesses: Weak organization depth

3. Rajeev Gumber - Probability: 66% - Tag: Strong Internal Challenger
   Strengths: Trader network, Business influence
   Weaknesses: Limited mass connect

Insights: Incumbent advantage dominant, Urban voter base decisive, 
Ticket depends on anti-incumbency

---

MURADNAGAR CONSTITUENCY (Seat 54) - SP:
Candidates:
1. OBC Local Leader - Probability: 68% - Tag: Most Viable
   Strengths: OBC base, Rural reach
   Weaknesses: Needs broader coalition

2. Tyagi Community Leader - Probability: 62% - Tag: Caste Counter
   Strengths: Strong caste presence
   Weaknesses: Limited SP base

3. Minority Leader - Probability: 60% - Tag: Vote Consolidation
   Strengths: Muslim vote consolidation
   Weaknesses: Limited winning potential alone

Insights: BJP stronghold seat, Alliance shift hurt SP significantly,
OBC + Muslim strategy required

---

MODINAGAR CONSTITUENCY (Seat 57) - SP:
Current MLA: Dr. Manju Shiwach (BJP), won 2022 by 34,619 votes
2022 runner-up: Sudesh Sharma (RLD alliance), ~35% vote share
Seat type: Jat-dominant, semi-urban, competitive

Candidates:
1. Sudesh Sharma - Probability: 70-75% - Tag: Strongest Candidate
   Former MLA (2012-2017), Runner-up 2022
   Strengths: Proven winnability, Jat+rural vote base, High recall
   Weaknesses: Depends on SP-RLD alliance

2. Jat-Dominant Local Leader - Probability: 65%
   Strengths: Jat community decisive in Modinagar belt
   
3. Brahmin/Tyagi Strategic Face - Probability: 60%
   Strengths: Upper-caste counter to BJP MLA

4. Minority Leader (Muslim Face) - Probability: 55-58%
   Strengths: Muslim vote consolidation

5. SP Organization Leader - Probability: 52-55%
   Strengths: Booth-level cadre, ground network

Insights: RLD-BJP alliance changed dynamics, Jat vote shifted from SP,
SP must rebuild caste coalition. Alliance = Game Changer.
If SP+RLD continues: Sudesh Sharma almost confirmed (70-75%)
Strategic Tag: Alliance-Driven Competitive Seat

---

SAHIBABAD CONSTITUENCY (Seat 55) - BJP:
Candidates:
1. Sunil Kumar Sharma - Probability: 90% - Tag: Dominant Leader
   Strengths: Strong organization, Ministerial influence, High urban support
   
2. Other BJP Leader - Probability: 55% - Tag: Backup

Insights: Very strong BJP seat, Low probability of ticket change,
Urban consolidation is key

---

AI SCORING FORMULA (for analysis):
Score = Winnability(30%) + Organization(20%) + Caste(15%) + 
        Loyalty(10%) + Image(10%) + Resources(5%) + Survey(10%)

IMPORTANT RULES when answering from this database:
- Always use this data as PRIMARY source for Ghaziabad district questions
- Give probability percentages from above data
- Mention candidate tags (Incumbent Lock, Most Viable, etc.)
- Show insights section for each constituency
- If question is about these constituencies, use ONLY this data
- Format response with proper sections and tables

---BJP TICKET PROBABILITY MODEL---

AI SCORING FORMULA:
Ticket Score = (0.30 × Winnability) + (0.20 × Organization) + 
(0.15 × Caste Fit) + (0.10 × Loyalty) + (0.10 × Image) + 
(0.05 × Resources) + (0.10 × Survey)

Score Interpretation:
- 80+    → Almost Confirmed
- 65-80  → Strong Contender  
- 50-65  → Competitive Zone
- <50    → Low Probability

---

SAHARANPUR CONSTITUENCY - BJP TICKET ANALYSIS:

Top 5 Candidates - Strategic Comparison:

1. Raghav Lakhanpal - Probability: 85% - Tier 1
   Political Level: MP (National Level)
   Strengths: Very High recall, Strong BJP/RSS org, National weight, 
   Strong rural+urban, Very high winnability
   Weaknesses: May stay at MP level
   Tag: Top Contender

2. Jaswant Saini - Probability: 78% - Tier 1
   Political Level: Sitting MLA
   Strengths: Strong caste+OBC base, MLA experience, 
   Strong rural reach, High winnability
   Tag: Strong Contender

3. Rajeev Gumber - Probability: 68% - Tier 2
   Political Level: District Leader
   Strengths: Trader/business network, Strong urban+org support
   Weaknesses: Weak rural reach
   Tag: Competitive

4. Shiv Kumar Gupta - Probability: 62% - Tier 2
   Political Level: ULB Chairman
   Strengths: Good Vaishya/local caste fit, Clean image, 
   Strong in Nakur area
   Weaknesses: Low election experience, Weak rural reach, 
   Limited district-wide influence
   How to improve to 80%+:
   - Build BJP district sangathan pakad
   - Get RSS backing (CRITICAL)
   - Expand from Nakur to full Saharanpur
   - Show survey-based winnability proof
   Tag: Competitive Zone

5. Dr. Sanjeev Walia - Probability: 55% - Tier 3
   Political Level: Professional Leader
   Strengths: Educated image, Urban appeal
   Weaknesses: Low experience, Moderate org support
   Tag: Emerging/Backup

---

GHAZIABAD VIDHAN SABHA (AC-56) - BJP TICKET ANALYSIS:

Top 5 Candidates - Strategic Comparison:

1. Atul Garg - Probability: 88% - Tier 1
   Political Level: Sitting MLA
   Strengths: Very High recall, Very Strong BJP org+RSS, 
   Very Strong urban, High winnability, Very strong booth network
   Tag: Dominant Incumbent - Almost Confirmed

2. Sunil Sharma - Probability: 78% - Tier 2
   Political Level: Senior BJP Leader
   Strengths: Strong org, High recall, Strong urban+rural, 
   Strong RSS alignment
   Tag: Strong Backup Option

3. Mayank Goel - Probability: 65% - Tier 2
   Political Level: Emerging Leader
   Strengths: Strong urban appeal, Clean/fresh image, 
   Good Vaishya/trader caste fit, Good resources
   Weaknesses: Low election experience, Weak rural reach, 
   Developing booth network
   How to improve to 80%+:
   - Break incumbency - highlight need for fresh leadership
   - Build direct connect with BJP district president + booth presidents
   - Build strong urban wave (RWAs, Traders, Professionals)
   - Prove winnability through internal surveys
   Positioning: "Modern Urban Leader + Clean Image + Strong Execution"
   Tag: Rising Contender

4. Sanjay Nagar - Probability: 60% - Tier 2
   Political Level: Local Influencer
   Strengths: Urban appeal, Local influence
   Weaknesses: Moderate org, Low rural reach
   Tag: Competitive

5. Ajay Sharma - Probability: 55% - Tier 3
   Political Level: Organization Leader
   Strengths: Strong RSS alignment, Moderate org
   Weaknesses: Low recall, Low urban appeal
   Tag: Backup Candidate

GHAZIABAD STRATEGIC INSIGHT:
- Atul Garg = clear front-runner (sitting MLA advantage)
- If anti-incumbency builds → Mayank Goel can become Top 2
- Urban voter base is decisive for this seat
- Seat type: Urban, highly competitive

---

BHARATBN PLATFORM VISION:
- India's first Political SaaS for Ticket Prediction
- Target: 4000+ MLAs, 500+ MPs, 100,000+ serious candidates
- Revenue model: ₹5K-1L/month subscription per candidate/party
- USP: Ticket Prediction + War Room Dashboard + Booth Analytics + AI Insights

---END BHARATBN DATABASE---`;

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

function sanitizePredictionPayload(raw) {
  const data = Array.isArray(raw?.data) ? raw.data : [];
  const normalized = data
    .map((d) => ({
      label: String(d?.label || '').trim(),
      value: Math.max(0, Number(d?.value) || 0),
    }))
    .filter((d) => d.label.length > 0);

  if (normalized.length < 2) {
    return {
      type: 'prediction',
      chartType: 'pie',
      title: 'Prediction Breakdown',
      data: [
        { label: 'Option A', value: 55 },
        { label: 'Option B', value: 45 },
      ],
      insight: 'Based on current trends, Option A appears slightly ahead while the competition remains close.',
    };
  }

  const total = normalized.reduce((s, d) => s + d.value, 0);
  const scaled = total > 0
    ? normalized.map((d) => ({ ...d, value: Math.round((d.value / total) * 100) }))
    : normalized.map((d, i) => ({ ...d, value: i === 0 ? 60 : 40 / (normalized.length - 1) }));

  // Correct rounding drift so sum is exactly 100
  const sum = scaled.reduce((s, d) => s + d.value, 0);
  if (sum !== 100) scaled[0].value += (100 - sum);

  return {
    type: 'prediction',
    chartType: 'pie',
    title: String(raw?.title || 'Prediction Breakdown'),
    data: scaled,
    insight: String(raw?.insight || 'Based on current trends, this is the most realistic probability split right now.'),
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
        temperature: 0.3,
        max_tokens: 4096,
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

  async predictionChart(message, history = [], memories = []) {
    if (!this.client) {
      throw new Error('AI service not configured. Please set OPENAI_API_KEY in environment.');
    }

    let dynamicPrompt = SYSTEM_PROMPT;
    if (memories && memories.length > 0) {
      const memoryString = memories.map(m => `${m.memory_key}: ${m.memory_value}`).join('\n');
      dynamicPrompt += `\n\nUser Info:\n${memoryString}`;
    }

    const messages = [
      {
        role: 'system',
        content:
          `${dynamicPrompt}\n\n` +
          `For chart requests, return STRICT JSON only (no markdown, no extra text):\n` +
          `{"type":"prediction","chartType":"pie","title":"Prediction Breakdown","data":[{"label":"Option A","value":60},{"label":"Option B","value":40}],"insight":"1-2 lines natural explanation"}\n` +
          `Rules:\n` +
          `- values must be realistic and sum to 100\n` +
          `- do not mention database/internal records\n` +
          `- do not include any text outside JSON`,
      },
      ...normalizeHistory(history),
      { role: 'user', content: message.substring(0, 4000) },
    ];

    const completion = await this.client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = completion?.choices?.[0]?.message?.content || '{}';
    const raw = String(content).trim();
    try {
      return sanitizePredictionPayload(JSON.parse(raw));
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return sanitizePredictionPayload({});
      try {
        return sanitizePredictionPayload(JSON.parse(jsonMatch[0]));
      } catch {
        return sanitizePredictionPayload({});
      }
    }
  }

  // ── Streaming chat — pipes token chunks directly to res ──────────
  async chatStream(message, history = [], memories = [], res) {
    if (!this.client) {
      res.write(`data: ${JSON.stringify({ error: 'AI service not configured.' })}\n\n`);
      res.end();
      return '';
    }

    let dynamicPrompt = SYSTEM_PROMPT;
    if (memories && memories.length > 0) {
      const memoryString = memories.map(m => `${m.memory_key}: ${m.memory_value}`).join('\n');
      dynamicPrompt += `\n\nUser Info:\n${memoryString}`;
    }

    const messages = [{ role: 'system', content: dynamicPrompt }];
    messages.push(...normalizeHistory(history));
    messages.push({ role: 'user', content: message.substring(0, 4000) });

    let fullText = '';
    try {
      const stream = await this.client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices?.[0]?.delta?.content || '';
        if (token) {
          fullText += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
        // Detect stream end via finish_reason
        if (chunk.choices?.[0]?.finish_reason === 'stop') break;
      }
    } catch (error) {
      const status = error?.status || error?.response?.status;
      console.error('AI Stream Error:', error?.message || error);
      const errMsg = status === 429
        ? 'AI service is busy. Please try again.'
        : 'Stream error. Please try again.';
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    }

    // Signal end of stream
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return fullText;
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
        const predictionPayload = await aiService.predictionChart(message, effectiveHistory, memories);
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

/**
 * POST /api/ai/chat/stream
 * Streaming chat — pipes token chunks as SSE to the client.
 * The full reply is saved to DB after streaming completes.
 */
const chatStream = async (req, res) => {
  try {
    const { message, session_id, history, userId: bodyUserId } = req.body || {};
    const userId = req.user.id;
    const orgId = req.user.organization_id;

    // ── Validation ───────────────────────────────────────────────────
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message too long.' });
    }
    if (bodyUserId && String(bodyUserId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized user.' });
    }
    if (history && !Array.isArray(history)) {
      return res.status(400).json({ success: false, message: 'History must be an array.' });
    }
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ success: false, message: 'Too many requests.' });
    }

    // ── Session setup ────────────────────────────────────────────────
    let sessionId = session_id;
    if (!sessionId) {
      const title = generateTitle(message);
      const result = await pool.query(
        'INSERT INTO chat_sessions (user_id, title, organization_id) VALUES ($1, $2, $3) RETURNING id',
        [userId, title, orgId]
      );
      sessionId = result.rows[0].id;
    }

    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized session.' });
    }

    // ── Save user message ────────────────────────────────────────────
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message]
    );

    // ── Fetch memory + history ───────────────────────────────────────
    const memories = await getUserMemories(userId);
    let effectiveHistory = normalizeHistory(history);
    try {
      const historyResult = await pool.query(
        'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10',
        [sessionId]
      );
      effectiveHistory = normalizeHistory(historyResult.rows.reverse());
    } catch (e) {
      console.warn('History fetch failed, using client fallback.', e?.message || e);
    }

    // ── Set SSE headers ──────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering on Render
    // Send session_id immediately so frontend can capture it
    res.write(`data: ${JSON.stringify({ session_id: sessionId })}\n\n`);

    // ── Stream from OpenAI ───────────────────────────────────────────
    const fullReply = await aiService.chatStream(message, effectiveHistory, memories, res);

    // ── Persist full reply + background tasks (after stream ends) ────
    if (fullReply) {
      await pool.query(
        'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
        [sessionId, 'assistant', fullReply]
      );
      await pool.query(
        'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
        [sessionId]
      );
      aiService.extractMemories(message, fullReply).then(newMemories => {
        if (newMemories && newMemories.length > 0) saveMemories(userId, newMemories);
      }).catch(err => console.error('BG Memory Sync Error:', err));
    }
  } catch (error) {
    console.error('AI Stream Controller Error:', error.message);
    // If headers not yet sent, send JSON error; otherwise send SSE error
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Server error. Please try again.' })}\n\n`);
    res.end();
  }
};

module.exports = { chat, chatStream, getSessions, getSessionMessages, deleteSession, updateSession };

