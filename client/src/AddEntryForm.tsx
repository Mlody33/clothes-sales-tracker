import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addEntry, fetchPriceSuggestions, fetchCommonSizes } from './api';


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
  const [name, setName] = useState('');
  const [boughtPrice, setBoughtPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [priceSuggestions, setPriceSuggestions] = useState<number[]>([]);
  const [sizeSuggestions, setSizeSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetchPriceSuggestions().then(setPriceSuggestions).catch(() => {});
    fetchCommonSizes().then(setSizeSuggestions).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError('');
    setSuccess(false);
    const bp = parseFloat(boughtPrice);
    if (!name.trim() || isNaN(bp) || bp < 0) {
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
      });
      setSuccess(true);
      setSubmitted(false);
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
      <motion.form
        onSubmit={handleSubmit}
        className="form"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <label className="label">
          <span>Nazwa ubrania</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Stara kurtka dżinsowa"
            autoComplete="off"
            className={`input${submitted && !name.trim() ? ' input--error' : ''}`}
          />
          <AnimatePresence>
            {submitted && !name.trim() && (
              <motion.span
                className="input-error-hint"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                Nazwa jest wymagana
              </motion.span>
            )}
          </AnimatePresence>
          {sizeSuggestions.length > 0 && (
            <div className="price-suggestions">
              {sizeSuggestions.map((size) => {
                const active = new RegExp(`roz\\.\\s*${size}\\b`, 'i').test(name);
                return (
                  <button
                    key={size}
                    type="button"
                    className={`price-chip${active ? ' price-chip--active' : ''}`}
                    onClick={() =>
                      setName((prev) =>
                        active
                          ? prev.replace(new RegExp(`\\s*roz\\.\\s*${size}\\b`, 'i'), '').trim()
                          : `${prev.trim()} roz. ${size}`.trim()
                      )
                    }
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          )}
        </label>
        <label className="label">
          <span>Cena zakupu (zł)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={boughtPrice}
            onChange={(e) => setBoughtPrice(e.target.value)}
            placeholder="0.00"
            className={`input${submitted && (boughtPrice === '' || isNaN(parseFloat(boughtPrice)) || parseFloat(boughtPrice) < 0) ? ' input--error' : ''}`}
            inputMode="decimal"
          />
          <AnimatePresence>
            {submitted && boughtPrice === '' && (
              <motion.span
                key="empty"
                className="input-error-hint"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                Cena zakupu jest wymagana
              </motion.span>
            )}
            {submitted && boughtPrice !== '' && (isNaN(parseFloat(boughtPrice)) || parseFloat(boughtPrice) < 0) && (
              <motion.span
                key="invalid"
                className="input-error-hint"
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                Podaj prawidłową cenę (liczba ≥ 0)
              </motion.span>
            )}
          </AnimatePresence>
          {priceSuggestions.length > 0 && (
            <div className="price-suggestions">
              {priceSuggestions.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`price-chip${boughtPrice === String(p) ? ' price-chip--active' : ''}`}
                  onClick={() => setBoughtPrice(String(p))}
                >
                  {p} zł
                </button>
              ))}
            </div>
          )}
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
          whileTap={{ scale: 0.92 }}
        >
          {!loading && (
            <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
          {loading ? 'Dodawanie…' : 'Dodaj wpis'}
        </motion.button>
        {onBack && (
          <motion.button
            type="button"
            className="btn back-to-list-button"
            onClick={onBack}
            whileTap={{ scale: 0.92 }}
          >
            <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Powrót do listy
          </motion.button>
        )}
      </motion.form>
    </motion.div>
  );
}
