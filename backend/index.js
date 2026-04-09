const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const authRoutes = require('./routes/auth.routes');
const parentRoutes = require('./routes/parent.routes');
const adminRoutes = require('./routes/admin.routes');
const driverRoutes = require('./routes/driver.routes');
const routingRoutes = require('./routes/routing');
const { initSocketServer } = require('./socket');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
initSocketServer(server);
const PORT = Number(process.env.PORT || 4000);
const FRONTEND_URL = String(process.env.FRONTEND_URL || '').trim();
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
	const adminPassword = process.env.ADMIN_PASSWORD || 'Admin12345';

	const existingAdmin = await User.findOne({ role: 'admin', email: adminEmail }).select('_id');

	if (existingAdmin) {
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

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
	if (FRONTEND_URL) {
		return res.redirect(FRONTEND_URL);
	}

	return res.status(200).json({
		message: 'H&S backend is running.',
		health: '/api/health',
		note: 'Set FRONTEND_URL to auto-redirect this domain to your frontend app.',
	});
});

app.get('/health', (req, res) => {
	return res.redirect('/api/health');
});

app.get('/api/health', (req, res) => {
	res.status(200).json({
		message: 'Server is running.',
		database: isDatabaseConnected ? 'connected' : 'connecting',
	});
});

app.use('/api/auth', authRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/routing', routingRoutes);

app.use((req, res) => {
	res.status(404).json({ message: 'Endpoint not found.' });
});

app.use((error, req, res, next) => {
	console.error(error);
	res.status(500).json({ message: 'Unexpected server error.' });
});

const startServer = async () => {
	try {
		server.listen(PORT, () => {
			console.log(`Backend server listening on http://localhost:${PORT}`);
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

startServer();
