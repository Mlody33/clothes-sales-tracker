import { useState, useEffect, useLayoutEffect, useRef, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchEntries, fetchMonthlyStats, deleteEntry, updateEntry } from './api';
import { EditEntryForm } from './EditEntryForm';
import type { ClothesEntry, MonthlyStat, EntryTag } from './types';

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


function AnimatedListItem({ className, index, children }: { className: string; index: number; children: ReactNode }) {
  const [anim, setAnim] = useState({ visible: false, delay: 0 });
  const ref = useRef<HTMLLIElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnim({ visible: true, delay: index * 0.05 });
    }
  }, [index]);

  useEffect(() => {
    const el = ref.current;
    if (!el || anim.visible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnim({ visible: true, delay: 0 });
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [anim.visible]);

  return (
    <motion.li
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={anim.visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{
        duration: 0.3,
        delay: anim.delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      layout
    >
      {children}
    </motion.li>
  );
}

interface EntryListProps {
  selectedEntryId: string | null;
  onSelectedEntryIdChange: (id: string | null) => void;
  filterYear: number;
  filterMonth: number | null;
  onFilterYearChange: (year: number) => void;
  onFilterMonthChange: (month: number | null) => void;
  justAdded?: boolean;
  lastVisitedEntryId?: string | null;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  showUnsoldOnly: boolean;
  onShowUnsoldOnlyChange: (v: boolean) => void;
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
}

export function EntryList({
  selectedEntryId,
  onSelectedEntryIdChange,
  filterYear,
  filterMonth,
  onFilterYearChange,
  onFilterMonthChange,
  justAdded = false,
  lastVisitedEntryId,
  searchQuery,
  onSearchQueryChange,
  showUnsoldOnly,
  onShowUnsoldOnlyChange,
  selectedTags,
  onSelectedTagsChange,
}: EntryListProps) {
  const [entries, setEntries] = useState<ClothesEntry[]>([]);
  const [stats, setStats] = useState<MonthlyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingEntry, setEditingEntry] = useState<ClothesEntry | null>(null);
  const [todayStatIndex, setTodayStatIndex] = useState(0);
  const [easterEgg, setEasterEgg] = useState<'idle' | 'active' | 'resetting'>('idle');
  const [easterEggCount, setEasterEggCount] = useState(0);

  useEffect(() => {
    if (justAdded) {
      setEasterEgg('active');
      setEasterEggCount(c => c + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (easterEgg === 'active') {
      const t = setTimeout(() => setEasterEgg('resetting'), 850);
      return () => clearTimeout(t);
    }
    if (easterEgg === 'resetting') {
      const t = setTimeout(() => setEasterEgg('idle'), 50);
      return () => clearTimeout(t);
    }
  }, [easterEgg]);

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
      const d = new Date(getBoughtAt(e));
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
        ? [{ key: 'best-month' as const, text: `Najlepszy: ${bestRevenueMonthText}` }]
        : []),
      {
        key: 'worst-revenue',
        text: `Największa strata: ${worstRevenue >= 0 ? '+' : ''}${worstRevenue.toFixed(2)} zł`,
      },
      ...(worstRevenueMonthText
        ? [{ key: 'worst-month' as const, text: `Najgorszy: ${worstRevenueMonthText}` }]
        : []),
    ];
  }, [entries]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTodayStatIndex((i) => (i + 1) % Math.max(1, todayStats.length));
    }, 3500);
    return () => clearInterval(interval);
  }, [todayStats.length]);

  /* Sync editingEntry when selectedEntryId changes (e.g. from parent) so detail view can render */
  useEffect(() => {
    if (!selectedEntryId) {
      setEditingEntry(null);
      return;
    }
    const entry = Array.isArray(entries) ? entries.find((e) => e.id === selectedEntryId) : null;
    if (entry) {
      setEditingEntry((prev) => (prev?.id === selectedEntryId ? prev : entry));
    }
  }, [selectedEntryId, entries]);

  async function handleDelete(id: string) {
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      onSelectedEntryIdChange(null);
      setEditingEntry(null);
      load();
    } catch {
      setError('Nie udało się usunąć');
    }
  }

  async function handleSaveEdit(id: string, fields: {
    name: string;
    boughtMonth: number;
    boughtYear: number;
    boughtPrice: string;
    sellPrice: string;
    vintedUrl: string;
  }) {
    const name = fields.name.trim();
    const boughtPrice = parseFloat(fields.boughtPrice);
    if (!name || isNaN(boughtPrice) || boughtPrice < 0) return;

    const originalEntry = editingEntry;
    const originalSellPrice = originalEntry?.sellPrice != null ? String(originalEntry.sellPrice) : '';
    const sellPriceChanged = fields.sellPrice.trim() !== originalSellPrice;

    let sellPrice: number | null | undefined = undefined; // undefined = don't send to server
    if (sellPriceChanged) {
      if (fields.sellPrice.trim() !== '') {
        const v = parseFloat(fields.sellPrice);
        if (isNaN(v) || v < 0) return;
        sellPrice = v;
      } else {
        sellPrice = null;
      }
    }

    try {
      const updated = await updateEntry(id, {
        name,
        boughtPrice,
        boughtAt: new Date(fields.boughtYear, fields.boughtMonth - 1, 1, 12, 0, 0, 0).toISOString(),
        ...(sellPriceChanged ? { sellPrice } : {}),
        vintedUrl: fields.vintedUrl.trim() || null,
      });
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingEntry(null);
      onSelectedEntryIdChange(null);
      setEasterEgg('active');
      setEasterEggCount(c => c + 1);
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
        <h2 className="screen-title"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'inline-block', verticalAlign: '-0.15em', marginRight: 8 }}><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>Moja Szafa</h2>
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
        <h2 className="screen-title"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'inline-block', verticalAlign: '-0.15em', marginRight: 8 }}><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>Moja Szafa</h2>
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
  const periodEntries = safeEntries.filter((e) => {
    const d = new Date(getBoughtAt(e));
    if (d.getFullYear() !== effectiveYear) return false;
    if (effectiveMonth != null && d.getMonth() + 1 !== effectiveMonth) return false;
    return true;
  });
  const filteredEntries = (searchActive
    ? periodEntries.filter((e) => normalize(e.name).includes(normalize(searchQuery.trim())))
    : periodEntries
  )
    .filter((e) => !showUnsoldOnly || e.sellPrice == null)
    .filter((e) => selectedTags.length === 0 || selectedTags.every((t) => e.tags?.some((tag) => tag.value === t)));

  const allTagsMap = new Map<string, EntryTag>();
  for (const e of safeEntries) {
    for (const tag of (e.tags ?? [])) {
      if (!allTagsMap.has(tag.value)) allTagsMap.set(tag.value, tag);
    }
  }
  const seenTags = new Map<string, EntryTag>();
  for (const e of periodEntries) {
    for (const tag of (e.tags ?? [])) {
      if (!seenTags.has(tag.value)) seenTags.set(tag.value, tag);
    }
  }
  for (const value of selectedTags) {
    if (!seenTags.has(value) && allTagsMap.has(value)) {
      seenTags.set(value, allTagsMap.get(value)!);
    }
  }
  const availableTags = [
    ...[...seenTags.values()].filter((t) => t.type === 'size').sort((a, b) => a.value.localeCompare(b.value)),
    ...[...seenTags.values()].filter((t) => t.type === 'source').sort((a, b) => a.value.localeCompare(b.value)),
  ];

  const byMonth = groupEntriesByMonth(filteredEntries);
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));
  const selectedEntry = selectedEntryId ? safeEntries.find((e) => e.id === selectedEntryId) : null;
  /* Detail view when an entry is selected */
  if (selectedEntryId && selectedEntry && editingEntry) {
    const { month, year } = isoToMonthYear(getBoughtAt(editingEntry));
    return (
      <EditEntryForm
        entry={editingEntry}
        initialName={editingEntry.name}
        initialBoughtMonth={month}
        initialBoughtYear={year}
        initialBoughtPrice={String(editingEntry.boughtPrice)}
        initialSellPrice={editingEntry.sellPrice != null ? String(editingEntry.sellPrice) : ''}
        initialVintedUrl={editingEntry.vintedUrl ?? ''}
        onSave={(fields) => handleSaveEdit(editingEntry.id, fields)}
        onDelete={handleDelete}
        onBack={() => {
          onSelectedEntryIdChange(null);
          setEditingEntry(null);
        }}
      />
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
        <h2 className="screen-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <motion.span
              animate={
                easterEgg === 'active'   ? { rotate: [0, -25, 25, -15, 720], scale: [1, 1.4, 1.4, 1.6, 1] } :
                easterEgg === 'resetting'? { rotate: 0, scale: 1 } :
                                           { rotate: [0, 10, 0, -10, 0] }
              }
              transition={
                easterEgg === 'active'    ? { duration: 0.85, ease: [0.36, 0.07, 0.19, 0.97], times: [0, 0.2, 0.4, 0.6, 1] } :
                easterEgg === 'resetting' ? { duration: 0 } :
                                            { duration: 2.8, repeat: Infinity, ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'], times: [0, 0.25, 0.5, 0.75, 1] }
              }
              style={{ display: 'inline-flex', transformOrigin: '50% 0%', cursor: 'pointer', willChange: 'transform' }}
              onClick={() => {
                if (easterEgg !== 'idle') return;
                setEasterEgg('active');
                setEasterEggCount(c => c + 1);
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>
            </motion.span>
            <AnimatePresence>
              {easterEgg === 'active' && ['👕','👗','👔','👖','🧥','👟','🧣'].map((emoji, i) => {
                const angle = (i / 7) * 2 * Math.PI;
                const dist = 48 + Math.random() * 20;
                return (
                  <motion.span
                    key={`${easterEggCount}-${i}`}
                    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', fontSize: 14, lineHeight: 1 }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                    animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 1.2, rotate: (i % 2 === 0 ? 1 : -1) * 180 }}
                    exit={{}}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.04 }}
                  >
                    {emoji}
                  </motion.span>
                );
              })}
            </AnimatePresence>
          </span>
          Moja Szafa
        </h2>
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

      {/* Period filter */}
      {(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const isTodaySelected = filterYear === currentYear && filterMonth === currentMonth;

        const currentValue = effectiveMonth != null
          ? `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}`
          : `${effectiveYear}`;

        return (
          <div className="list-filter">
            <select
              className="list-filter-select list-filter-period"
              value={currentValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v.includes('-')) {
                  const [y, m] = v.split('-');
                  onFilterYearChange(Number(y));
                  onFilterMonthChange(Number(m));
                } else {
                  onFilterYearChange(Number(v));
                  onFilterMonthChange(null);
                }
              }}
            >
              {availableYears.map((y) => {
                const months = [...new Set(
                  stats.filter((s) => s.month.startsWith(String(y))).map((s) => parseInt(s.month.split('-')[1], 10))
                )].sort((a, b) => a - b);
                return (
                  <optgroup key={y} label={String(y)}>
                    <option value={`${y}`}>Cały rok</option>
                    {months.map((m) => (
                      <option key={m} value={`${y}-${String(m).padStart(2, '0')}`}>{MONTH_NAMES[m - 1]}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <motion.button
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
              whileTap={{ scale: 0.92 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isTodaySelected ? 'icon-year' : 'icon-month'}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{ display: 'inline-flex', marginRight: 6, flexShrink: 0 }}
                >
                  {isTodaySelected
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><line x1="8" x2="8" y1="14" y2="14"/></svg>
                  }
                </motion.span>
              </AnimatePresence>
              <span className="list-filter-today-label">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isTodaySelected ? 'year' : 'month'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                    style={{ display: 'inline-block' }}
                  >
                    {isTodaySelected ? 'Ten rok' : 'Ten miesiąc'}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.button>
          </div>
        );
      })()}

      {/* Search + unsold filter */}
      {/* Search – full width */}
      <div className="search-row">
        <div className="search-box-wrap">
          <svg className="search-box-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="search"
            className="search-box-input"
            placeholder="Szukaj po nazwie…"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            autoComplete="off"
          />
          {searchQuery && (
            <button type="button" className="search-box-clear" onClick={() => onSearchQueryChange('')} aria-label="Wyczyść">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter chips row: unsold toggle + tag chips */}
      <div className="tag-filter-row" style={{ marginBottom: 14 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.button
            key="unsold"
            layout
            type="button"
            className={`tag-chip tag-chip--unsold${showUnsoldOnly ? ' tag-chip--unsold-active' : ''}`}
            onClick={() => onShowUnsoldOnlyChange(!showUnsoldOnly)}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileTap={{ scale: 0.92 }}
          >
            Nie sprzedane
          </motion.button>
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag.value);
            return (
              <motion.button
                key={tag.value}
                layout
                type="button"
                className={`tag-chip tag-chip--${tag.type}${active ? ' tag-chip--active' : ''}`}
                onClick={() =>
                  onSelectedTagsChange(
                    active ? selectedTags.filter((v) => v !== tag.value) : [...selectedTags, tag.value]
                  )
                }
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                whileTap={{ scale: 0.92 }}
              >
                {tag.value}
              </motion.button>
            );
          })}
          {(selectedTags.length > 0 || showUnsoldOnly) && (
            <motion.button
              key="clear"
              layout
              type="button"
              className="tag-chip-clear"
              onClick={() => { onSelectedTagsChange([]); onShowUnsoldOnlyChange(false); }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              ✕ wyczyść
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Stats: one card for selected month or aggregated for whole year */}
      <AnimatePresence>
      {!searchActive && stats.length > 0 && (() => {
        const soldCount = periodEntries.filter((e) => e.sellPrice != null).length;
        const unsoldCount = periodEntries.filter((e) => e.sellPrice == null).length;
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
        return statsContent
          ? (
            <motion.div
              key="stats-card"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ overflow: 'hidden' }}
            >
              <AnimatePresence mode="wait">{statsContent}</AnimatePresence>
            </motion.div>
          )
          : null;
      })()}
      </AnimatePresence>

      {/* List by month – key by filter so list animates when switching e.g. Dziś ↔ Rok */}
      <section className="entries-by-month">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={searchActive ? `search-${searchQuery.trim()}` : `list-${effectiveYear}-${effectiveMonth ?? 'all'}`}
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
            {searchActive
  ? `Brak wyników dla „${searchQuery}".`
  : showUnsoldOnly
    ? 'Filtr "Nie sprzedane" jest aktywny. Wszystkie pozycje w tym okresie zostały sprzedane!'
    : 'Brak pozycji.'}
          </motion.p>
        ) : (
          months.map((monthKey) => (
            <motion.div
              key={monthKey}
              className="month-block"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.03 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.h4
                  key={`${monthKey}-${showUnsoldOnly}`}
                  className="month-heading"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6, opacity: 0.6 }}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  {formatMonth(monthKey)}
                </motion.h4>
              </AnimatePresence>
              <ul className="entry-list">
                <AnimatePresence mode="popLayout">
                  {byMonth[monthKey].map((entry, idx) => (
                    <AnimatedListItem
                      key={entry.id}
                      className={`entry-item${entry.sellPrice == null ? ' entry-item--unsold' : ''}`}
                      index={idx}
                    >
                      <button
                        type="button"
                        className="entry-item-button"
                        onClick={() => { onSelectedEntryIdChange(entry.id); setEditingEntry(entry); }}
                      >
                        <div className="entry-main">
                          <span className="entry-date">
                            <span className="entry-date-text">{formatMonthYear(getBoughtAt(entry))}</span>
                            {entry.sellPrice == null && (
                              <span className="entry-tag entry-tag--unsold">Nie sprzedano</span>
                            )}
                            {entry.tags && entry.tags.length > 0 && entry.tags.map((tag) => (
                              <span key={tag.value} className={`entry-tag entry-tag--${tag.type}`}>{tag.value}</span>
                            ))}
                          </span>
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
                              ) : null}
                            </span>
                          </div>
                        </div>
                        {lastVisitedEntryId === entry.id ? (
                          <span className="entry-item-chevron entry-item-chevron--visited" aria-label="Ostatnio przeglądane">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                          </span>
                        ) : (
                          <span className="entry-item-chevron" aria-hidden>→</span>
                        )}
                      </button>
                    </AnimatedListItem>
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
