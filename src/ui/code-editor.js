// Modul Editor Kode Interaktif Gaya IDE untuk Rak Modul (Python & Colab First)
// Fitur: Indent Guides (garis 4 spasi), Smart Auto-indent (Enter setelah :),
// Tab / Shift+Tab block indentation, Smart Backspace, Auto-closing pairs,
// Syntax Highlighting, Deteksi kesalahan tab/spasi (PEP 8), dan Status Bar Ln/Col.

export function createCodeEditor({
  container,
  initialValue = '',
  language = 'python',
  onChange = () => {},
  onCursorChange = () => {}
}) {
  let value = initialValue;
  let currentLanguage = language;

  // Render kerangka IDE
  container.innerHTML = `
    <div class="rm-ide-container">
      <div class="rm-ide-editor-wrap">
        <!-- Gutter Line Numbers -->
        <div class="rm-ide-gutter" aria-hidden="true">
          <div class="rm-ide-lines">1</div>
        </div>

        <!-- Stage: Highlight Layer + Live Input Textarea -->
        <div class="rm-ide-stage">
          <pre class="rm-ide-highlight" aria-hidden="true"><code class="rm-ide-code"></code></pre>
          <textarea 
            class="rm-ide-textarea" 
            spellcheck="false" 
            autocomplete="off" 
            autocapitalize="off"
            wrap="off"
            placeholder="# Ketik atau tempel kode ${currentLanguage} di sini..."
          ></textarea>
        </div>
      </div>

      <!-- IDE Status Bar -->
      <div class="rm-ide-statusbar">
        <div class="rm-ide-status-left">
          <span class="rm-ide-cursor-pos">Ln 1, Col 1</span>
          <span class="rm-ide-sep">•</span>
          <span class="rm-ide-indent-mode">Indentasi: 4 Spasi (PEP 8)</span>
          <span class="rm-ide-warning-badge" style="display:none;" title="Peringatan inkonsistensi spasi/tab">
            ⚠️ Indentasi tidak rapi
          </span>
        </div>
        <div class="rm-ide-status-right">
          <button type="button" class="rm-ide-format-btn" title="Otomatis konversi tab ke 4 spasi dan rapikan trailing whitespace">
            ⚡ Rapikan Spasi (PEP 8)
          </button>
        </div>
      </div>
    </div>
  `;

  const textarea = container.querySelector('.rm-ide-textarea');
  const codeEl = container.querySelector('.rm-ide-code');
  const gutterLines = container.querySelector('.rm-ide-lines');
  const preEl = container.querySelector('.rm-ide-highlight');
  const stageEl = container.querySelector('.rm-ide-stage');
  const cursorPosEl = container.querySelector('.rm-ide-cursor-pos');
  const warningBadge = container.querySelector('.rm-ide-warning-badge');
  const formatBtn = container.querySelector('.rm-ide-format-btn');

  // Set nilai awal
  textarea.value = value;

  // Update tampilan (Highlight, gutter, auto-height, peringatan)
  function update() {
    value = textarea.value;

    // 1. Render syntax highlighting + indent guides
    const { html, hasTabOrOddSpaces } = highlightCode(value, currentLanguage);
    codeEl.innerHTML = html + '\n'; // newline penutup agar cursor di baris baru tidak terpotong

    // 2. Perbarui nomor baris
    const lineCount = value.split('\n').length;
    let linesStr = '';
    for (let i = 1; i <= lineCount; i++) {
      linesStr += `<div>${i}</div>`;
    }
    gutterLines.innerHTML = linesStr;

    // 3. Tampilkan/sembunyikan peringatan tab/spasi
    if (warningBadge) {
      if (hasTabOrOddSpaces && currentLanguage === 'python') {
        warningBadge.style.display = 'inline-flex';
      } else {
        warningBadge.style.display = 'none';
      }
    }

    // 4. Auto-resize tinggi agar pas dengan konten
    adjustHeight();

    // 5. Update posisi kursor
    updateCursorInfo();

    // 6. Callback ke luar
    onChange(value);
  }

  // Sesuaikan tinggi textarea & pre secara otomatis
  function adjustHeight() {
    textarea.style.height = 'auto';
    const newHeight = Math.max(90, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
    stageEl.style.height = newHeight + 'px';
    container.querySelector('.rm-ide-gutter').style.height = newHeight + 'px';
  }

  // Sinkronisasi scroll horizontal
  textarea.addEventListener('scroll', () => {
    preEl.scrollLeft = textarea.scrollLeft;
  });

  // Hitung baris dan kolom kursor saat ini
  function updateCursorInfo() {
    const selStart = textarea.selectionStart;
    const textBefore = textarea.value.slice(0, selStart);
    const lines = textBefore.split('\n');
    const lineNo = lines.length;
    const colNo = lines[lines.length - 1].length + 1;

    if (cursorPosEl) {
      cursorPosEl.textContent = `Ln ${lineNo}, Col ${colNo}`;
    }

    // Highlight nomor baris aktif di gutter
    const allLineDivs = gutterLines.querySelectorAll('div');
    allLineDivs.forEach((div, idx) => {
      if (idx + 1 === lineNo) {
        div.classList.add('rm-ide-line-active');
      } else {
        div.classList.remove('rm-ide-line-active');
      }
    });

    onCursorChange({ line: lineNo, col: colNo });
  }

  // -------------------------------------------------------------
  // FITUR KUNCI IDE: Penanganan Tab, Spasi, Auto-Indent, Smart Backspace
  // -------------------------------------------------------------
  textarea.addEventListener('keydown', (e) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    // 1. TAB & SHIFT+TAB (Indentasi 4 Spasi PEP 8)
    if (e.key === 'Tab') {
      e.preventDefault();

      if (e.shiftKey) {
        // Shift + Tab: DEDENT (Maju mundur indentasi ke kiri)
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = val.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = val.length;

        const lines = val.substring(lineStart, lineEnd).split('\n');
        let removedCharsFirstLine = 0;
        let totalRemoved = 0;

        const newLines = lines.map((line, idx) => {
          let removeCount = 0;
          if (line.startsWith('    ')) {
            removeCount = 4;
          } else if (line.startsWith('\t')) {
            removeCount = 1;
          } else {
            const m = line.match(/^ +/);
            if (m) removeCount = m[0].length;
          }
          if (idx === 0) removedCharsFirstLine = removeCount;
          totalRemoved += removeCount;
          return line.substring(removeCount);
        });

        textarea.value = val.substring(0, lineStart) + newLines.join('\n') + val.substring(lineEnd);
        textarea.selectionStart = Math.max(lineStart, start - removedCharsFirstLine);
        textarea.selectionEnd = Math.max(lineStart, end - totalRemoved);
        update();
      } else {
        // Tab biasa: INDENT
        if (start === end) {
          // Kursor tunggal: sisipkan spasi sampai kelipatan 4 terdekat
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const col = start - lineStart;
          const spacesNeeded = 4 - (col % 4);
          const spaces = ' '.repeat(spacesNeeded);

          textarea.value = val.substring(0, start) + spaces + val.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + spacesNeeded;
          update();
        } else {
          // Blok teks terseleksi: indent semua baris yang tersentuh +4 spasi
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          let lineEnd = val.indexOf('\n', end);
          if (lineEnd === -1) lineEnd = val.length;

          const lines = val.substring(lineStart, lineEnd).split('\n');
          const newLines = lines.map(line => '    ' + line);
          const addedChars = newLines.length * 4;

          textarea.value = val.substring(0, lineStart) + newLines.join('\n') + val.substring(lineEnd);
          textarea.selectionStart = start + 4;
          textarea.selectionEnd = end + addedChars;
          update();
        }
      }
      return;
    }

    // 2. ENTER: SMART AUTO-INDENTASI (Python Sensitivity)
    if (e.key === 'Enter') {
      e.preventDefault();

      // Cari baris saat ini sampai kursor
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLineToCursor = val.substring(lineStart, start);
      
      // Ambil indentasi saat ini (spasi/tab di awal baris)
      const indentMatch = currentLineToCursor.match(/^[ \t]*/);
      let currentIndent = indentMatch ? indentMatch[0] : '';
      
      const trimmed = currentLineToCursor.trim();
      let extraIndent = '';

      // Khusus Python: Jika baris diakhiri titik dua (:), tambah 4 spasi otomatis!
      // Contoh: def ...:, if ...:, for ...:, class ...:, else:, except:, with ...:
      if (trimmed.endsWith(':') || trimmed.endsWith('(') || trimmed.endsWith('[') || trimmed.endsWith('{')) {
        extraIndent = '    ';
      }

      // Cek apakah kursor berada persis di antara pasangan kurung yang terbuka: () [] {}
      const charBefore = val.charAt(start - 1);
      const charAfter = val.charAt(start);
      const isBetweenPair = 
        (charBefore === '(' && charAfter === ')') ||
        (charBefore === '[' && charAfter === ']') ||
        (charBefore === '{' && charAfter === '}');

      if (isBetweenPair) {
        // Seperti VS Code: tekan enter di antara () membuat baris tengah terindentasi
        const newText = '\n' + currentIndent + extraIndent + '\n' + currentIndent;
        textarea.value = val.substring(0, start) + newText + val.substring(end);
        const newPos = start + 1 + currentIndent.length + extraIndent.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
      } else {
        const newText = '\n' + currentIndent + extraIndent;
        textarea.value = val.substring(0, start) + newText + val.substring(end);
        const newPos = start + newText.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
      }

      update();
      return;
    }

    // 3. BACKSPACE: SMART DEDENT (Hapus 4 spasi sekaligus jika kursor di kelipatan 4)
    if (e.key === 'Backspace' && start === end) {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const textBeforeInLine = val.substring(lineStart, start);

      // Jika hanya terdiri dari spasi di awal baris
      if (/^ +$/.test(textBeforeInLine) && textBeforeInLine.length > 0) {
        e.preventDefault();
        // Hitung berapa spasi yang dihapus menuju batas 4 spasi sebelumnya
        const removeCount = ((textBeforeInLine.length - 1) % 4) + 1;
        textarea.value = val.substring(0, start - removeCount) + val.substring(start);
        textarea.selectionStart = textarea.selectionEnd = start - removeCount;
        update();
        return;
      }
    }

    // 4. AUTO-CLOSING PAIRS: () [] {} "" ''
    const pairs = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'"
    };

    if (pairs[e.key]) {
      const openChar = e.key;
      const closeChar = pairs[e.key];

      // Jika karakter penutup sudah ada tepat di depan kursor, cukup lewati
      if ((openChar === '"' || openChar === "'") && val.charAt(start) === closeChar && start === end) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        updateCursorInfo();
        return;
      }

      // Jika ada teks terseleksi, bungkus teks tersebut
      if (start !== end) {
        e.preventDefault();
        const selected = val.substring(start, end);
        textarea.value = val.substring(0, start) + openChar + selected + closeChar + val.substring(end);
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = end + 1;
        update();
        return;
      }

      // Kursor tunggal: masukkan sepasang dan posisikan kursor di tengah
      e.preventDefault();
      textarea.value = val.substring(0, start) + openChar + closeChar + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      update();
      return;
    }

    // Jika mengetik karakter penutup dan kursor tepat di depannya: lewati
    if ((e.key === ')' || e.key === ']' || e.key === '}') && val.charAt(start) === e.key && start === end) {
      e.preventDefault();
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      updateCursorInfo();
      return;
    }

    // 5. SHORTCUT COMMENT / UNCOMMENT (Ctrl + / atau Cmd + /)
    if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleComments();
      return;
    }
  });

  // Toggle Comment (# untuk Python/Bash, -- untuk SQL, // untuk JS)
  function toggleComments() {
    const val = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = val.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = val.length;

    const lines = val.substring(lineStart, lineEnd).split('\n');
    const prefix = currentLanguage === 'sql' ? '-- ' : (currentLanguage === 'javascript' || currentLanguage === 'cpp' || currentLanguage === 'java' ? '// ' : '# ');

    // Cek apakah semua baris yang ada isinya sudah dikomentari
    const allCommented = lines.every(l => l.trim().length === 0 || l.trim().startsWith(prefix.trim()));

    const newLines = lines.map(line => {
      if (allCommented) {
        // Hapus komentar
        const idx = line.indexOf(prefix);
        if (idx !== -1) {
          return line.substring(0, idx) + line.substring(idx + prefix.length);
        }
        const trimPrefix = prefix.trim();
        const idx2 = line.indexOf(trimPrefix);
        if (idx2 !== -1) {
          return line.substring(0, idx2) + line.substring(idx2 + trimPrefix.length);
        }
        return line;
      } else {
        // Tambahkan komentar di awal karakter baris
        return prefix + line;
      }
    });

    textarea.value = val.substring(0, lineStart) + newLines.join('\n') + val.substring(lineEnd);
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineStart + newLines.join('\n').length;
    update();
  }

  // 6. FORMAT INDENTASI PEP 8 (Ubah tab acak ke 4 spasi & hapus trailing spaces)
  function formatPep8Indentation() {
    let lines = textarea.value.split('\n');
    let fixedLines = lines.map(line => {
      // Ganti tab di awal baris dengan 4 spasi
      let leading = line.match(/^[ \t]*/)[0];
      let rest = line.substring(leading.length);
      let newLeading = leading.replace(/\t/g, '    ');
      
      // Hapus trailing whitespace
      return (newLeading + rest).replace(/[ \t]+$/, '');
    });

    textarea.value = fixedLines.join('\n');
    update();
  }

  if (formatBtn) {
    formatBtn.addEventListener('click', () => {
      formatPep8Indentation();
      const orig = formatBtn.innerHTML;
      formatBtn.innerHTML = `✓ Indentasi Rapi!`;
      formatBtn.style.color = 'var(--pen)';
      setTimeout(() => {
        formatBtn.innerHTML = orig;
        formatBtn.style.color = '';
      }, 1500);
    });
  }

  // Listeners input & kursor
  textarea.addEventListener('input', update);
  textarea.addEventListener('click', updateCursorInfo);
  textarea.addEventListener('keyup', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      updateCursorInfo();
    }
  });

  // Inisialisasi awal
  update();

  return {
    getValue: () => textarea.value,
    setValue: (newVal) => {
      textarea.value = newVal;
      update();
    },
    setLanguage: (newLang) => {
      currentLanguage = newLang;
      update();
    },
    focus: () => textarea.focus(),
    formatIndentation: formatPep8Indentation
  };
}

// -------------------------------------------------------------
// ENGINE SYNTAX HIGHLIGHTING & INDENT GUIDES (Python, SQL, dll)
// -------------------------------------------------------------

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightCode(code, language = 'python') {
  const lines = (code || '').split('\n');
  let hasTabOrOddSpaces = false;

  const highlightedLines = lines.map(line => {
    // 1. Ekstrak spasi / tab di awal baris (Leading Whitespace)
    const match = line.match(/^([ \t]*)(.*)$/);
    const leading = match ? match[1] : '';
    const content = match ? match[2] : '';

    let guideHtml = '';
    let spaceCount = 0;

    for (let i = 0; i < leading.length; i++) {
      if (leading[i] === '\t') {
        hasTabOrOddSpaces = true;
        // Tampilkan visual tab dengan garis batas
        guideHtml += `<span class="rm-ide-guide rm-ide-guide-tab" title="Peringatan: Karakter Tab terdeteksi! Gunakan 4 spasi standar PEP 8.">    </span>`;
        spaceCount += 4;
      } else {
        spaceCount++;
        // Setiap kelipatan 4 spasi, buat satu slot Indent Guide dengan garis vertikal
        if (spaceCount % 4 === 0) {
          guideHtml += `<span class="rm-ide-guide">    </span>`;
        }
      }
    }

    // Jika ada sisa spasi yang bukan kelipatan 4 (misal 2 atau 3 spasi yang membuat indentasi menceng)
    const oddRemainder = spaceCount % 4;
    if (oddRemainder > 0) {
      hasTabOrOddSpaces = true;
      guideHtml += `<span class="rm-ide-guide-odd" title="Peringatan: Spasi tidak sejajar (bukan kelipatan 4 spasi)">${' '.repeat(oddRemainder)}</span>`;
    }

    // 2. Syntax highlighting untuk teks baris
    let tokensHtml = '';
    if (language === 'python') {
      tokensHtml = highlightPythonTokens(content);
    } else if (language === 'sql') {
      tokensHtml = highlightSqlTokens(content);
    } else {
      tokensHtml = highlightGenericTokens(content);
    }

    return guideHtml + tokensHtml;
  });

  return {
    html: highlightedLines.join('\n'),
    hasTabOrOddSpaces
  };
}

// Tokenizer Python
function highlightPythonTokens(content) {
  if (!content) return '';

  // 1. Tangani komentar lebih dulu (# ...)
  const commentIdx = content.indexOf('#');
  if (commentIdx !== -1) {
    const codePart = content.substring(0, commentIdx);
    const commentPart = content.substring(commentIdx);
    return highlightPythonTokens(codePart) + `<span class="rm-tok-comment">${escapeHtml(commentPart)}</span>`;
  }

  // Regex token Python
  const tokenRegex = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|f"(?:\\.|[^"\\])*"|f'(?:\\.|[^'\\])*'|\b(?:def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|lambda|break|continue|pass|raise|assert|global|nonlocal|async|await|match|case|in|is|not|and|or)\b|\b(?:True|False|None|self|cls)\b|\b(?:print|len|range|str|int|float|list|dict|set|tuple|bool|open|type|sum|min|max|enumerate|zip|isinstance|issubclass|map|filter|sorted|reversed|super|any|all|abs|round|id|input|help|dir)\b|@[a-zA-Z0-9_\.]+|\b\d+(?:\.\d+)?\b|[a-zA-Z_]\w*(?=\s*\()|[a-zA-Z_]\w*|[^\s\w])/g;

  return content.replace(tokenRegex, (match) => {
    // Strings
    if (match.startsWith('"') || match.startsWith("'") || match.startsWith('f"') || match.startsWith("f'")) {
      return `<span class="rm-tok-string">${escapeHtml(match)}</span>`;
    }
    // Decorators
    if (match.startsWith('@')) {
      return `<span class="rm-tok-decorator">${escapeHtml(match)}</span>`;
    }
    // Keywords
    const keywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'lambda', 'break', 'continue', 'pass', 'raise', 'assert', 'global', 'nonlocal', 'async', 'await', 'match', 'case', 'in', 'is', 'not', 'and', 'or'];
    if (keywords.includes(match)) {
      return `<span class="rm-tok-keyword">${match}</span>`;
    }
    // Constants
    const constants = ['True', 'False', 'None', 'self', 'cls'];
    if (constants.includes(match)) {
      return `<span class="rm-tok-constant">${match}</span>`;
    }
    // Builtin functions
    const builtins = ['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'bool', 'open', 'type', 'sum', 'min', 'max', 'enumerate', 'zip', 'isinstance', 'issubclass', 'map', 'filter', 'sorted', 'reversed', 'super', 'any', 'all', 'abs', 'round', 'id', 'input', 'help', 'dir'];
    if (builtins.includes(match)) {
      return `<span class="rm-tok-builtin">${match}</span>`;
    }
    // Numbers
    if (/^\d+(\.\d+)?$/.test(match)) {
      return `<span class="rm-tok-number">${match}</span>`;
    }
    return escapeHtml(match);
  });
}

// Tokenizer SQL
function highlightSqlTokens(content) {
  if (!content) return '';

  // Tangani komentar SQL (-- ...)
  const commentIdx = content.indexOf('--');
  if (commentIdx !== -1) {
    const codePart = content.substring(0, commentIdx);
    const commentPart = content.substring(commentIdx);
    return highlightSqlTokens(codePart) + `<span class="rm-tok-comment">${escapeHtml(commentPart)}</span>`;
  }

  const tokenRegex = /('(?:\\.|[^'\\])*'|\b(?:SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|WITH|AS|OVER|PARTITION\s+BY|DENSE_RANK|RANK|ROW_NUMBER|LAG|LEAD|SUM|AVG|COUNT|MAX|MIN|ROUND|DATE_TRUNC|CURRENT_DATE|INTERVAL|TO_CHAR|CASE|WHEN|THEN|ELSE|END|AND|OR|NOT|IN|IS|NULL|LIKE|ILIKE|DISTINCT|INSERT|UPDATE|DELETE|CREATE|TABLE|DROP)\b|\b\d+\b|[a-zA-Z_]\w*|[^\s\w])/gi;

  const sqlKeywords = ['select', 'from', 'where', 'join', 'left', 'right', 'inner', 'outer', 'on', 'group by', 'order by', 'having', 'limit', 'offset', 'with', 'as', 'over', 'partition by', 'dense_rank', 'rank', 'row_number', 'lag', 'lead', 'sum', 'avg', 'count', 'max', 'min', 'round', 'date_trunc', 'current_date', 'interval', 'to_char', 'case', 'when', 'then', 'else', 'end', 'and', 'or', 'not', 'in', 'is', 'null', 'like', 'ilike', 'distinct', 'insert', 'update', 'delete', 'create', 'table', 'drop'];

  return content.replace(tokenRegex, (match) => {
    if (match.startsWith("'")) {
      return `<span class="rm-tok-string">${escapeHtml(match)}</span>`;
    }
    if (sqlKeywords.includes(match.toLowerCase())) {
      return `<span class="rm-tok-keyword">${escapeHtml(match.toUpperCase())}</span>`;
    }
    if (/^\d+$/.test(match)) {
      return `<span class="rm-tok-number">${match}</span>`;
    }
    return escapeHtml(match);
  });
}

// Fallback Generic
function highlightGenericTokens(content) {
  return escapeHtml(content);
}

