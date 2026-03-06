import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchEntries, fetchMonthlyStats, deleteEntry, updateEntrySellPrice, updateEntry } from './api';
import type { ClothesEntry, MonthlyStat } from './types';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function formatMonth(key: string): string {
  const [y, m] = key.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
  return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

function getBoughtAt(e: ClothesEntry): string {
  return e.boughtAt ?? e.createdAt;
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

function isoToMonthYear(iso: string): { month: number; year: number } {
  const d = new Date(iso);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function groupEntriesByMonth(entries: ClothesEntry[]): Record<string, ClothesEntry[]> {
  const map: Record<string, ClothesEntry[]> = {};
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  for (const e of sorted) {
    const d = new Date(getBoughtAt(e));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = [];
    map[key].push(e);
  }
  return map;
}

const svgProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function StatIconSpent() {
  return (<svg {...svgProps} aria-hidden><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V9"/></svg>);
}
function StatIconSold() {
  return (<svg {...svgProps} aria-hidden><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/></svg>);
}
function StatIconSoldCount() {
  return (<svg {...svgProps} aria-hidden><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>);
}
function StatIconUnsoldCount() {
  return (<svg {...svgProps} aria-hidden><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>);
}
function StatIconProfit() {
  return (<svg {...svgProps} aria-hidden><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>);
}
function StatIconBilans() {
  return (<svg {...svgProps} aria-hidden><line x1="12" x2="12" y1="3" y2="21"/><path d="m8 7 4-4 4 4"/><path d="M16 17l-4 4-4-4"/><line x1="18" x2="6" y1="12" y2="12"/></svg>);
}

const detailIconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function DetailIconCalendar() {
  return (<svg {...detailIconProps} aria-hidden><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>);
}

interface EntryListProps {
  selectedEntryId: string | null;
  onSelectedEntryIdChange: (id: string | null) => void;
  filterYear: number;
  filterMonth: number | null;
  onFilterYearChange: (year: number) => void;
  onFilterMonthChange: (month: number | null) => void;
}

export function EntryList({
  selectedEntryId,
  onSelectedEntryIdChange,
  filterYear,
  filterMonth,
  onFilterYearChange,
  onFilterMonthChange,
}: EntryListProps) {
  const [entries, setEntries] = useState<ClothesEntry[]>([]);
  const [stats, setStats] = useState<MonthlyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingSell, setEditingSell] = useState<string | null>(null);
  const [sellPriceInput, setSellPriceInput] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBoughtPrice, setEditBoughtPrice] = useState('');
  const [editBoughtMonth, setEditBoughtMonth] = useState(1);
  const [editBoughtYear, setEditBoughtYear] = useState(new Date().getFullYear());
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editVintedUrl, setEditVintedUrl] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [todayStatIndex, setTodayStatIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [e, s] = await Promise.all([fetchEntries(), fetchMonthlyStats()]);
      setEntries(e);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się załadować danych');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (stats.length === 0) return;
    const years = [...new Set(stats.map((s) => s.month.split('-')[0]))].map(Number).sort((a, b) => b - a);
    if (years.length > 0 && !years.includes(filterYear)) {
      onFilterYearChange(years[0]);
    }
  }, [stats, filterYear, onFilterYearChange]);

  const todayStats = useMemo(() => {
    const safe = Array.isArray(entries) ? entries : [];
    const addedToday = safe.filter((e) => isToday(e.createdAt)).length;
    const soldToday = safe.filter((e) => e.soldAt && isToday(e.soldAt)).length;
    const totalItems = safe.length;
    const soldEntries = safe.filter((e) => e.sellPrice != null);
    const bestRevenue =
      soldEntries.length === 0
        ? 0
        : Math.max(...soldEntries.map((e) => e.sellPrice! - e.boughtPrice));
    const worstRevenue =
      soldEntries.length === 0
        ? 0
        : Math.min(...soldEntries.map((e) => e.sellPrice! - e.boughtPrice));
    const profitByMonth: Record<string, number> = {};
    for (const e of soldEntries) {
      if (!e.soldAt) continue;
      const d = new Date(e.soldAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      profitByMonth[key] = (profitByMonth[key] ?? 0) + (e.sellPrice! - e.boughtPrice);
    }
    const bestRevenueMonthKey =
      Object.keys(profitByMonth).length > 0
        ? Object.entries(profitByMonth).sort((a, b) => b[1] - a[1])[0][0]
        : null;
    const worstRevenueMonthKey =
      Object.keys(profitByMonth).length > 0
        ? Object.entries(profitByMonth).sort((a, b) => a[1] - b[1])[0][0]
        : null;
    const formatMonthKey = (key: string) => {
      const [y, m] = key.split('-');
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
      return date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    };
    const bestRevenueMonthText = bestRevenueMonthKey ? formatMonthKey(bestRevenueMonthKey) : null;
    const worstRevenueMonthText = worstRevenueMonthKey ? formatMonthKey(worstRevenueMonthKey) : null;
    return [
      { key: 'added', text: `${addedToday} dodanych dziś` },
      { key: 'sold', text: `${soldToday} sprzedanych dziś` },
      { key: 'total', text: `${totalItems} pozycji łącznie` },
      {
        key: 'best-revenue',
        text: `Rekord zysku: ${bestRevenue >= 0 ? '+' : ''}${bestRevenue.toFixed(2)} zł`,
      },
      ...(bestRevenueMonthText
        ? [{ key: 'best-month' as const, text: `Najlepszy miesiąc: ${bestRevenueMonthText}` }]
        : []),
      {
        key: 'worst-revenue',
        text: `Najgorszy zysk: ${worstRevenue >= 0 ? '+' : ''}${worstRevenue.toFixed(2)} zł`,
      },
      ...(worstRevenueMonthText
        ? [{ key: 'worst-month' as const, text: `Najgorszy miesiąc: ${worstRevenueMonthText}` }]
        : []),
    ];
  }, [entries]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayStatIndex((i) => (i + 1) % Math.max(1, todayStats.length));
    }, 3500);
    return () => clearInterval(interval);
  }, [todayStats.length]);

  async function handleDelete(id: string) {
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      onSelectedEntryIdChange(null);
      setConfirmDeleteId(null);
      cancelEditing();
      setEditingSell(null);
      load();
    } catch {
      setError('Nie udało się usunąć');
    }
  }

  async function handleSetSellPrice(id: string) {
    const val = parseFloat(sellPriceInput);
    if (isNaN(val) || val < 0) return;
    try {
      const updated = await updateEntrySellPrice(id, val);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingSell(null);
      setSellPriceInput('');
      load();
    } catch {
      setError('Nie udało się zaktualizować');
    }
  }

  function startEditing(entry: ClothesEntry) {
    setEditingEntryId(entry.id);
    setEditName(entry.name);
    setEditBoughtPrice(String(entry.boughtPrice));
    const { month, year } = isoToMonthYear(getBoughtAt(entry));
    setEditBoughtMonth(month);
    setEditBoughtYear(year);
    setEditSellPrice(entry.sellPrice != null ? String(entry.sellPrice) : '');
    setEditVintedUrl(entry.vintedUrl ?? '');
  }

  function cancelEditing() {
    setEditingEntryId(null);
    setEditName('');
    setEditBoughtPrice('');
    setEditBoughtMonth(new Date().getMonth() + 1);
    setEditBoughtYear(new Date().getFullYear());
    setEditSellPrice('');
    setEditVintedUrl('');
  }

  async function handleSaveEdit(id: string) {
    const name = editName.trim();
    const boughtPrice = parseFloat(editBoughtPrice);
    if (!name || isNaN(boughtPrice) || boughtPrice < 0) return;
    let sellPrice: number | null = null;
    if (editSellPrice.trim() !== '') {
      const v = parseFloat(editSellPrice);
      if (isNaN(v) || v < 0) return;
      sellPrice = v;
    }
    try {
      const updated = await updateEntry(id, {
        name,
        boughtPrice,
        boughtAt: new Date(editBoughtYear, editBoughtMonth - 1, 1, 12, 0, 0, 0).toISOString(),
        sellPrice,
        vintedUrl: editVintedUrl.trim() || null,
      });
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      cancelEditing();
      load();
    } catch {
      setError('Nie udało się zaktualizować');
    }
  }

  if (loading) {
    return (
      <motion.div
        className="list-screen"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <h2 className="screen-title">Wszystkie ubrania</h2>
        <div className="loading-wrap">
          <motion.div
            className="spinner"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p>Ładowanie…</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div className="list-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h2 className="screen-title">Wszystkie ubrania</h2>
        <p className="message error">{error}</p>
        <button type="button" className="btn" onClick={load}>
          Spróbuj ponownie
        </button>
      </motion.div>
    );
  }

  const safeEntries = Array.isArray(entries) ? entries : [];
  const availableYears = stats.length > 0
    ? [...new Set(stats.map((s) => s.month.split('-')[0]))].map(Number).sort((a, b) => b - a)
    : [new Date().getFullYear()];
  const effectiveYear = availableYears.includes(filterYear) ? filterYear : availableYears[0] ?? new Date().getFullYear();

  const availableMonthsForYear = stats.length > 0
    ? [...new Set(
        stats
          .filter((s) => s.month.startsWith(String(effectiveYear)))
          .map((s) => parseInt(s.month.split('-')[1], 10))
      )].sort((a, b) => a - b)
    : [];

  const effectiveMonth = filterMonth != null && availableMonthsForYear.includes(filterMonth)
    ? filterMonth
    : null;

  const normalize = (s: string) =>
    s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const searchActive = searchQuery.trim().length > 0;
  const filteredEntries = safeEntries.filter((e) => {
    if (searchActive) {
      return normalize(e.name).includes(normalize(searchQuery.trim()));
    }
    const d = new Date(getBoughtAt(e));
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (y !== effectiveYear) return false;
    if (effectiveMonth != null && m !== effectiveMonth) return false;
    return true;
  });

  const byMonth = groupEntriesByMonth(filteredEntries);
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
  const selectedEntry = selectedEntryId ? safeEntries.find((e) => e.id === selectedEntryId) : null;
  /* Detail view when an entry is selected */
  if (selectedEntryId && selectedEntry) {
    const isEditingThis = editingEntryId === selectedEntry.id;
    const isSellingThis = editingSell === selectedEntry.id;

    return (
      <motion.div
        className="list-screen entry-detail-screen"
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="entry-detail-content">
          <AnimatePresence mode="wait">
            {isEditingThis ? (
              <motion.div
                key="edit-form"
                className="entry-edit-form vertical"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <label className="label">
                  <span>Nazwa ubrania</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="np. Stara kurtka dżinsowa"
                    className="input"
                    autoComplete="off"
                  />
                </label>
                <label className="label">
                  <span>Miesiąc i rok zakupu</span>
                  <div className="month-year-inputs">
                    <select
                      className="input month-year-select"
                      value={editBoughtMonth}
                      onChange={(e) => setEditBoughtMonth(Number(e.target.value))}
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={i} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <select
                      className="input month-year-select"
                      value={editBoughtYear}
                      onChange={(e) => setEditBoughtYear(Number(e.target.value))}
                    >
                      {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="label">
                  <span>Cena zakupu (zł)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editBoughtPrice}
                    onChange={(e) => setEditBoughtPrice(e.target.value)}
                    placeholder="0.00"
                    className="input"
                    inputMode="decimal"
                  />
                </label>
                <label className="label">
                  <span>Cena sprzedaży (zł) <em>opcjonalnie</em></span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editSellPrice}
                    onChange={(e) => setEditSellPrice(e.target.value)}
                    placeholder="Zostaw puste, jeśli nie sprzedane"
                    className="input"
                    inputMode="decimal"
                  />
                </label>
                <label className="label">
                  <span>Link Vinted <em>opcjonalnie</em></span>
                  <input
                    type="url"
                    value={editVintedUrl}
                    onChange={(e) => setEditVintedUrl(e.target.value)}
                    placeholder="https://www.vinted.pl/items/..."
                    className="input"
                    autoComplete="off"
                  />
                </label>
                <div className="entry-detail-actions">
                  <button type="button" className="btn btn-primary" onClick={() => handleSaveEdit(selectedEntry.id)}>
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                    Zapisz
                  </button>
                  <button type="button" className="btn danger" onClick={cancelEditing}>
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    Anuluj
                  </button>
                </div>
              </motion.div>
            ) : isSellingThis ? (
              <motion.div
                key="sell-form"
                className="sell-edit vertical"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <label className="label">
                  <span>Cena sprzedaży (zł)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sellPriceInput}
                    onChange={(e) => setSellPriceInput(e.target.value)}
                    placeholder="0.00"
                    className="input"
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                <div className="entry-detail-actions">
                  <button type="button" className="btn btn-primary" onClick={() => handleSetSellPrice(selectedEntry.id)}>
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                    Zapisz
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => {
                      setEditingSell(null);
                      setSellPriceInput('');
                    }}
                  >
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    Anuluj
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="detail-view"
                className="entry-detail-view"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <h1 className="entry-detail-heading">{selectedEntry.name}</h1>
                <hr className="entry-detail-divider" aria-hidden />
                <dl className="entry-detail-info">
                  <div className="entry-detail-info-row">
                    <dt><span className="entry-detail-label"><StatIconSpent /> Kupiono</span></dt>
                    <dd>{selectedEntry.boughtPrice.toFixed(2)} zł</dd>
                  </div>
                  <div className="entry-detail-info-row">
                    <dt>
                      <span className="entry-detail-label">
                        {selectedEntry.sellPrice != null ? <StatIconSold /> : <StatIconUnsoldCount />}
                        {selectedEntry.sellPrice != null ? 'Sprzedano' : 'Status'}
                      </span>
                    </dt>
                    <dd>
                      {selectedEntry.sellPrice != null
                        ? `${selectedEntry.sellPrice.toFixed(2)} zł`
                        : 'Nie sprzedano'}
                    </dd>
                  </div>
                  {selectedEntry.sellPrice != null && (
                    <div className="entry-detail-revenue">
                      <span className="entry-detail-label"><StatIconProfit /> Zysk</span>
                      <span className={selectedEntry.sellPrice - selectedEntry.boughtPrice >= 0 ? 'positive' : 'negative'}>
                        {(selectedEntry.sellPrice - selectedEntry.boughtPrice) >= 0 ? '+' : ''}
                        {(selectedEntry.sellPrice - selectedEntry.boughtPrice).toFixed(2)} zł
                      </span>
                    </div>
                  )}
                </dl>
                <hr className="entry-detail-divider" aria-hidden />
                <div className="entry-detail-dates">
                  <div className="entry-detail-info-row">
                    <dt><span className="entry-detail-label"><DetailIconCalendar /> Dodano</span></dt>
                    <dd>{formatMonthYear(selectedEntry.createdAt)}</dd>
                  </div>
                  <div className="entry-detail-info-row">
                    <dt><span className="entry-detail-label"><StatIconSpent /> Kupiono</span></dt>
                    <dd>{formatMonthYear(getBoughtAt(selectedEntry))}</dd>
                  </div>
                  {selectedEntry.soldAt && (
                    <div className="entry-detail-info-row">
                      <dt><span className="entry-detail-label"><StatIconSold /> Sprzedano</span></dt>
                      <dd>{formatMonthYear(selectedEntry.soldAt)}</dd>
                    </div>
                  )}
                </div>
                <div className="entry-detail-actions">
                  {selectedEntry.vintedUrl && (
                    <a
                      href={selectedEntry.vintedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vinted-link"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                      Otwórz na Vinted
                    </a>
                  )}
                  {selectedEntry.sellPrice == null && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setEditingSell(selectedEntry.id);
                        setSellPriceInput('');
                      }}
                    >
                      <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2H2v10l9.5 9.5a2.1 2.1 0 0 0 3 0l7-7a2.1 2.1 0 0 0 0-3L12 2Z" /><path d="M7 7h.01" /></svg>
                      Ustaw sprzedane
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => startEditing(selectedEntry)}
                  >
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /><path d="m15 5 4 4" /></svg>
                    Edytuj
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setConfirmDeleteId(selectedEntry.id)}
                  >
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                    Usuń
                  </button>
                  <button
                    type="button"
                    className="btn back-to-list-button"
                    onClick={() => {
                      onSelectedEntryIdChange(null);
                      cancelEditing();
                      setEditingSell(null);
                      setSellPriceInput('');
                    }}
                  >
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Powrót do listy
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {confirmDeleteId && createPortal(
          <AnimatePresence>
            <motion.div
              key="confirm-overlay"
              className="confirm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setConfirmDeleteId(null)}
            >
              <motion.div
                className="confirm-dialog"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="confirm-message">Czy na pewno chcesz usunąć tę pozycję?</p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                  >
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                    Usuń
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    Anuluj
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="list-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="screen-title-row">
        <h2 className="screen-title">Wszystkie ubrania</h2>
        <div className="screen-title-stats" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {todayStats.length > 0 && (
              <motion.span
                key={todayStats[todayStatIndex % todayStats.length].key}
                className="screen-title-stat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ display: 'block', whiteSpace: 'nowrap' }}
              >
                {todayStats[todayStatIndex % todayStats.length].text}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Year + month filter */}
      {(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const isTodaySelected = filterYear === currentYear && filterMonth === currentMonth;
        return (
          <div className="list-filter">
            <label className="list-filter-label">
              <span>Rok</span>
              <select
                className="list-filter-select"
                value={effectiveYear}
                onChange={(e) => {
                  onFilterYearChange(Number(e.target.value));
                }}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="list-filter-label">
              <span>Miesiąc</span>
              <select
                className="list-filter-select"
                value={effectiveMonth ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onFilterMonthChange(v === '' ? null : Number(v));
                }}
              >
                <option value="">Cały rok</option>
                {availableMonthsForYear.map((monthNum) => (
                  <option key={monthNum} value={monthNum}>{MONTH_NAMES[monthNum - 1]}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary list-filter-today"
              onClick={() => {
                if (isTodaySelected) {
                  onFilterYearChange(currentYear);
                  onFilterMonthChange(null);
                } else {
                  onFilterYearChange(currentYear);
                  onFilterMonthChange(currentMonth);
                }
              }}
            >
              <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
              <span className="list-filter-today-label">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isTodaySelected ? 'rok' : 'dzis'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{ display: 'inline-block' }}
                  >
                    {isTodaySelected ? 'Rok' : 'Dziś'}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>
          </div>
        );
      })()}

      {/* Stats: one card for selected month or aggregated for whole year */}
      {stats.length > 0 && (() => {
        const soldCount = filteredEntries.filter((e) => e.sellPrice != null).length;
        const unsoldCount = filteredEntries.filter((e) => e.sellPrice == null).length;
        const statsKey = `${effectiveYear}-${effectiveMonth ?? 'all'}`;
        let statsContent: ReactNode = null;
        if (effectiveMonth != null) {
          const monthKey = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`;
          const s = stats.find((x) => x.month === monthKey);
          if (s) {
            const bilans = s.soldTotal - s.boughtTotal;
            statsContent = (
              <motion.section
                key={statsKey}
                className="monthly-stats"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <h3>Statystyki</h3>
                <div className="stats-cards">
                  <motion.div
                    className="stat-card"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                  >
                  <div className="stat-month">{formatMonth(monthKey)}</div>
                  <div className="stat-row">
                    <span className="stat-label"><StatIconSpent /> Wydano</span>
                    <span className="stat-value spent">−{s.boughtTotal.toFixed(2)} zł</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label"><StatIconSold /> Sprzedano</span>
                    <span className="stat-value sold">+{s.soldTotal.toFixed(2)} zł</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label"><StatIconSoldCount /> Pozycje sprzedane</span>
                    <span className="stat-value">{soldCount}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label"><StatIconUnsoldCount /> Pozycje nie sprzedane</span>
                    <span className="stat-value">{unsoldCount}</span>
                  </div>
                  <div className="stat-row profit-row">
                    <span className="stat-label"><StatIconProfit /> Zysk</span>
                    <span className={`stat-value ${s.profit >= 0 ? 'profit' : 'loss'}`}>
                      {s.profit >= 0 ? '+' : ''}{s.profit.toFixed(2)} zł
                    </span>
                  </div>
                  <div className="stat-row bilans-row">
                    <span className="stat-label"><StatIconBilans /> Bilans</span>
                    <span className={`stat-value ${bilans >= 0 ? 'profit' : 'loss'}`}>
                      {bilans >= 0 ? '+' : ''}{bilans.toFixed(2)} zł
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.section>
            );
          }
        } else {
          const yearStats = stats.filter((s) => s.month.startsWith(String(effectiveYear)));
          if (yearStats.length > 0) {
            const aggregated = yearStats.reduce(
              (acc, s) => ({
                boughtTotal: acc.boughtTotal + s.boughtTotal,
                soldTotal: acc.soldTotal + s.soldTotal,
                profit: acc.profit + s.profit,
              }),
              { boughtTotal: 0, soldTotal: 0, profit: 0 }
            );
            const bilans = aggregated.soldTotal - aggregated.boughtTotal;
            statsContent = (
              <motion.section
                key={statsKey}
                className="monthly-stats"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <h3>Statystyki</h3>
                <div className="stats-cards">
                  <motion.div
                    className="stat-card"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                  >
                <div className="stat-month">Rok {effectiveYear}</div>
                <div className="stat-row">
                  <span className="stat-label"><StatIconSpent /> Wydano łącznie</span>
                  <span className="stat-value spent">−{aggregated.boughtTotal.toFixed(2)} zł</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label"><StatIconSold /> Sprzedano łącznie</span>
                  <span className="stat-value sold">+{aggregated.soldTotal.toFixed(2)} zł</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label"><StatIconSoldCount /> Pozycje sprzedane</span>
                  <span className="stat-value">{soldCount}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label"><StatIconUnsoldCount /> Pozycje nie sprzedane</span>
                  <span className="stat-value">{unsoldCount}</span>
                </div>
                <div className="stat-row profit-row">
                  <span className="stat-label"><StatIconProfit /> Zysk</span>
                  <span className={`stat-value ${aggregated.profit >= 0 ? 'profit' : 'loss'}`}>
                    {aggregated.profit >= 0 ? '+' : ''}{aggregated.profit.toFixed(2)} zł
                  </span>
                </div>
                <div className="stat-row bilans-row">
                  <span className="stat-label"><StatIconBilans /> Bilans</span>
                  <span className={`stat-value ${bilans >= 0 ? 'profit' : 'loss'}`}>
                    {bilans >= 0 ? '+' : ''}{bilans.toFixed(2)} zł
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.section>
            );
          }
        }
        return statsContent ? <AnimatePresence mode="wait">{statsContent}</AnimatePresence> : null;
      })()}

      {/* Search */}
      <div className="search-box-wrap">
        <svg className="search-box-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          type="search"
          className="search-box-input"
          placeholder="Szukaj po nazwie…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
        />
        {searchQuery && (
          <button type="button" className="search-box-clear" onClick={() => setSearchQuery('')} aria-label="Wyczyść">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* List by month – key by filter so list animates when switching e.g. Dziś ↔ Rok */}
      <section className="entries-by-month">
        <AnimatePresence mode="wait">
          <motion.div
            key={searchActive ? `search-${searchQuery}` : `list-${effectiveYear}-${effectiveMonth ?? 'all'}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ width: '100%' }}
          >
        {months.length === 0 ? (
          <motion.p
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {searchActive ? `Brak wyników dla „${searchQuery}".` : 'Brak pozycji. Dodaj pierwszą z zakładki Dodaj.'}
          </motion.p>
        ) : (
          months.map((monthKey) => (
            <motion.div
              key={monthKey}
              className="month-block"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.03 }}
              layout
            >
              <h4 className="month-heading">{formatMonth(monthKey)}</h4>
              <ul className="entry-list">
                <AnimatePresence mode="popLayout">
                  {byMonth[monthKey].map((entry, idx) => (
                    <motion.li
                      key={entry.id}
                      className={`entry-item${entry.sellPrice == null ? ' entry-item--unsold' : ''}`}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ delay: idx * 0.03 }}
                      layout
                    >
                      <button
                        type="button"
                        className="entry-item-button"
                        onClick={() => onSelectedEntryIdChange(entry.id)}
                      >
                        <div className="entry-main">
                          <span className="entry-date">{formatMonthYear(getBoughtAt(entry))}</span>
                          <span className="entry-name">{entry.name}</span>
                          <div className="entry-meta">
                            <span className="entry-price">
                              <span className="entry-price-part" title="Kupiono">
                                <span className="entry-price-icon" aria-hidden>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                </span>
                                {entry.boughtPrice.toFixed(2)} zł
                              </span>
                              {entry.sellPrice != null ? (
                                <>
                                  <span className="entry-price-part" title="Sprzedano">
                                    <span className="entry-price-icon" aria-hidden>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.5 9.5a2.1 2.1 0 0 0 3 0l7-7a2.1 2.1 0 0 0 0-3L12 2Z"/><path d="M7 7h.01"/></svg>
                                    </span>
                                    {entry.sellPrice.toFixed(2)} zł
                                  </span>
                                  <span
                                    className={`entry-price-part entry-revenue ${entry.sellPrice - entry.boughtPrice < 0 ? 'entry-revenue--loss' : ''}`}
                                    title="Zysk / strata"
                                  >
                                    <span className="entry-price-icon" aria-hidden>
                                      {entry.sellPrice - entry.boughtPrice >= 0 ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 7-8.5 8.5-4-4L2 17"/><path d="M16 7h6v6"/></svg>
                                      ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 17 8.5-8.5 4 4L22 7"/><path d="M8 17H2v-6"/></svg>
                                      )}
                                    </span>
                                    {(entry.sellPrice - entry.boughtPrice) >= 0 ? '+' : ''}
                                    {(entry.sellPrice - entry.boughtPrice).toFixed(2)} zł
                                  </span>
                                </>
                              ) : (
                                <span className="entry-unsold-badge">Nie sprzedano</span>
                              )}
                            </span>
                          </div>
                        </div>
                        <span className="entry-item-chevron" aria-hidden>→</span>
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.div>
          ))
        )}
          </motion.div>
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
