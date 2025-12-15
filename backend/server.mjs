// backend/server.mjs
import cors from 'cors';
import express from 'express';

// ROUTES
import scanRoute from './routes/scan/index.mjs';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Root check
app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// ✅ Health check (Step 1)
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

// Scan route
app.use('/scan', scanRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
