import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

const CATEGORIES = [
  { key: "food", label: "Food" },
  { key: "rent", label: "Rent" },
  { key: "utilities", label: "Utilities" },
  { key: "auto", label: "Auto" },
  { key: "auto_insurance", label: "Auto Insurance" },
  { key: "wife", label: "Wife" },
  { key: "bad_habits", label: "Bad Habits" },
];

const CAT_COLOR = {
  food: "#2E6F4E",
  rent: "#7C6A2E",
  utilities: "#A9822C",
  auto: "#3D5A73",
  auto_insurance: "#5C8AA6",
  wife: "#6B4E71",
  bad_habits: "#A6342A",
};

// Same-origin call: the Static Web App proxies /api/* to the linked Function App.
const API_BASE = "/api";

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div
      className="px-2.5 py-1.5 text-xs"
      style={{ fontFamily: "'IBM Plex Mono', monospace", backgroundColor: "#16211B", color: "#EEF0E6" }}
    >
      {p.payload.label}: ${money(p.value)}
    </div>
  );
}

export default function LedgerApp() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(CATEGORIES[0].key);
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/entries`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load entries (${r.status})`);
        return r.json();
      })
      .then((data) => setEntries(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);

  const chartData = useMemo(() => {
    const map = {};
    for (const c of CATEGORIES) map[c.key] = 0;
    for (const e of entries) map[e.category] = (map[e.category] || 0) + e.amount;
    return CATEGORIES.map((c) => ({ key: c.key, label: c.label, amount: map[c.key] })).filter(
      (c) => c.amount > 0
    );
  }, [entries]);

  const addEntry = async () => {
    const amt = parseFloat(amount);
    if (!amt) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, category }),
      });
      if (!res.ok) throw new Error(`Failed to add entry (${res.status})`);
      const created = await res.json();
      setEntries([created, ...entries]);
      setAmount("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeEntry = async (id) => {
    const prev = entries;
    setEntries(entries.filter((e) => e.id !== id)); // optimistic
    try {
      const res = await fetch(`${API_BASE}/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to remove entry (${res.status})`);
    } catch (err) {
      setEntries(prev); // roll back on failure
      setError(err.message);
    }
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditAmount(String(e.amount));
    setEditCategory(e.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
  };

  const saveEdit = async (id) => {
    const amt = parseFloat(editAmount);
    if (!amt) return;
    setEditSubmitting(true);
    setError(null);
    const prev = entries;
    // optimistic update
    setEntries(entries.map((e) => (e.id === id ? { ...e, amount: amt, category: editCategory } : e)));
    try {
      const res = await fetch(`${API_BASE}/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, category: editCategory }),
      });
      if (!res.ok) throw new Error(`Failed to update entry (${res.status})`);
      setEditingId(null);
    } catch (err) {
      setEntries(prev); // roll back on failure
      setError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const catLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;

  return (
    <div className="w-full min-h-full flex items-start justify-center p-6" style={{ backgroundColor: "#EEF0E6" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');
        input::placeholder { color: #9A9E8C; }
      `}</style>

      <div className="w-full max-w-md" style={{ backgroundColor: "#F6F7EF", border: "1px solid #C7CBB9" }}>
        <div className="px-6 pt-6 pb-5 sticky top-0" style={{ borderBottom: "2px solid #16211B", backgroundColor: "#F6F7EF" }}>
          <div className="text-xs uppercase tracking-wide" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "#6B6F5E", letterSpacing: "0.06em" }}>
            Total spent
          </div>
          <div className="text-4xl tabular-nums mt-1" style={{ fontFamily: "'Zilla Slab', serif", fontWeight: 600, color: "#A6342A" }}>
            {loading ? "…" : `$${money(total)}`}
          </div>
          {error && (
            <div className="text-xs mt-2" style={{ color: "#A6342A", fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-5" style={{ borderBottom: "1px solid #D8DBC9" }}>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEntry()}
              placeholder="0.00"
              inputMode="decimal"
              className="w-24 px-2 py-2 text-sm text-right bg-transparent outline-none border-b tabular-nums"
              style={{ fontFamily: "'IBM Plex Mono', monospace", borderColor: "#B7BBA9", color: "#16211B" }}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex-1 px-2 py-2 text-sm bg-transparent outline-none border-b"
              style={{ fontFamily: "'IBM Plex Sans', sans-serif", borderColor: "#B7BBA9", color: "#16211B" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <button
              onClick={addEntry}
              disabled={submitting}
              className="px-4 py-2 text-xs shrink-0"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#EEF0E6", backgroundColor: "#2E6F4E", opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "…" : "Add"}
            </button>
          </div>
        </div>

        <div className="px-6 py-5" style={{ borderBottom: "1px solid #D8DBC9" }}>
          <div className="text-xs uppercase tracking-wide mb-3" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "#6B6F5E", letterSpacing: "0.06em" }}>
            Where it went
          </div>
          {chartData.length === 0 ? (
            <div className="text-xs italic" style={{ color: "#9A9E8C" }}>
              {loading ? "Loading…" : "Add an entry to see the chart."}
            </div>
          ) : (
            <BarChart width={340} height={Math.max(120, chartData.length * 40)} data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#D8DBC9" />
              <XAxis type="number" tick={{ fontFamily: "IBM Plex Mono", fontSize: 11, fill: "#6B6F5E" }} axisLine={{ stroke: "#C7CBB9" }} tickLine={false} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontFamily: "IBM Plex Sans", fontSize: 11, fill: "#16211B" }} axisLine={{ stroke: "#C7CBB9" }} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#E2E4D5" }} />
              <Bar dataKey="amount" radius={[0, 2, 2, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={CAT_COLOR[entry.key]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </div>

        <div className="px-6 py-5">
          <div className="text-xs uppercase tracking-wide mb-2" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "#6B6F5E", letterSpacing: "0.06em" }}>
            Entries
          </div>
          {entries.length === 0 && (
            <div className="text-xs italic" style={{ color: "#9A9E8C" }}>
              {loading ? "Loading…" : "Nothing logged yet."}
            </div>
          )}
          {entries.map((e) =>
            editingId === e.id ? (
              <div key={e.id} className="flex items-center gap-2 py-1.5">
                <input
                  value={editAmount}
                  onChange={(ev) => setEditAmount(ev.target.value)}
                  onKeyDown={(ev) => ev.key === "Enter" && saveEdit(e.id)}
                  inputMode="decimal"
                  className="w-20 px-1 py-1 text-sm text-right bg-transparent outline-none border-b tabular-nums"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", borderColor: "#B7BBA9", color: "#16211B" }}
                />
                <select
                  value={editCategory}
                  onChange={(ev) => setEditCategory(ev.target.value)}
                  className="flex-1 px-1 py-1 text-sm bg-transparent outline-none border-b"
                  style={{ fontFamily: "'IBM Plex Sans', sans-serif", borderColor: "#B7BBA9", color: "#16211B" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => saveEdit(e.id)}
                  disabled={editSubmitting}
                  className="text-xs shrink-0"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#2E6F4E", opacity: editSubmitting ? 0.6 : 1 }}
                  aria-label="Save edit"
                >
                  {editSubmitting ? "…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-xs shrink-0"
                  style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6B6F5E" }}
                  aria-label="Cancel edit"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div key={e.id} className="flex items-baseline py-1.5 group">
                <span className="w-2 h-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: CAT_COLOR[e.category] }} />
                <span className="text-sm truncate" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "#16211B" }}>
                  {catLabel(e.category)}
                </span>
                <span className="flex-1 mx-2 border-b" style={{ borderBottomStyle: "dotted", borderColor: "#B7BBA9", transform: "translateY(-4px)" }} />
                <span className="text-sm tabular-nums whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace", color: e.amount < 0 ? "#2E6F4E" : "#16211B" }}>
                  {e.amount < 0 ? "+" : ""}${money(Math.abs(e.amount))}
                </span>
                <button
                  onClick={() => startEdit(e)}
                  className="ml-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "#6B6F5E", fontFamily: "'IBM Plex Mono', monospace" }}
                  aria-label="Edit entry"
                >
                  ✎
                </button>
                <button
                  onClick={() => removeEntry(e.id)}
                  className="ml-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "#A6342A", fontFamily: "'IBM Plex Mono', monospace" }}
                  aria-label="Remove entry"
                >
                  ✕
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
