import { mkdir, readFile, writeFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.env.DATA_DIR ?? path.resolve(import.meta.dir, 'data'), 'entries.json');
const PUBLIC_DIR = path.resolve(import.meta.dir, 'public');
const PORT = Number(process.env.PORT) || 3001;

const KNOWN_SOURCES = [
  'zara', 'h&m', 'hm', 'nike', 'adidas', 'reserved', 'stradivarius',
  'bershka', 'pull&bear', 'mango', 'cropp', 'house', 'mohito', 'shein',
  'primark', "levi's", 'levis', 'gap', 'guess', 'boss', 'olx', 'allegro',
  'second hand', 'secondhand', 'vinted',
];

interface Tag {
  type: 'size' | 'source';
  value: string;
}

interface Entry {
  id: string;
  name: string;
  boughtPrice: number;
  sellPrice: number | null;
  soldAt: string | null;
  boughtAt: string;
  createdAt: string;
  vintedUrl: string | null;
}

function parseTags(name: string): Tag[] {
  const tags: Tag[] = [];
  const sizeMatches = [...name.matchAll(/roz\.\s*([A-Z0-9]+(?:\/[A-Z0-9]+)?)/gi)];
  for (const m of sizeMatches) {
    tags.push({ type: 'size', value: m[1].toUpperCase() });
  }
  const lower = name.toLowerCase();
  for (const source of KNOWN_SOURCES) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?<![a-ząćęłńóśźż])${escaped}(?![a-ząćęłńóśźż])`, 'i').test(lower)) {
      tags.push({ type: 'source', value: source.toUpperCase() });
      break;
    }
  }
  return tags;
}

async function ensureDataFile(): Promise<void> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    await access(DATA_FILE);
  } catch {
    await writeFile(DATA_FILE, JSON.stringify({ entries: [] }, null, 2));
  }
}

async function readEntries(): Promise<Entry[]> {
  await ensureDataFile();
  const raw = await readFile(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);
  return data.entries ?? [];
}

async function writeEntries(entries: Entry[]): Promise<void> {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify({ entries }, null, 2));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers });
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // GET /api/price-suggestions
  if (req.method === 'GET' && pathname === '/api/price-suggestions') {
    try {
      const entries = await readEntries();
      const freq: Record<number, number> = {};
      for (const e of entries) {
        const p = Number(e.boughtPrice);
        if (p > 0) freq[p] = (freq[p] ?? 0) + 1;
      }
      const suggestions = Object.entries(freq)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 5)
        .map(([p]) => Number(p))
        .sort((a, b) => a - b);
      return json(suggestions);
    } catch (err) {
      console.error(err);
      return json({ error: 'Failed to get price suggestions' }, 500);
    }
  }

  // GET /api/sizes
  if (req.method === 'GET' && pathname === '/api/sizes') {
    try {
      const entries = await readEntries();
      const freq: Record<string, number> = {};
      const sizeRegex = /roz\.\s*([A-Z0-9]+(?:\/[A-Z0-9]+)?)/gi;
      for (const e of entries) {
        for (const m of e.name.matchAll(sizeRegex)) {
          const size = m[1].toUpperCase();
          freq[size] = (freq[size] ?? 0) + 1;
        }
      }
      const sizes = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([size]) => size);
      return json(sizes);
    } catch (err) {
      console.error(err);
      return json({ error: 'Failed to compute sizes' }, 500);
    }
  }

  // GET /api/entries
  if (req.method === 'GET' && pathname === '/api/entries') {
    try {
      const entries = await readEntries();
      const month = url.searchParams.get('month');
      const year = url.searchParams.get('year');
      const dateFor = (e: Entry) => new Date(e.boughtAt || e.createdAt);
      let filtered = entries;
      if (month && year) {
        filtered = entries.filter((e) => {
          const d = dateFor(e);
          return d.getFullYear() === parseInt(year, 10) && (d.getMonth() + 1) === parseInt(month, 10);
        });
      } else if (year) {
        filtered = entries.filter((e) => dateFor(e).getFullYear() === parseInt(year, 10));
      }
      return json(filtered.map((e) => ({ ...e, tags: parseTags(e.name) })));
    } catch (err) {
      console.error(err);
      return json({ error: 'Failed to read entries' }, 500);
    }
  }

  // GET /api/stats/monthly
  if (req.method === 'GET' && pathname === '/api/stats/monthly') {
    try {
      const entries = await readEntries();
      const byMonth: Record<string, { month: string; boughtTotal: number; soldTotal: number; soldCount: number; addedCount: number; profit: number }> = {};
      const ensureMonth = (key: string) => {
        byMonth[key] ??= { month: key, boughtTotal: 0, soldTotal: 0, soldCount: 0, addedCount: 0, profit: 0 };
        return byMonth[key];
      };
      for (const e of entries) {
        const bought = new Date(e.boughtAt || e.createdAt);
        const monthKey = `${bought.getFullYear()}-${String(bought.getMonth() + 1).padStart(2, '0')}`;
        const m = ensureMonth(monthKey);
        m.boughtTotal += Number(e.boughtPrice) || 0;
        m.addedCount += 1;
        if (e.sellPrice != null) {
          m.soldTotal += Number(e.sellPrice) || 0;
          m.soldCount += 1;
          m.profit += (Number(e.sellPrice) || 0) - (Number(e.boughtPrice) || 0);
        }
      }
      const list = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
      return json(list);
    } catch (err) {
      console.error(err);
      return json({ error: 'Failed to compute stats' }, 500);
    }
  }

  // POST /api/entries
  if (req.method === 'POST' && pathname === '/api/entries') {
    try {
      type PostBody = { name?: string; boughtPrice?: number | string; sellPrice?: number | string | null; boughtAt?: string; vintedUrl?: string | null };
      const body = await req.json() as PostBody;
      const { name, boughtPrice, sellPrice, boughtAt: boughtAtBody, vintedUrl } = body;
      if (!name || boughtPrice == null) {
        return json({ error: 'Name and bought price are required' }, 400);
      }
      const entries = await readEntries();
      const createdAt = new Date().toISOString();
      let boughtAt = createdAt;
      if (boughtAtBody) {
        const d = new Date(boughtAtBody);
        if (!Number.isNaN(d.getTime())) boughtAt = d.toISOString();
      }
      const hasSell = sellPrice != null && sellPrice !== '';
      const entry: Entry = {
        id: crypto.randomUUID(),
        name: String(name).trim(),
        boughtPrice: Number(boughtPrice) || 0,
        sellPrice: hasSell ? Number(sellPrice) : null,
        soldAt: hasSell ? new Date().toISOString() : null,
        boughtAt,
        createdAt,
        vintedUrl: vintedUrl ? String(vintedUrl).trim() : null,
      };
      entries.push(entry);
      await writeEntries(entries);
      return json(entry, 201);
    } catch (err) {
      console.error(err);
      return json({ error: 'Failed to add entry' }, 500);
    }
  }

  // PATCH /api/entries/:id
  const patchMatch = pathname.match(/^\/api\/entries\/([^/]+)$/);
  if (req.method === 'PATCH' && patchMatch) {
    try {
      const id = patchMatch[1];
      type PatchBody = { name?: string; boughtPrice?: number | string; boughtAt?: string; sellPrice?: number | string | null; vintedUrl?: string | null };
      const body = await req.json() as PatchBody;
      const { name, boughtPrice, boughtAt: boughtAtBody, sellPrice, vintedUrl } = body;
      const entries = await readEntries();
      const idx = entries.findIndex((e) => e.id === id);
      if (idx === -1) return json({ error: 'Entry not found' }, 404);
      if (name != null && name !== '') entries[idx].name = String(name).trim();
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
      if (vintedUrl !== undefined) {
        entries[idx].vintedUrl = vintedUrl === '' ? null : String(vintedUrl).trim();
      }
      await writeEntries(entries);
      return json(entries[idx]);
    } catch (err) {
      console.error(err);
      return json({ error: 'Failed to update entry' }, 500);
    }
  }

  // DELETE /api/entries/:id
  const deleteMatch = pathname.match(/^\/api\/entries\/([^/]+)$/);
  if (req.method === 'DELETE' && deleteMatch) {
    try {
      const id = deleteMatch[1];
      const entries = await readEntries();
      const filtered = entries.filter((e) => e.id !== id);
      if (filtered.length === entries.length) return json({ error: 'Entry not found' }, 404);
      await writeEntries(filtered);
      return new Response(null, { status: 204 });
    } catch (err) {
      console.error(err);
      return json({ error: 'Failed to delete entry' }, 500);
    }
  }

  // Serve static files in production
  if (!pathname.startsWith('/api') && existsSync(PUBLIC_DIR)) {
    const filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    const file = Bun.file(filePath);
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(path.join(PUBLIC_DIR, 'index.html')));
  }

  // Dev mode root
  if (pathname === '/' && !existsSync(PUBLIC_DIR)) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dev – Clothes Tracker</title></head>
      <body style="font-family: system-ui; max-width: 480px; margin: 2rem auto; padding: 0 1rem;">
        <h1>Tryb deweloperski</h1>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  return json({ error: 'Not found' }, 404);
}

Bun.serve({
  port: PORT,
  fetch: async (req) => withCors(await handleRequest(req)),
});

console.log(`Server running at http://localhost:${PORT}`);
