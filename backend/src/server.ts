import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import jobsRouter from './routes/jobs';
import driversRouter from './routes/drivers';

dotenv.config();

const app: Express = express();
const PORT = Number(process.env.PORT) || 3001;

// Trust proxy for Railway
app.set('trust proxy', 1);

// Middleware
const allowedOrigins: (string | RegExp)[] = [
  'http://localhost:3000',
  'http://localhost:3002',
  'https://dispatch-app-t.vercel.app',
  /^https:\/\/dispatch-.*\.vercel\.app$/, // Allow all Vercel preview deployments
  process.env.FRONTEND_URL || ''
].filter(origin => origin !== '');

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin matches any allowed origins
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/jobs', jobsRouter);
app.use('/api/drivers', driversRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Dispatch Management API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      jobs: '/api/jobs',
      drivers: '/api/drivers'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const HOST = '0.0.0.0'; // Bind to all interfaces for Railway
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

export default app;
