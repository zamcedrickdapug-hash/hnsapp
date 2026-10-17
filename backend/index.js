const fs = require('fs');
const path = require('path');
const http = require('http');
const dns = require('dns');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const authRoutes = require('./routes/auth.routes');
const parentRoutes = require('./routes/parent.routes');
const schoolRoutes = require('./routes/school.routes');
const adminRoutes = require('./routes/admin.routes');
const adminAnalyticsRoutes = require('./routes/adminAnalytics.routes');
const driverRoutes = require('./routes/driver.routes');
const notificationRoutes = require('./routes/notification.routes');
const paymentRoutes = require('./routes/payment.routes');
const issuesRoutes = require('./routes/issues.routes');
const routingRoutes = require('./routes/routing');
const gpsRoutes = require('./routes/gps.routes');
// Phase 4: Trust, Safety, Operations & Analytics
const verificationRoutes = require('./routes/verification.routes');
const safetyReportingRoutes = require('./routes/safetyReporting.routes');
const tripSafetyRoutes = require('./routes/tripSafety.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const messagesRoutes = require('./routes/messages.routes');
const { getAllowedFrontendOrigins } = require('./utils/frontendOrigins');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { initSocketServer } = require('./socket');
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
initSocketServer(server);
const PORT = Number(process.env.PORT || 4000);
const allowedFrontendOrigins = getAllowedFrontendOrigins();
const FRONTEND_URL = allowedFrontendOrigins[0] || '';
const FRONTEND_DIST_PATH = path.resolve(__dirname, '../frontend/dist');
const FRONTEND_INDEX_PATH = path.join(FRONTEND_DIST_PATH, 'index.html');
let isDatabaseConnected = false;

const getLegacyMongoUrl = () => {
	const envPaths = [path.resolve(__dirname, '../.env'), path.resolve(__dirname, '.env')];

	for (const envPath of envPaths) {
		if (!fs.existsSync(envPath)) {
			continue;
		}

		const fileContent = fs.readFileSync(envPath, 'utf-8');
		const match = fileContent.match(/^\s*MongoUrl\s*[:=]\s*(.+)\s*$/im);

		if (match && match[1]) {
			return match[1].trim();
		}
	}

	return '';
};

const getMongoConnectionString = () =>
	process.env.MONGO_URL || process.env.MongoUrl || getLegacyMongoUrl();

const validateMongoConnectionString = (connectionString) => {
	const uri = String(connectionString || '').trim();

	if (!uri) {
		throw new Error('Missing MongoDB connection string. Use MONGO_URL or MongoUrl in .env');
	}

	if (uri.includes('<db_password>') || uri.includes('<') || uri.includes('>')) {
		throw new Error(
			'MongoDB URI contains a placeholder value. Replace <db_password> with your real database password in .env (URL-encode special characters).'
		);
	}

	if (!/^mongodb(\+srv)?:\/\//i.test(uri)) {
		throw new Error('MongoDB URI must start with mongodb:// or mongodb+srv://');
	}

	return uri;
};

const seedDefaultAdmin = async () => {
	const adminEmail = (process.env.ADMIN_EMAIL || 'admin@hnsapp.local').trim().toLowerCase();

	const existingAdmin = await User.findOne({ role: 'admin', email: adminEmail }).select('_id');

	if (existingAdmin) {
		return;
	}

	const adminPassword = process.env.ADMIN_PASSWORD;
	if (!adminPassword || !adminPassword.trim()) {
		console.warn('Skipping automatic admin creation: ADMIN_PASSWORD is not configured.');
		return;
	}

	const passwordHash = await bcrypt.hash(adminPassword, 12);

	await User.create({
		role: 'admin',
		fullName: 'System Administrator',
		email: adminEmail,
		passwordHash,
		status: 'approved',
		notifications: [],
	});

	console.log(`Default admin account created for ${adminEmail}`);
};

const connectToDatabase = async () => {
	const connectionString = validateMongoConnectionString(getMongoConnectionString());
	const configuredDnsServers = process.env.MONGODB_DNS_SERVERS;

	if (process.env.NODE_ENV === 'development' && configuredDnsServers?.trim()) {
		const dnsServers = configuredDnsServers.split(',').map((server) => server.trim());

		if (dnsServers.some((server) => !server)) {
			throw new Error('MONGODB_DNS_SERVERS must be a comma-separated list without empty entries.');
		}

		dns.setServers(dnsServers);
	}

	await mongoose.connect(connectionString);
};

const initializeDatabase = async () => {
	try {
		await connectToDatabase();
		await seedDefaultAdmin();
	} catch (error) {
		isDatabaseConnected = false;
		console.error('Database initialization failed:', error.message);

		// Keep the service alive for platform healthchecks, then retry.
		setTimeout(() => {
			initializeDatabase();
		}, 5000);
	}
};

app.use(cors({
	origin: (origin, callback) => {
		callback(null, !origin || allowedFrontendOrigins.includes(origin));
	},
	credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Request logging middleware - MUST be first!
app.use((req, res, next) => {
	const start = Date.now();
	console.error(`[REQUEST] Incoming: ${req.method} ${req.path}`);
	res.on('finish', () => {
		const duration = Date.now() - start;
		console.error(`[RESPONSE] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
	});
	next();
});

app.use(express.static(FRONTEND_DIST_PATH));

const respondWithFrontendApp = (req, res, next) => {
	if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
		return next();
	}

	if (fs.existsSync(FRONTEND_INDEX_PATH)) {
		return res.sendFile(FRONTEND_INDEX_PATH);
	}

	if (FRONTEND_URL) {
		return res.redirect(FRONTEND_URL);
	}

	return res.status(200).json({
		message: 'H&S backend is running.',
		health: '/api/health',
		note: 'Frontend build not found. Run `npm run build --prefix frontend` or set FRONTEND_URL.',
	});
};

app.get('/', respondWithFrontendApp);

app.get('/health', (req, res) => {
	return res.redirect('/api/health');
});

app.get('/api/health', (req, res) => {
	const databaseConnected = isDatabaseConnected;
	res.status(databaseConnected ? 200 : 503).json({
		message: databaseConnected ? 'Server is ready.' : 'Database is not connected.',
		database: isDatabaseConnected ? 'connected' : 'connecting',
	});
});

app.use('/api/auth', authRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/gps', gpsRoutes);
// Phase 4: Trust, Safety, Operations & Analytics
app.use('/api/verification', verificationRoutes);
app.use('/api/safety', safetyReportingRoutes);
app.use('/api/trip-safety', tripSafetyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/messages', messagesRoutes);

console.log('[Startup] Routes registered:');
console.log('  - /api/auth');
console.log('  - /api/parents');
console.log('  - /api/admin');
console.log('  - /api/drivers');
console.log('  - /api/gps');
console.log('  - /api/notifications');
console.log('  - /api/issues');
console.log('  - /api/routing');
console.log('  - /api/verification (Phase 4)');
console.log('  - /api/safety (Phase 4)');
console.log('  - /api/trip-safety (Phase 4)');
console.log('  - /api/analytics (Phase 4)');
console.log('  - /health and /api/health (status check)');

app.get(/^\/(?!api|socket\.io).*/, respondWithFrontendApp);

app.use((req, res) => {
	res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((error, req, res, next) => {
	console.error(error);
	res.status(500).json({ message: 'Unexpected server error.' });
});

const startServer = async () => {
	try {
		server.listen(PORT, '0.0.0.0', () => {
			console.log('═══════════════════════════════════════════════════════════');
			console.log(`✓ Backend server listening on 0.0.0.0:${PORT}`);
			console.log(`✓ Frontend URL configured: ${FRONTEND_URL || '(not set - using default)'}`);
			console.log(`✓ Vite proxy should target: http://localhost:${PORT}`);
			console.log('═══════════════════════════════════════════════════════════');
		});

		// Handle server errors
		server.on('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				console.error(`✗ Port ${PORT} is already in use. Please free the port or set a different PORT in .env`);
				process.exit(1);
			}
			console.error('[Server] Error:', err);
		});

		// Handle ECONNABORTED and other socket errors
		server.on('clientError', (err, socket) => {
			console.error('[Server] Client error:', err.code, err.message);
			// Prevent server crash on client disconnects
			if (err.code === 'ECONNABORTED' || err.code === 'EPIPE') {
				console.warn('[Server] Client connection aborted, recovering gracefully');
				try {
					socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
				} catch (e) {
					console.error('[Server] Error sending response:', e.message);
				}
				return;
			}
		});

		initializeDatabase();
	} catch (error) {
		console.error('Failed to start backend server:', error.message);
		process.exit(1);
	}
};

mongoose.connection.on('connected', () => {
	isDatabaseConnected = true;
	console.log('Connected to MongoDB.');
});

mongoose.connection.on('disconnected', () => {
	isDatabaseConnected = false;
	console.warn('Disconnected from MongoDB. Reconnecting...');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
	console.log('[Server] SIGTERM received, shutting down gracefully');
	server.close(() => {
		console.log('[Server] Server closed');
		process.exit(0);
	});
});

process.on('SIGINT', () => {
	console.log('[Server] SIGINT received, shutting down gracefully');
	server.close(() => {
		console.log('[Server] Server closed');
		process.exit(0);
	});
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
	console.error('[Server] Uncaught exception:', err);
	// Keep server alive but log the error
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
	// Keep server alive but log the error
});

startServer();
