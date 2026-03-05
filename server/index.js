import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'entries.json');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const app = express();
app.use(cors());
app.use(express.json());

async function ensureDataFile() {
  const dataDir = path.dirname(DATA_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ entries: [] }, null, 2));
  }
}

async function readEntries() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);
  return data.entries || [];
}

async function writeEntries(entries) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify({ entries }, null, 2));
}

// GET all entries (optionally by month for stats)
app.get('/api/entries', async (req, res) => {
  try {
    const entries = await readEntries();
    const month = req.query.month; // YYYY-MM
    const year = req.query.year;
    let filtered = entries;
    const dateFor = (e) => new Date(e.boughtAt || e.createdAt);
    if (month && year) {
      filtered = entries.filter((e) => {
        const d = dateFor(e);
        return d.getFullYear() === parseInt(year, 10) && (d.getMonth() + 1) === parseInt(month, 10);
      });
    } else if (year) {
      filtered = entries.filter((e) => dateFor(e).getFullYear() === parseInt(year, 10));
    }
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read entries' });
  }
});

// GET monthly statistics
// All totals (boughtTotal, soldTotal, soldCount, profit, bilans) are attributed to the month of createdAt (when item was added).
// soldAt is not used for revenue/bilans so that marking an item sold later still updates the month where the item was added.
app.get('/api/stats/monthly', async (req, res) => {
  try {
    const entries = await readEntries();
    const byMonth = {};
    function ensureMonth(key) {
      if (!byMonth[key]) {
        byMonth[key] = { month: key, boughtTotal: 0, soldTotal: 0, soldCount: 0, addedCount: 0, profit: 0 };
      }
      return byMonth[key];
    }
    for (const e of entries) {
      const bought = new Date(e.boughtAt || e.createdAt);
      const monthKey = `${bought.getFullYear()}-${String(bought.getMonth() + 1).padStart(2, '0')}`;
      const m = ensureMonth(monthKey);
      m.boughtTotal += Number(e.boughtPrice) || 0;
      m.addedCount += 1;

      const hasSold = e.sellPrice != null && e.sellPrice !== '';
      if (hasSold) {
        m.soldTotal += Number(e.sellPrice) || 0;
        m.soldCount += 1;
        m.profit += (Number(e.sellPrice) || 0) - (Number(e.boughtPrice) || 0);
      }
    }
    const list = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute stats' });
  }
});

// POST new entry
app.post('/api/entries', async (req, res) => {
  try {
    const { name, boughtPrice, sellPrice, boughtAt: boughtAtBody } = req.body;
    if (!name || boughtPrice == null) {
      return res.status(400).json({ error: 'Name and bought price are required' });
    }
    const entries = await readEntries();
    const createdAt = new Date().toISOString();
    let boughtAt = createdAt;
    if (boughtAtBody) {
      const d = new Date(boughtAtBody);
      if (!Number.isNaN(d.getTime())) boughtAt = d.toISOString();
    }
    const entry = {
      id: crypto.randomUUID(),
      name: String(name).trim(),
      boughtPrice: Number(boughtPrice) || 0,
      sellPrice: sellPrice != null && sellPrice !== '' ? Number(sellPrice) : null,
      soldAt: sellPrice != null && sellPrice !== '' ? new Date().toISOString() : null,
      boughtAt,
      createdAt,
    };
    entries.push(entry);
    await writeEntries(entries);
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add entry' });
  }
});

// PATCH update entry (name, boughtPrice, boughtAt, sellPrice)
app.patch('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, boughtPrice, boughtAt: boughtAtBody, sellPrice } = req.body;
    const entries = await readEntries();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Entry not found' });
    if (name != null && name !== '') {
      entries[idx].name = String(name).trim();
    }
    if (boughtPrice != null && boughtPrice !== '') {
      const num = Number(boughtPrice);
      if (!Number.isNaN(num) && num >= 0) entries[idx].boughtPrice = num;
    }
    if (boughtAtBody != null && boughtAtBody !== '') {
      const d = new Date(boughtAtBody);
      if (!Number.isNaN(d.getTime())) entries[idx].boughtAt = d.toISOString();
    }
    if (sellPrice != null && sellPrice !== '') {
      entries[idx].sellPrice = Number(sellPrice);
      entries[idx].soldAt = new Date().toISOString();
    } else if (sellPrice === null || sellPrice === '') {
      entries[idx].sellPrice = null;
      entries[idx].soldAt = null;
    }
    await writeEntries(entries);
    res.json(entries[idx]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE entry
app.delete('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const entries = await readEntries();
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === entries.length) return res.status(404).json({ error: 'Entry not found' });
    await writeEntries(filtered);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Serve built client static files when public dir exists (Docker / production)
const indexPath = path.join(PUBLIC_DIR, 'index.html');
if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexPath, (err) => (err ? next(err) : undefined));
  });
} else {
  // Dev mode: no built client; tell user to run the Vite dev server
  app.get('/', (req, res) => {
    res.type('html').send(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Dev – Clothes Tracker</title></head>
        <body style="font-family: system-ui; max-width: 480px; margin: 2rem auto; padding: 0 1rem;">
          <h1>Tryb deweloperski</h1>
          <p>Backend działa na porcie 3001. Aby zobaczyć aplikację, uruchom frontend:</p>
          <pre style="background: #f0f0f0; padding: 1rem; overflow-x: auto;">cd client && npm run dev</pre>
          <p>Następnie otwórz w przeglądarce adres podany przez Vite (np. <a href="http://localhost:5173">http://localhost:5173</a>).</p>
        </body>
      </html>
    `);
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
