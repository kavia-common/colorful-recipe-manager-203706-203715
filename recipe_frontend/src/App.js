import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import { getApiBaseUrl } from './apiConfig';

const DEFAULT_COLORS = ['#3b82f6', '#06b6d4', '#a855f7', '#f59e0b', '#ef4444', '#10b981'];

const THEME_STORAGE_KEY = 'crm.theme';

/** Parse textarea lines into a list, dropping empty lines. */
function linesToList(text) {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Convert list into textarea lines. */
function listToLines(list) {
  return (list || []).join('\n');
}

/** Validate hex color. */
function isValidHexColor(value) {
  return /^#([A-Fa-f0-9]{6})$/.test(value);
}

/** Resolve initial theme, preferring persisted choice and falling back to OS preference. */
function getInitialTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (e) {
    // Ignore localStorage read errors (e.g., disabled storage).
  }

  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return prefersDark ? 'dark' : 'light';
}

// PUBLIC_INTERFACE
function App() {
  const API_BASE = useMemo(() => getApiBaseUrl(), []);
  const [recipes, setRecipes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [mode, setMode] = useState('create'); // create | edit
  const [editingId, setEditingId] = useState(null);

  const [theme, setTheme] = useState(getInitialTheme);

  // Form state (kept simple)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[0]);

  useEffect(() => {
    // Theme is applied via CSS variables; we set it on :root for easy styling.
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      // Ignore localStorage write errors.
    }
  }, [theme]);

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });

    // FastAPI returns JSON error bodies for HTTPException
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const body = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const detail = (body && body.detail) || body || `Request failed (${res.status})`;
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return body;
  }

  // PUBLIC_INTERFACE
  async function loadRecipes() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/recipes', { method: 'GET' });
      setRecipes(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load recipes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setMode('create');
    setEditingId(null);
    setTitle('');
    setDescription('');
    setIngredientsText('');
    setStepsText('');
    setColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
  }

  function startEdit(recipe) {
    setMode('edit');
    setEditingId(recipe.id);
    setTitle(recipe.title || '');
    setDescription(recipe.description || '');
    setIngredientsText(listToLines(recipe.ingredients || []));
    setStepsText(listToLines(recipe.steps || []));
    setColor(recipe.color || DEFAULT_COLORS[0]);
    setNotice('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validateForm() {
    if (!title.trim()) return 'Title is required.';
    if (title.trim().length > 120) return 'Title is too long (max 120 chars).';
    if (description.length > 500) return 'Description is too long (max 500 chars).';
    if (!isValidHexColor(color)) return 'Color must be a valid hex value like #3b82f6.';
    return '';
  }

  // PUBLIC_INTERFACE
  async function submitForm(e) {
    e.preventDefault();
    setNotice('');
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      ingredients: linesToList(ingredientsText),
      steps: linesToList(stepsText),
      color,
    };

    setSaving(true);
    try {
      if (mode === 'create') {
        await apiFetch('/recipes', { method: 'POST', body: JSON.stringify(payload) });
        setNotice('Recipe added.');
      } else {
        await apiFetch(`/recipes/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setNotice('Recipe updated.');
      }

      await loadRecipes();
      resetForm();
    } catch (e2) {
      setError(e2.message || 'Failed to save recipe.');
    } finally {
      setSaving(false);
    }
  }

  // PUBLIC_INTERFACE
  async function deleteRecipe(id) {
    setNotice('');
    setError('');
    // eslint-disable-next-line no-alert
    const ok = window.confirm('Delete this recipe? This cannot be undone.');
    if (!ok) return;

    try {
      await apiFetch(`/recipes/${id}`, { method: 'DELETE' });
      setNotice('Recipe deleted.');
      await loadRecipes();
      if (mode === 'edit' && editingId === id) resetForm();
    } catch (e) {
      setError(e.message || 'Failed to delete recipe.');
    }
  }

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  const recipeCountLabel = `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`;

  return (
    <div className="App">
      <div className="container">
        <div className="header">
          <div className="brand">
            <h1 className="title">Colorful Recipe Manager</h1>
            <p className="subtitle">
              In-memory recipes for this server session. Add, edit, and manage with a bright card-based UI.
            </p>
          </div>

          <div className="headerActions">
            <button
              className="btn iconBtn"
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>

            <button className="btn" type="button" onClick={loadRecipes} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="btn btnPrimary" type="button" onClick={resetForm} disabled={saving}>
              + New recipe
            </button>
          </div>
        </div>

        <div className="panel" role="region" aria-label="Recipe form">
          <form onSubmit={submitForm}>
            <div className="formGrid">
              <div className="field">
                <div className="label">Title</div>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Lemon Pasta"
                  maxLength={120}
                  required
                />
                <div className="helper">{mode === 'edit' ? `Editing recipe #${editingId}` : 'Create a new recipe.'}</div>
              </div>

              <div className="field">
                <div className="label">Card color</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    className="input"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#3b82f6"
                    aria-label="Recipe card color"
                  />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    aria-label="Pick recipe color"
                    style={{
                      width: 44,
                      height: 42,
                      borderRadius: 12,
                      border: '1px solid var(--borderStrong)',
                      background: 'var(--surface)',
                      padding: 0,
                    }}
                  />
                </div>
                <div className="helper">Tip: pick a color for quick visual scanning.</div>
              </div>

              <div className="field">
                <div className="label">Description</div>
                <textarea
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A quick summary shown on the card…"
                  maxLength={500}
                />
              </div>

              <div className="field">
                <div className="label">Ingredients (one per line)</div>
                <textarea
                  className="textarea"
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  placeholder={'2 eggs\n1 tbsp olive oil\nSalt'}
                />
              </div>

              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <div className="label">Steps (one per line)</div>
                <textarea
                  className="textarea"
                  value={stepsText}
                  onChange={(e) => setStepsText(e.target.value)}
                  placeholder={'Boil water\nCook pasta\nToss with sauce'}
                />
              </div>
            </div>

            <div className="formActions">
              {mode === 'edit' && (
                <button className="btn" type="button" onClick={resetForm} disabled={saving}>
                  Cancel edit
                </button>
              )}
              <button className="btn btnPrimary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add recipe'}
              </button>
            </div>

            {error && (
              <div className="alert alertError" role="alert">
                <strong>Oops:</strong> {error}
              </div>
            )}
            {notice && !error && (
              <div className="alert alertSuccess" role="status">
                {notice}
              </div>
            )}
          </form>
        </div>

        <div className="grid" role="region" aria-label="Recipes list">
          {loading ? (
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              Loading recipes…
            </div>
          ) : recipes.length === 0 ? (
            <div className="panel" style={{ gridColumn: '1 / -1' }}>
              <strong>No recipes yet.</strong> Add one above to get started.
            </div>
          ) : (
            recipes.map((r) => (
              <article className="card" key={r.id} aria-label={`Recipe ${r.title}`}>
                <div className="cardTop" style={{ background: r.color || DEFAULT_COLORS[0] }} />
                <div className="cardBody">
                  <div className="cardTitleRow">
                    <h3 className="cardTitle">{r.title}</h3>
                    <span className="badge">#{r.id}</span>
                  </div>
                  <p className="cardDesc">{r.description || 'No description.'}</p>

                  <div className="pills" aria-label="Ingredients preview">
                    {(r.ingredients || []).slice(0, 4).map((ing, idx) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <span className="pill" key={`${r.id}-ing-${idx}`}>
                        {ing}
                      </span>
                    ))}
                    {(r.ingredients || []).length > 4 && <span className="pill">+{r.ingredients.length - 4} more</span>}
                  </div>
                </div>

                <div className="cardActions">
                  <button className="btn smallBtn" type="button" onClick={() => startEdit(r)}>
                    Edit
                  </button>
                  <button className="btn smallBtn btnDanger" type="button" onClick={() => deleteRecipe(r.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="footerNote">
          Backend: <code>{API_BASE}</code> • Showing: <strong>{recipeCountLabel}</strong>
        </div>
      </div>
    </div>
  );
}

export default App;
