import { useState, useEffect, useRef } from 'react';
import { diffLines, diffWords } from 'diff';
import './App.css';

function getLineDiff(a, b, ignoreWhitespace) {
  return diffLines(a, b, { ignoreWhitespace });
}

function getWordDiff(a, b) {
  return diffWords(a, b);
}

function summarizeDiff(diff) {
  let added = 0, removed = 0, unchanged = 0;
  diff.forEach(part => {
    const wordCount = part.value.trim() === '' ? 0 : part.value.trim().split(/\s+/).length;
    if (part.added) added += wordCount;
    else if (part.removed) removed += wordCount;
    else unchanged += wordCount;
  });
  return { added, removed, unchanged };
}

function getDefaultTitle(texts) {
  // Use the first 6 words of the first text as the default title
  const first = texts[0].trim().split(/\s+/).slice(0, 6).join(' ');
  return first || 'Untitled Diff';
}

const LOCAL_KEY = 'text-diff-saves';

function App() {
  // const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [texts, setTexts] = useState(['', '', '']);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [savedDiffs, setSavedDiffs] = useState([]);
  const [selectedSave, setSelectedSave] = useState(null);
  const [sideBySide, setSideBySide] = useState(false);
  const [title, setTitle] = useState('');
  const [notification, setNotification] = useState(null);
  const [inputTitles, setInputTitles] = useState(['Initial Draft', 'Text 2', 'Text 3']);
  const fileInputRef = useRef();

  useEffect(() => {
    document.body.className = darkMode ? 'dark' : '';
  }, [darkMode]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    setSavedDiffs(saved);
  }, []);

  useEffect(() => {
    setTitle(getDefaultTitle(texts));
  }, [texts]);

  const handleTextChange = (idx, value) => {
    setTexts(t => t.map((v, i) => (i === idx ? value : v)));
  };

  const handleInputTitleChange = (idx, value) => {
    setInputTitles(titles => titles.map((t, i) => (i === idx ? value : t)));
  };

  const handleSave = () => {
    const saveTitle = title.trim() || getDefaultTitle(texts);
    const newSave = {
      id: Date.now(),
      title: saveTitle,
      texts: [...texts],
      ignoreWhitespace,
      date: new Date().toLocaleString(),
    };
    const updated = [newSave, ...savedDiffs];
    setSavedDiffs(updated);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    setNotification(`Diff saved as "${saveTitle}"`);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleLoad = (save) => {
    setTexts(save.texts);
    setIgnoreWhitespace(save.ignoreWhitespace);
    setSelectedSave(save.id);
    setTitle(save.title || getDefaultTitle(save.texts));
    setNotification(`Loaded diff: "${save.title || getDefaultTitle(save.texts)}"`);
    setTimeout(() => setNotification(null), 2500);
  };

  const handleDelete = (id) => {
    const updated = savedDiffs.filter(s => s.id !== id);
    setSavedDiffs(updated);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    if (selectedSave === id) setSelectedSave(null);
    setNotification('Saved diff deleted');
    setTimeout(() => setNotification(null), 2500);
  };

  const handleReset = () => {
    setTexts(['', '', '']);
    setTitle('');
  };

  const handleDeleteAll = () => {
    setSavedDiffs([]);
    localStorage.setItem(LOCAL_KEY, JSON.stringify([]));
    setSelectedSave(null);
    setNotification('All saved diffs removed');
    setTimeout(() => setNotification(null), 2500);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(savedDiffs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'seoz-text-diff-saves.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNotification('Saved diffs exported');
    setTimeout(() => setNotification(null), 2500);
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          // Merge, avoiding duplicates by id
          const existingIds = new Set(savedDiffs.map(d => d.id));
          const merged = [...imported.filter(d => !existingIds.has(d.id)), ...savedDiffs];
          setSavedDiffs(merged);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
          setNotification('Saved diffs imported');
          setTimeout(() => setNotification(null), 2500);
        }
      } catch (err) {
        alert('Invalid file format.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be imported again if needed
    e.target.value = '';
  };

  // Helper to apply case sensitivity
  function applyCase(text) {
    return caseSensitive ? text : text.toLowerCase();
  }

  // Compute line-level and word-level diffs for each pair
  const pairs = [
    [0, 1],
    [1, 2],
    [0, 2],
  ];
  const lineDiffs = pairs.map(([a, b]) => getLineDiff(applyCase(texts[a]), applyCase(texts[b]), ignoreWhitespace));
  const wordDiffs = pairs.map(([a, b]) => {
    const aLines = texts[a].split('\n');
    const bLines = texts[b].split('\n');
    const maxLen = Math.max(aLines.length, bLines.length);
    const wordLevel = [];
    for (let i = 0; i < maxLen; i++) {
      const aLine = aLines[i] ?? '';
      const bLine = bLines[i] ?? '';
      if (applyCase(aLine) === applyCase(bLine)) {
        wordLevel.push([{ value: aLine, type: 'same' }]);
      } else {
        // For case-insensitive, diff lowercased but display original
        if (caseSensitive) {
          const diff = getWordDiff(aLine, bLine);
          wordLevel.push(diff.map(part => ({ value: part.value, type: part.added ? 'added' : part.removed ? 'removed' : 'same' })));
        } else {
          // Get diff of lowercased, but map to original text
          const diff = getWordDiff(aLine.toLowerCase(), bLine.toLowerCase());
          let aIdx = 0, bIdx = 0;
          const origParts = [];
          diff.forEach(part => {
            if (part.added) {
              // Added in b
              const val = bLine.slice(bIdx, bIdx + part.value.length);
              origParts.push({ value: val, type: 'added' });
              bIdx += part.value.length;
            } else if (part.removed) {
              // Removed from a
              const val = aLine.slice(aIdx, aIdx + part.value.length);
              origParts.push({ value: val, type: 'removed' });
              aIdx += part.value.length;
            } else {
              // Same
              const val = aLine.slice(aIdx, aIdx + part.value.length);
              origParts.push({ value: val, type: 'same' });
              aIdx += part.value.length;
              bIdx += part.value.length;
            }
          });
          wordLevel.push(origParts);
        }
      }
    }
    return wordLevel;
  });
  const summaries = lineDiffs.map(summarizeDiff);

  const handleToggle = (setter, value, message) => {
    setter(value);
    setNotification(message);
    setTimeout(() => setNotification(null), 1800);
  };

  return (
    <div className="page-background">
      <div className={`app-container${darkMode ? ' dark' : ''}`}>
        {notification && (
          <div className="notification">{notification}</div>
        )}
        <header className="app-header">
          <h1>SeoZ Text Diff</h1>
          <p className="app-subtitle">Compare up to three versions of a text, line by line and word by word.</p>
        </header>
        <div className="controls">
          <div className="controls-row toggles-row">
            <label className="toggle-label">
              <span className="toggle-switch">
                <input type="checkbox" checked={ignoreWhitespace} onChange={e => handleToggle(setIgnoreWhitespace, e.target.checked, e.target.checked ? 'Ignore Whitespace ON' : 'Ignore Whitespace OFF')} />
                <span className="toggle-slider"></span>
              </span>
              <span>Ignore Whitespace</span>
            </label>
            <label className="toggle-label">
              <span className="toggle-switch">
                <input type="checkbox" checked={caseSensitive} onChange={e => handleToggle(setCaseSensitive, e.target.checked, e.target.checked ? 'Case Sensitive ON' : 'Case Sensitive OFF')} />
                <span className="toggle-slider"></span>
              </span>
              <span>Case Sensitive</span>
            </label>
            <label className="toggle-label">
              <span className="toggle-switch">
                <input type="checkbox" checked={sideBySide} onChange={e => handleToggle(setSideBySide, e.target.checked, e.target.checked ? 'Side-by-side View ON' : 'Side-by-side View OFF')} />
                <span className="toggle-slider"></span>
              </span>
              <span>Side-by-side View</span>
            </label>
            <label className="toggle-label">
              <span className="toggle-switch">
                <input type="checkbox" checked={!darkMode} onChange={e => handleToggle(setDarkMode, !e.target.checked, !e.target.checked ? 'Dark Mode ON' : 'Light Mode ON')} />
                <span className="toggle-slider"></span>
              </span>
              <span>Light Mode</span>
            </label>
          </div>
          <div className="controls-row actions-row">
            <button className="btn btn-primary" onClick={handleSave}>Save Diff</button>
            <button className="btn btn-secondary" onClick={() => { handleReset(); setNotification('Inputs reset'); setTimeout(() => setNotification(null), 1800); }}>Reset</button>
          </div>
        </div>
        <div className="save-title-row">
          <label className="save-title-field">
            Diff Title
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter a title for this diff"
            />
          </label>
        </div>
        <div className="inputs">
          {[0, 1, 2].map(i => (
            <div key={i} className="input-card">
              <input
                type="text"
                className="input-card-title"
                value={inputTitles[i]}
                onChange={e => handleInputTitleChange(i, e.target.value)}
                placeholder={`Text ${i + 1} Title${i === 2 ? ' (optional)' : ''}`}
              />
              <textarea
                value={texts[i]}
                onChange={e => handleTextChange(i, e.target.value)}
                placeholder={i === 2 ? `${inputTitles[i] || 'Text 3'} — optional` : (inputTitles[i] || `Text ${i + 1}`)}
                rows={8}
              />
              <div className="input-card-meta">
                <span className="word-count">
                  {texts[i].trim() ? `${texts[i].trim().split(/\s+/).length} words` : '0 words'}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="diffs">
          {pairs.map(([a, b], idx) => {
            if ((a === 2 || b === 2) && !texts[2].trim()) return null;
            const titleA = inputTitles[a] || `Text ${a + 1}`;
            const titleB = inputTitles[b] || `Text ${b + 1}`;
            return (
              <div key={idx} className="diff-section">
                <div className="diff-section-header">
                  <h2>{titleA} vs {titleB}</h2>
                  <DiffSummary summary={summaries[idx]} />
                </div>
                {sideBySide ? (
                  <SideBySideView a={texts[a]} b={texts[b]} titleA={titleA} titleB={titleB} wordDiff={wordDiffs[idx]} />
                ) : (
                  <DiffView lineDiff={lineDiffs[idx]} wordDiff={wordDiffs[idx]} />
                )}
              </div>
            );
          })}
        </div>
        <div className="saves">
          <h2>Saved Diffs</h2>
          <div className="saves-toolbar">
            <button className="btn btn-ghost" onClick={handleDeleteAll}>Remove All</button>
            <button className="btn btn-ghost" onClick={handleExport}>Export</button>
            <button className="btn btn-ghost" onClick={handleImportClick}>Import</button>
            <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
          </div>
          {savedDiffs.length === 0 ? (
            <p className="saves-empty">No saved diffs yet — save one above to see it here.</p>
          ) : (
            <ul>
              {savedDiffs.map((save, i) => (
                <li key={save.id} className={`${selectedSave === save.id ? 'selected' : ''}${i >= 5 ? ' older' : ''}`}>
                  <div className="save-info">
                    <span className="save-title">{save.title || getDefaultTitle(save.texts)}</span>
                    <span className="save-date">{save.date}</span>
                  </div>
                  <div className="save-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleLoad(save)}>Load</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(save.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffSummary({ summary }) {
  return (
    <div className="diff-summary">
      <span className="added">+{summary.added} added</span>{' '}
      <span className="removed">-{summary.removed} removed</span>{' '}
      <span className="same">{summary.unchanged} unchanged</span>
    </div>
  );
}

function DiffView({ lineDiff, wordDiff }) {
  return (
    <pre className="diff-view">
      {lineDiff.map((line, i) => {
        if (!line.added && !line.removed) {
          return <div key={i} className="diff-line same">{line.value.replace(/\n$/, '\u00A0')}</div>;
        } else {
          // Show word-level diff for changed lines, no background on the line itself
          const parts = Array.isArray(wordDiff[i]) ? wordDiff[i] : [];
          return (
            <div key={i} className="diff-line">
              {parts.length > 0
                ? parts.map((part, j) => (
                    <span key={j} className={`word ${part.type}`}>{part.value}</span>
                  ))
                : '\u00A0'}
            </div>
          );
        }
      })}
    </pre>
  );
}

function SideBySideView({ a, b, titleA, titleB, wordDiff }) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const maxLen = Math.max(aLines.length, bLines.length);
  return (
    <div className="side-by-side">
      <div className="side">
        <h4>{titleA}</h4>
        <pre>
          {Array.from({ length: maxLen }).map((_, i) => {
            const parts = Array.isArray(wordDiff[i]) ? wordDiff[i] : [];
            return (
              <div key={i} className="diff-line">
                {parts.length > 0
                  ? parts.map((part, j) =>
                      part.type !== 'added' ? (
                        <span key={j} className={`word ${part.type}`}>{part.value}</span>
                      ) : null
                    )
                  : '\u00A0'}
              </div>
            );
          })}
        </pre>
      </div>
      <div className="side">
        <h4>{titleB}</h4>
        <pre>
          {Array.from({ length: maxLen }).map((_, i) => {
            const parts = Array.isArray(wordDiff[i]) ? wordDiff[i] : [];
            return (
              <div key={i} className="diff-line">
                {parts.length > 0
                  ? parts.map((part, j) =>
                      part.type !== 'removed' ? (
                        <span key={j} className={`word ${part.type}`}>{part.value}</span>
                      ) : null
                    )
                  : '\u00A0'}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

export default App;
