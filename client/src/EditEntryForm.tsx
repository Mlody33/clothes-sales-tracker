import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { ClothesEntry } from './types';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
}

const iconProps = { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { display: 'inline-block', verticalAlign: '-0.1em', marginRight: 4, opacity: 0.6 } };

function IconCalendar() {
  return <svg {...iconProps}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>;
}

function IconWallet() {
  return <svg {...iconProps}><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V9"/></svg>;
}

function IconTag() {
  return <svg {...iconProps}><path d="M12 2H2v10l9.5 9.5a2.1 2.1 0 0 0 3 0l7-7a2.1 2.1 0 0 0 0-3L12 2Z"/><path d="M7 7h.01"/></svg>;
}

export interface EditEntryFormProps {
  entry: ClothesEntry;
  initialName: string;
  initialBoughtMonth: number;
  initialBoughtYear: number;
  initialBoughtPrice: string;
  initialSellPrice: string;
  initialVintedUrl: string;
  onSave: (fields: {
    name: string;
    boughtMonth: number;
    boughtYear: number;
    boughtPrice: string;
    sellPrice: string;
    vintedUrl: string;
  }) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export function EditEntryForm({
  entry,
  initialName,
  initialBoughtMonth,
  initialBoughtYear,
  initialBoughtPrice,
  initialSellPrice,
  initialVintedUrl,
  onSave,
  onDelete,
  onBack,
}: EditEntryFormProps) {
  const [name, setName] = useState(initialName);
  const [boughtMonth, setBoughtMonth] = useState(initialBoughtMonth);
  const [boughtYear, setBoughtYear] = useState(initialBoughtYear);
  const [boughtPrice, setBoughtPrice] = useState(initialBoughtPrice);
  const [sellPrice, setSellPrice] = useState(initialSellPrice);
  const vintedUrl = initialVintedUrl;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasChanges =
    name !== initialName ||
    boughtMonth !== initialBoughtMonth ||
    boughtYear !== initialBoughtYear ||
    boughtPrice !== initialBoughtPrice ||
    sellPrice !== initialSellPrice;

  return (
    <motion.div
      className="list-screen entry-detail-screen"
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="entry-detail-content">
        <div className="entry-edit-form vertical">
          <label className="label">
            <span>Nazwa ubrania</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
                value={boughtMonth}
                onChange={(e) => setBoughtMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((n, i) => (
                  <option key={i} value={i + 1}>{n}</option>
                ))}
              </select>
              <select
                className="input month-year-select"
                value={boughtYear}
                onChange={(e) => setBoughtYear(Number(e.target.value))}
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
              value={boughtPrice}
              onChange={(e) => setBoughtPrice(e.target.value)}
              placeholder="0.00"
              className="input"
              inputMode="decimal"
            />
          </label>
          <label className="label">
            <span>Cena sprzedaży (zł) <em>opcjonalnie</em></span>
            <div className="input-with-action">
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="Zostaw puste, jeśli nie sprzedane"
                className="input"
                inputMode="decimal"
              />
              {sellPrice !== '' && (
                <button
                  type="button"
                  className="input-action-btn"
                  onClick={() => setSellPrice('')}
                  aria-label="Wyczyść cenę sprzedaży"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </label>

          <dl className="entry-dates-info">
            <div className="entry-dates-row">
              <dt><IconCalendar />Dodano</dt>
              <dd>{formatDate(entry.createdAt)}</dd>
            </div>
            {entry.boughtAt && (
              <div className="entry-dates-row">
                <dt><IconWallet />Kupiono</dt>
                <dd>{formatMonthYear(entry.boughtAt)}</dd>
              </div>
            )}
            {entry.soldAt && (
              <div className="entry-dates-row">
                <dt><IconTag />Sprzedano</dt>
                <dd>{formatDate(entry.soldAt)}</dd>
              </div>
            )}
          </dl>

          <div className="entry-detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onSave({ name, boughtMonth, boughtYear, boughtPrice, sellPrice, vintedUrl })}
              disabled={!hasChanges}
            >
              <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
              Zapisz
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => setConfirmDelete(true)}
            >
              <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
              Usuń
            </button>
            <button
              type="button"
              className="btn back-to-list-button"
              onClick={onBack}
            >
              <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Powrót do listy
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && createPortal(
        <AnimatePresence>
          <motion.div
            key="confirm-overlay"
            className="confirm-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setConfirmDelete(false)}
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
                  onClick={() => onDelete(entry.id)}
                >
                  <svg className="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                  Usuń
                </button>
                <button
                  type="button"
                  className="btn back-to-list-button"
                  onClick={() => setConfirmDelete(false)}
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
