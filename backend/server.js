// Force IPv4 before anything else — Render cannot reach IPv6 hosts
require('dns').setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
require('dotenv').config();

// ── Socket.io ────────────────────────────────────────────────────────
const { Server } = require('socket.io');

const { createTables } = require('./models');
const { injectTenantScope } = require('./middleware/tenant');

// Import routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const constituencyRoutes = require('./routes/constituency.routes');
const teamsRoutes = require('./routes/teams.routes');
const tasksRoutes = require('./routes/tasks.routes');
const surveysRoutes = require('./routes/surveys.routes');
const eventsRoutes = require('./routes/events.routes');
const votersRoutes = require('./routes/voters.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const messagesRoutes = require('./routes/messages.routes');
const mediaRoutes = require('./routes/media.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── Socket.io server ────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Join organization room for tenant-scoped events
  socket.on('join:org', (orgId) => {
    socket.join(`org_${orgId}`);
    console.log(`📡 Socket ${socket.id} joined org_${orgId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ── Middleware ───────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Inject Socket.io instance into every request for real-time emission
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ── API Routes ──────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/constituency', constituencyRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/surveys', surveysRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/voters', votersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationsRoutes);

// ── Health check ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['multi-tenant', 'rbac-hierarchy', 'socket.io', 'analytics', 'booth-strength']
  });
});

// ── Error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Initialize ──────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await createTables();
    server.listen(PORT, () => {
      console.log(`\n🚀 Mission FTC Server v2.0 running on port ${PORT}`);
      console.log(`📡 API:       http://localhost:${PORT}/api`);
      console.log(`🔌 Socket.io: http://localhost:${PORT} (WebSocket)`);
      console.log(`🏛️  MLA Election Management System`);
      console.log(`✅ Features:  Multi-Tenant | RBAC Hierarchy | Real-Time | Analytics\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
