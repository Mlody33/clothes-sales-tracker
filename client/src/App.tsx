import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AddEntryForm } from './AddEntryForm';
import { EntryList } from './EntryList';
import './App.css';

type Tab = 'add' | 'list';

const now = new Date();
export default function App() {
  const [tab, setTab] = useState<Tab>('list');
  const [listKey, setListKey] = useState(0);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [addFormBoughtMonth, setAddFormBoughtMonth] = useState(now.getMonth() + 1);
  const [addFormBoughtYear, setAddFormBoughtYear] = useState(now.getFullYear());
  const mainRef = useRef<HTMLElement>(null);
  const listScrollTopRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [tab]);

  /* After switching to add, reset scroll again once layout has settled (avoids leftover scroll height) */
  useLayoutEffect(() => {
    if (tab !== 'add') return;
    const el = mainRef.current;
    if (!el) return;
    el.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = 0;
    });
    const t = setTimeout(() => {
      el.scrollTop = 0;
    }, 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [tab]);

  function handleSelectedEntryIdChange(id: string | null) {
    if (id != null && mainRef.current) {
      listScrollTopRef.current = mainRef.current.scrollTop;
    } else if (id == null) {
      shouldRestoreScrollRef.current = true;
    }
    setSelectedEntryId(id);
  }

  function handleMainScroll() {
    if (mainRef.current && selectedEntryId == null) {
      listScrollTopRef.current = mainRef.current.scrollTop;
    }
  }

  useEffect(() => {
    if (selectedEntryId) {
      mainRef.current?.scrollTo(0, 0);
    }
  }, [selectedEntryId]);

  useLayoutEffect(() => {
    if (selectedEntryId == null && shouldRestoreScrollRef.current && mainRef.current) {
      shouldRestoreScrollRef.current = false;
      const saved = listScrollTopRef.current;
      const el = mainRef.current;
      const restore = () => {
        if (el && saved > 0) {
          el.scrollTop = saved;
        }
      };
      restore();
      const t1 = setTimeout(restore, 100);
      const t2 = setTimeout(restore, 350);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [selectedEntryId]);

  function handleEntryAdded() {
    setListKey((k) => k + 1);
    setTab('list');
  }

  return (
    <div className="app">
      <main
        ref={mainRef}
        className={`main${selectedEntryId ? ' main-detail-open' : ''}${tab === 'add' ? ' main-add-open' : ''}${tab === 'list' && !selectedEntryId ? ' main-list-view' : ''}`}
        onScroll={handleMainScroll}
      >
        <div className="pages-stack" key={tab}>
          <AnimatePresence mode="sync">
            {tab === 'add' ? (
              <motion.div
                key="add"
                data-view="add"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, pointerEvents: 'none' }}
                transition={{ duration: 0.2 }}
                className="page"
              >
                <AddEntryForm
                  boughtMonth={addFormBoughtMonth}
                  boughtYear={addFormBoughtYear}
                  onBoughtMonthChange={setAddFormBoughtMonth}
                  onBoughtYearChange={setAddFormBoughtYear}
                  onAdded={handleEntryAdded}
                  onBack={() => setTab('list')}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`list-${listKey}`}
                data-view="list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, pointerEvents: 'none' }}
                transition={{ duration: 0.2 }}
                className="page"
              >
                <EntryList
                  selectedEntryId={selectedEntryId}
                  onSelectedEntryIdChange={handleSelectedEntryIdChange}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <AnimatePresence>
        {tab === 'list' && (
          <motion.button
            type="button"
            className="fab"
            onClick={() => {
            setTab('add');
            setSelectedEntryId(null);
          }}
          aria-label="Dodaj pozycję"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
            <span className="fab-icon" aria-hidden>＋</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
