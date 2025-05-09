import { useState, useEffect } from 'react';
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
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [texts, setTexts] = useState(['', '', '']);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [darkMode, setDarkMode] = useState(() => prefersDark || true);
  const [savedDiffs, setSavedDiffs] = useState([]);
  const [selectedSave, setSelectedSave] = useState(null);
  const [sideBySide, setSideBySide] = useState(false);
  const [title, setTitle] = useState('');
  const [notification, setNotification] = useState(null);
  const [inputTitles, setInputTitles] = useState(['Initial Draft', 'Text 2', 'Text 3']);

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
  };

  const handleDelete = (id) => {
    const updated = savedDiffs.filter(s => s.id !== id);
    setSavedDiffs(updated);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    if (selectedSave === id) setSelectedSave(null);
  };

  const handleReset = () => {
    setTexts(['', '', '']);
    setTitle('');
  };

  const handleDeleteAll = () => {
    setSavedDiffs([]);
    localStorage.setItem(LOCAL_KEY, JSON.stringify([]));
    setSelectedSave(null);
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

  return (
    <div className="page-background">
      <div className={`app-container${darkMode ? ' dark' : ''}`}>  
        {notification && (
          <div className="notification">{notification}</div>
        )}
        <h1>SeoZ Text Diff</h1>
        <div className="controls">
          <div className="controls-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Ignore Whitespace</span>
              <span className="toggle-switch">
                <input type="checkbox" checked={ignoreWhitespace} onChange={e => setIgnoreWhitespace(e.target.checked)} />
                <span className="toggle-slider"></span>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Case Sensitive</span>
              <span className="toggle-switch">
                <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />
                <span className="toggle-slider"></span>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Side-by-side View</span>
              <span className="toggle-switch">
                <input type="checkbox" checked={sideBySide} onChange={e => setSideBySide(e.target.checked)} />
                <span className="toggle-slider"></span>
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Light Mode</span>
              <span className="toggle-switch">
                <input type="checkbox" checked={!darkMode} onChange={e => setDarkMode(d => !d)} />
                <span className="toggle-slider"></span>
              </span>
            </label>
          </div>
          <div className="controls-row">
            <button onClick={handleSave}>Save Diff</button>
            <button onClick={handleReset} style={{marginLeft: '0.7em'}}>Reset</button>
          </div>
        </div>
        <div className="save-title-row">
          <label style={{ fontWeight: 'bold', marginRight: 8 }}>
            Diff Title:
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ marginLeft: 8, width: 300 }}
              placeholder="Enter a title for this diff"
            />
          </label>
        </div>
        <div className="inputs">
          {[0, 1, 2].map(i => (
            <div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1em'}}>
              <input
                type="text"
                value={inputTitles[i]}
                onChange={e => handleInputTitleChange(i, e.target.value)}
                style={{
                  fontWeight: 'bold',
                  fontSize: '1.08em',
                  marginBottom: '0.4em',
                  textAlign: 'center',
                  width: '80%',
                  borderRadius: '5px',
                  border: '1px solid #ccc',
                  padding: '0.3em 0.5em',
                }}
                placeholder={`Text ${i + 1} Title`}
              />
              <textarea
                value={texts[i]}
                onChange={e => handleTextChange(i, e.target.value)}
                placeholder={inputTitles[i] || `Text ${i + 1}`}
                rows={8}
              />
            </div>
          ))}
        </div>
        <div className="diffs">
          {pairs.map(([a, b], idx) => (
            <div key={idx} className="diff-section">
              <h2>Diff: Text {a + 1} vs Text {b + 1}</h2>
              <DiffSummary summary={summaries[idx]} />
              {sideBySide ? (
                <SideBySideView a={texts[a]} b={texts[b]} wordDiff={wordDiffs[idx]} />
              ) : (
                <DiffView lineDiff={lineDiffs[idx]} wordDiff={wordDiffs[idx]} />
              )}
            </div>
          ))}
        </div>
        <div className="saves">
          <h2>Saved Diffs</h2>
          <button onClick={handleDeleteAll} style={{marginBottom: '0.7em', fontSize: '0.95em'}}>Remove All</button>
          {savedDiffs.length === 0 && <p>No saved diffs.</p>}
          <ul>
            {savedDiffs.slice(0, 5).map(save => (
              <li key={save.id} className={selectedSave === save.id ? 'selected' : ''}>
                <span className="save-title">{save.title || getDefaultTitle(save.texts)}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>{save.date}</span>
                <button onClick={() => handleLoad(save)}>Load</button>
                <button onClick={() => handleDelete(save.id)}>Delete</button>
              </li>
            ))}
            {savedDiffs.length > 5 && savedDiffs.slice(5).map(save => (
              <li key={save.id} className={selectedSave === save.id ? 'selected' : ''} style={{ opacity: 0.7 }}>
                <span className="save-title">{save.title || getDefaultTitle(save.texts)}</span>
                <span style={{ color: '#888', marginLeft: 8 }}>{save.date}</span>
                <button onClick={() => handleLoad(save)}>Load</button>
                <button onClick={() => handleDelete(save.id)}>Delete</button>
              </li>
            ))}
          </ul>
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

function SideBySideView({ a, b, wordDiff }) {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const maxLen = Math.max(aLines.length, bLines.length);
  return (
    <div className="side-by-side">
      <div className="side">
        <h4>Text A</h4>
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
        <h4>Text B</h4>
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
