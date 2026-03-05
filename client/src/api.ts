import type { ClothesEntry, MonthlyStat } from './types';

const API = '/api';

export async function fetchEntries(): Promise<ClothesEntry[]> {
  const res = await fetch(`${API}/entries`);
  if (!res.ok) throw new Error('Failed to load entries');
  return res.json();
}

export async function addEntry(data: {
  name: string;
  boughtPrice: number;
  boughtDate?: string;
  sellPrice?: number | '';
}): Promise<ClothesEntry> {
  const body: Record<string, unknown> = {
    name: data.name,
    boughtPrice: data.boughtPrice,
    sellPrice: data.sellPrice === '' ? undefined : data.sellPrice,
  };
  if (data.boughtDate) body.boughtAt = new Date(data.boughtDate + 'T12:00:00.000Z').toISOString();
  const res = await fetch(`${API}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add entry');
  }
  return res.json();
}

export async function updateEntrySellPrice(id: string, sellPrice: number): Promise<ClothesEntry> {
  const res = await fetch(`${API}/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sellPrice }),
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return res.json();
}

export async function updateEntry(
  id: string,
  data: { name?: string; boughtPrice?: number; boughtAt?: string | null; sellPrice?: number | null }
): Promise<ClothesEntry> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.boughtPrice !== undefined) body.boughtPrice = data.boughtPrice;
  if (data.boughtAt !== undefined) body.boughtAt = data.boughtAt === null ? '' : data.boughtAt;
  if (data.sellPrice !== undefined)
    body.sellPrice = data.sellPrice === null ? '' : data.sellPrice;
  const res = await fetch(`${API}/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update entry');
  }
  return res.json();
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await fetch(`${API}/entries/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete entry');
}

export async function fetchMonthlyStats(): Promise<MonthlyStat[]> {
  const res = await fetch(`${API}/stats/monthly`);
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}
