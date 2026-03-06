import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addEntry, fetchVintedItem, type VintedItem } from './api';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

interface AddEntryFormProps {
  boughtMonth: number;
  boughtYear: number;
  onBoughtMonthChange: (month: number) => void;
  onBoughtYearChange: (year: number) => void;
  onAdded: () => void;
  onBack?: () => void;
}

export function AddEntryForm({
  boughtMonth,
  boughtYear,
  onBoughtMonthChange,
  onBoughtYearChange,
  onAdded,
  onBack,
}: AddEntryFormProps) {
  const vintedInputRef = useRef<HTMLInputElement>(null);
  const [vintedUrl, setVintedUrl] = useState('');
  const [vintedLoading, setVintedLoading] = useState(false);
  const [vintedError, setVintedError] = useState('');
  const [vintedItem, setVintedItem] = useState<VintedItem | null>(null);
  const [name, setName] = useState('');
  const [boughtPrice, setBoughtPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleVintedUrl(url: string) {
    const trimmed = url.trim();
    setVintedUrl(trimmed);
    setVintedError('');
    setVintedItem(null);
    if (!trimmed || !/^https:\/\/www\.vinted\./i.test(trimmed)) return;
    setVintedLoading(true);
    try {
      const item = await fetchVintedItem(trimmed);
      setVintedItem(item);
      if (item.title) setName(item.title);
      if (item.isSold && item.price != null) setSellPrice(String(item.price));
      if (item.date) {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          onBoughtMonthChange(d.getUTCMonth() + 1);
          onBoughtYearChange(d.getUTCFullYear());
        }
      }
    } catch (err) {
      setVintedError(err instanceof Error ? err.message : 'Błąd pobierania danych');
    } finally {
      setVintedLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    const bp = parseFloat(boughtPrice);
    if (!name.trim() || isNaN(bp) || bp < 0) {
      setError('Wprowadź nazwę i prawidłową cenę zakupu.');
      return;
    }
    setLoading(true);
    try {
      const boughtDate = `${boughtYear}-${String(boughtMonth).padStart(2, '0')}-01`;
      await addEntry({
        name: name.trim(),
        boughtPrice: bp,
        boughtDate,
        sellPrice: sellPrice === '' ? '' : parseFloat(sellPrice) || undefined,
        vintedUrl: vintedUrl.trim() || undefined,
      });
      setSuccess(true);
      setName('');
      setBoughtPrice('');
      setSellPrice('');
      onAdded();
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coś poszło nie tak');
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="add-form"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="screen-title">Dodaj pozycję</h2>
      <motion.form
        onSubmit={handleSubmit}
        className="form"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <label className="label">
          <span>Link Vinted <em>opcjonalnie – uzupełni nazwę</em></span>
          <div className="input-with-action">
            <input
              ref={vintedInputRef}
              type="url"
              value={vintedUrl}
              onChange={(e) => handleVintedUrl(e.target.value)}
              placeholder="https://www.vinted.pl/items/..."
              autoComplete="off"
              className="input"
              autoFocus
            />
            <button
              type="button"
              className="input-action-btn"
              onClick={() => {
                const el = vintedInputRef.current;
                if (!el) return;
                el.focus();
                document.execCommand('paste');
              }}
              aria-label="Wklej"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
            </button>
          </div>
          {vintedLoading && (
            <span className="vinted-status">Pobieranie danych…</span>
          )}
          {vintedError && (
            <span className="vinted-status vinted-status--error">{vintedError}</span>
          )}
          {vintedItem && !vintedLoading && (
            <span className="vinted-status">
              {[
                vintedItem.title,
                vintedItem.date,
                vintedItem.isSold ? 'sprzedane' : null,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
        </label>
        <label className="label">
          <span>Nazwa ubrania</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Stara kurtka dżinsowa"
            autoComplete="off"
            className="input"
          />
        </label>
        <label className="label">
          <span>Miesiąc i rok zakupu</span>
          <div className="month-year-inputs">
            <select
              className="input month-year-select"
              value={boughtMonth}
              onChange={(e) => onBoughtMonthChange(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              className="input month-year-select"
              value={boughtYear}
              onChange={(e) => onBoughtYearChange(Number(e.target.value))}
            >
              {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </label>
        <AnimatePresence>
          {(boughtMonth !== new Date().getMonth() + 1 || boughtYear !== new Date().getFullYear()) && (
            <motion.p
              className="message warning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <span>Wybrana data jest inna niż bieżąca.</span>
              <button
                type="button"
                className="message-warning-action"
                onClick={() => {
                  const d = new Date();
                  onBoughtMonthChange(d.getMonth() + 1);
                  onBoughtYearChange(d.getFullYear());
                }}
              >
                Dzisiaj
              </button>
            </motion.p>
          )}
        </AnimatePresence>
        <label className="label">
          <span>Cena zakupu (zł)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={boughtPrice}
            onChange={(e) => setBoughtPrice(e.target.value)}
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
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            placeholder="Zostaw puste, jeśli jeszcze nie sprzedane"
            className="input"
            inputMode="decimal"
          />
        </label>
        {error && (
          <motion.p
            className="message error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {error}
          </motion.p>
        )}
        {success && (
          <motion.p
            className="message success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            Pozycja dodana pomyślnie.
          </motion.p>
        )}
        <motion.button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          whileTap={{ scale: 0.98 }}
          whileHover={{ scale: 1.02 }}
        >
          {!loading && (
            <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
          {loading ? 'Dodawanie…' : 'Dodaj wpis'}
        </motion.button>
        {onBack && (
          <button
            type="button"
            className="btn back-to-list-button"
            onClick={onBack}
          >
            <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Powrót do listy
          </button>
        )}
      </motion.form>
    </motion.div>
  );
}
