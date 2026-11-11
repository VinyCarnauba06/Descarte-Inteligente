import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { criarApiExpress } from './apiApp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 5173);
const app = criarApiExpress({ persistirEmDisco: true });

const publicDir = path.resolve(__dirname, '../public');
app.use(
  express.static(publicDir, {
    etag: true,
    setHeaders: (res, filePath) => {
      if (
        filePath.endsWith('.html') ||
        filePath.endsWith('sw.js') ||
        filePath.endsWith('manifest.json')
      ) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      } else if (filePath.includes('vendor')) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(
    `Sistema Descarte Inteligente (Web + API) ativo em http://localhost:${PORT}`
  );
});
