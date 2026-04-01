import express from 'express';
import cors from 'cors';
import path from 'path';
import filesRouter from './routes/files.js';
import imagesRouter from './routes/images.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());
app.use(express.text());
app.use('/api/files', filesRouter);
app.use('/api/images', imagesRouter);

// In production, serve the built frontend
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NotionMind server running on http://localhost:${PORT}`);
});
