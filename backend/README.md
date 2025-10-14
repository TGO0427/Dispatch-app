# Dispatch Management Backend API

RESTful API for the Dispatch Management System built with Express.js and TypeScript.

## Features

- ✅ Job management (CRUD operations)
- ✅ Driver/Transporter management
- ✅ CORS enabled for frontend communication
- ✅ TypeScript for type safety
- ✅ Environment-based configuration
- ✅ Request logging with Morgan
- ✅ Health check endpoint

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Logging**: Morgan
- **CORS**: cors middleware

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Run Development Server

```bash
npm run dev
```

Server will start on http://localhost:3001

### 4. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-14T10:30:00.000Z",
  "environment": "development"
}
```

### Jobs

#### Get All Jobs
```http
GET /api/jobs
```

#### Get Job by ID
```http
GET /api/jobs/:id
```

#### Create Job
```http
POST /api/jobs
Content-Type: application/json

{
  "ref": "JOB-001",
  "customer": "ABC Corp",
  "pickup": "Warehouse A",
  "dropoff": "Store 1",
  "priority": "high",
  "status": "pending"
}
```

#### Update Job
```http
PUT /api/jobs/:id
Content-Type: application/json

{
  "status": "delivered"
}
```

#### Delete Job
```http
DELETE /api/jobs/:id
```

#### Bulk Create Jobs
```http
POST /api/jobs/bulk
Content-Type: application/json

{
  "jobs": [
    { /* job 1 */ },
    { /* job 2 */ }
  ]
}
```

### Drivers

#### Get All Drivers
```http
GET /api/drivers
```

#### Get Driver by ID
```http
GET /api/drivers/:id
```

#### Create Driver
```http
POST /api/drivers
Content-Type: application/json

{
  "name": "ATS Transport",
  "callsign": "ATS-01",
  "location": "Regional",
  "capacity": 40,
  "status": "available"
}
```

#### Update Driver
```http
PUT /api/drivers/:id
Content-Type: application/json

{
  "status": "busy"
}
```

#### Delete Driver
```http
DELETE /api/drivers/:id
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |

## Project Structure

```
backend/
├── src/
│   ├── routes/
│   │   ├── jobs.ts        # Job routes
│   │   └── drivers.ts     # Driver routes
│   ├── controllers/       # (Future: Business logic)
│   ├── models/            # (Future: Data models)
│   └── server.ts          # Main server file
├── dist/                  # Compiled JavaScript
├── .env.example           # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Available Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Compile TypeScript to JavaScript
npm start        # Start production server
npm test         # Run tests (to be implemented)
```

### Adding New Routes

1. Create route file in `src/routes/`
2. Import and use in `src/server.ts`
3. Add controller logic if needed

### Code Style

- TypeScript strict mode enabled
- ES modules (commonjs for compatibility)
- Async/await for asynchronous operations

## Deployment

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed deployment instructions.

### Railway Deployment

```bash
# Railway will run:
npm install
npm run build
npm start
```

## Adding Database

Currently using in-memory storage. To add a database:

### PostgreSQL Example

```bash
npm install pg @types/pg
```

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

### MongoDB Example

```bash
npm install mongodb
```

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
```

## Security

- CORS configured for specific frontend origin
- Environment variables for sensitive data
- Error messages sanitized in production
- Request logging for monitoring

## Testing

To add tests:

```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

Create test files: `*.test.ts`

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit pull request

## License

ISC
