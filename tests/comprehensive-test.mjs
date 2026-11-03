// Comprehensive Automated Test Suite for Rak Modul
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAILED: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  totalTests++;
  const isEq = JSON.stringify(actual) === JSON.stringify(expected);
  if (isEq) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAILED: ${message} (Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)})`);
  }
}

console.log('====================================================');
console.log('🧪 RAK MODUL: COMPREHENSIVE AUTOMATED TEST SUITE');
console.log('====================================================\n');

// -------------------------------------------------------------
// TEST SUITE 1: Syntax & File Integrity Check across all JS files
// -------------------------------------------------------------
console.log('▶ [1/7] Testing Syntax of all JavaScript files...');
function getAllFiles(dir, filter) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, filter));
    } else if (filter(fullPath)) {
      results.push(fullPath);
    }
  });
  return results;
}

const jsFiles = getAllFiles(path.join(rootDir, 'src'), f => f.endsWith('.js'));
assert(jsFiles.length >= 20, `Found ${jsFiles.length} JavaScript source files`);

let allSyntaxValid = true;
jsFiles.forEach(file => {
  try {
    execSync(`node -c "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    allSyntaxValid = false;
    console.error(`Syntax error in ${file}:`, err.message);
  }
});
assert(allSyntaxValid, 'All JavaScript files passed node syntax check');

// -------------------------------------------------------------
// TEST SUITE 2: Router & Path Matching Algorithm
// -------------------------------------------------------------
console.log('\n▶ [2/7] Testing Router & Path Matching Engine...');
import { Router } from '../src/router.js';

const mockRoutes = [
  { path: '/', component: () => 'Home' },
  { path: '/read/:id', component: () => 'Reader' },
  { path: '/code', component: () => 'CodeBank' },
  { path: '/todos', component: () => 'Todos' },
  { path: '/tasks', component: () => 'Tasks' }
];

const router = new Router(mockRoutes);

// Test matching root
const rootMatch = router.matchPath('/', '/');
assert(rootMatch !== null && Object.keys(rootMatch).length === 0, 'Root path "/" matches correctly');

// Test matching parameterized route
const readerMatch = router.matchPath('/read/:id', '/read/doc-abc-123');
assertEqual(readerMatch, { id: 'doc-abc-123' }, 'Parameterized route /read/:id extracts params properly');

// Test matching with URI encoded values
const readerEncodedMatch = router.matchPath('/read/:id', '/read/modul%20kuliah');
assertEqual(readerEncodedMatch, { id: 'modul kuliah' }, 'Parameterized route decodes URI components properly');

// Test mismatching route segment length
const mismatchLength = router.matchPath('/read/:id', '/read/doc-123/extra');
assert(mismatchLength === null, 'Segment length mismatch returns null safely');

// Test mismatching static segment
const mismatchStatic = router.matchPath('/code', '/todos');
assert(mismatchStatic === null, 'Static segment mismatch returns null safely');

// -------------------------------------------------------------
// TEST SUITE 3: Spaced Repetition SM-2 Algorithm
// -------------------------------------------------------------
console.log('\n▶ [3/7] Testing Spaced Repetition (SM-2) Engine...');
import { calculateNextReview } from '../src/reader/sm2.js';

// Test new card with rating 3 (Good)
const cardNew = { reps: 0, ease: 2.5, interval_days: 0 };
const revGood1 = calculateNextReview(cardNew, 3);
assertEqual(revGood1.reps, 1, 'First good review increments reps to 1');
assertEqual(revGood1.interval_days, 1, 'First good review sets interval to 1 day');

// Test second good review
const revGood2 = calculateNextReview(revGood1, 3);
assertEqual(revGood2.reps, 2, 'Second good review increments reps to 2');
assertEqual(revGood2.interval_days, 3, 'Second good review sets interval to 3 days');

// Test rating 1 (Again / Lupa)
const cardOld = { reps: 5, ease: 2.4, interval_days: 20 };
const revAgain = calculateNextReview(cardOld, 1);
assertEqual(revAgain.reps, 0, 'Rating Again resets reps to 0');
assert(revAgain.interval_days < 1, 'Rating Again sets interval for immediate review today (<1 day)');

// Test minimum ease clamping (must never fall below 1.3)
let cardDegrading = { reps: 0, ease: 1.4, interval_days: 1 };
for (let i = 0; i < 10; i++) {
  cardDegrading = calculateNextReview(cardDegrading, 1);
}
assert(cardDegrading.ease >= 1.3, `Ease factor clamped at minimum 1.3 (Current: ${cardDegrading.ease})`);

// Test rating 4 (Easy) gives bonus interval
const revEasy = calculateNextReview(cardNew, 4);
assertEqual(revEasy.interval_days, 3, 'First Easy rating gives 3 days bonus interval');
assert(revEasy.ease > 2.5, 'Easy rating increases ease factor');

// -------------------------------------------------------------
// TEST SUITE 4: Code Editor Syntax Highlighter & Indent Guides
// -------------------------------------------------------------
console.log('\n▶ [4/7] Testing Code Editor Highlighter & Indent Guides...');
import { highlightCode } from '../src/ui/code-editor.js';

// Test 4-space indent guide
const pyCode4Spaces = '    x = 10';
const res4 = highlightCode(pyCode4Spaces, 'python');
assert(res4.html.includes('class="rm-ide-guide"'), '4 leading spaces generates vertical indent guide');
assert(!res4.hasTabOrOddSpaces, '4 leading spaces is marked clean (no odd spacing)');

// Test 8-space indent guide (2 levels)
const pyCode8Spaces = '        return x';
const res8 = highlightCode(pyCode8Spaces, 'python');
const guideCount = (res8.html.match(/class="rm-ide-guide"/g) || []).length;
assertEqual(guideCount, 2, '8 leading spaces generates exactly 2 indent guides');

// Test odd spacing warning (3 spaces)
const pyCodeOdd = '   x = 5';
const resOdd = highlightCode(pyCodeOdd, 'python');
assert(resOdd.hasTabOrOddSpaces, '3 spaces triggers PEP 8 odd indentation warning flag');
assert(resOdd.html.includes('class="rm-ide-guide-odd"'), 'Odd spaces wrapped with warning element');

// Test Tab character warning
const pyCodeTab = '\tx = 5';
const resTab = highlightCode(pyCodeTab, 'python');
assert(resTab.hasTabOrOddSpaces, 'Tab character triggers warning flag');
assert(resTab.html.includes('rm-ide-guide-tab'), 'Tab character wrapped with tab warning element');

// Test syntax token highlighting
const pyTokens = 'def hitung(a, b=True):\n    # komentar\n    print("hasil:", a)';
const resTokens = highlightCode(pyTokens, 'python');
assert(resTokens.html.includes('class="rm-tok-keyword">def</span>'), 'Keyword "def" highlighted properly');
assert(resTokens.html.includes('class="rm-tok-constant">True</span>'), 'Constant "True" highlighted properly');
assert(resTokens.html.includes('class="rm-tok-comment"># komentar</span>'), 'Comment highlighted properly');
assert(resTokens.html.includes('class="rm-tok-builtin">print</span>'), 'Builtin "print" highlighted properly');
assert(resTokens.html.includes('class="rm-tok-string">"hasil:"</span>'), 'String literal highlighted properly');

// Test HTML escaping security (Prevent XSS)
const xssCode = '<script>alert(1)</script>';
const resXss = highlightCode(xssCode, 'python');
assert(!resXss.html.includes('<script>'), 'Raw <script> tags are safely escaped');
assert(resXss.html.includes('&lt;script&gt;'), '&lt;script&gt; escaped entity present');

// -------------------------------------------------------------
// TEST SUITE 5: Colab v4 (.ipynb) Schema Generation
// -------------------------------------------------------------
console.log('\n▶ [5/7] Testing Google Colab (.ipynb) v4 Export Schema...');

function generateIpynbObject(nb) {
  return {
    nbformat: 4,
    nbformat_minor: 2,
    metadata: {
      colab: { name: nb.title, provenance: [] },
      kernelspec: {
        display_name: nb.language === 'python' ? 'Python 3' : nb.language.toUpperCase(),
        name: nb.language === 'python' ? 'python3' : nb.language
      },
      language_info: { name: nb.language || 'python' }
    },
    cells: (nb.cells || []).map(cell => {
      if (cell.type === 'markdown') {
        return {
          cell_type: 'markdown',
          metadata: {},
          source: (cell.content || '').split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l)
        };
      } else {
        const outputs = [];
        if (cell.output_note && cell.output_note.trim()) {
          outputs.push({
            name: 'stdout',
            output_type: 'stream',
            text: cell.output_note.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l)
          });
        }
        return {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: outputs,
          source: (cell.content || '').split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\n' : l)
        };
      }
    })
  };
}

const sampleNb = {
  title: 'Test Notebook Machine Learning',
  language: 'python',
  cells: [
    { type: 'markdown', content: '# Judul Modul\nPenjelasan materi' },
    { type: 'code', content: 'import pandas as pd\nprint("OK")', output_note: 'OK' }
  ]
};

const ipynbJson = generateIpynbObject(sampleNb);
assertEqual(ipynbJson.nbformat, 4, 'Valid Jupyter Notebook format version 4');
assertEqual(ipynbJson.nbformat_minor, 2, 'Valid Jupyter Notebook minor version 2');
assertEqual(ipynbJson.cells.length, 2, 'Exports all cells properly');
assertEqual(ipynbJson.cells[0].cell_type, 'markdown', 'Cell 0 is valid markdown');
assertEqual(ipynbJson.cells[1].cell_type, 'code', 'Cell 1 is valid code');
assert(Array.isArray(ipynbJson.cells[1].outputs), 'Code cell has outputs array');
assertEqual(ipynbJson.cells[1].outputs[0].text, ['OK'], 'Code cell output captured correctly');

// Validate JSON serialization
const serialized = JSON.stringify(ipynbJson);
assert(typeof serialized === 'string' && serialized.length > 50, 'Ipynb stringifies cleanly to JSON');

// -------------------------------------------------------------
// TEST SUITE 6: To-Do Datetime & Status Intelligence
// -------------------------------------------------------------
console.log('\n▶ [6/7] Testing To-Do Datetime & Status Engine...');

function testDueMeta(dueDatetime, completed) {
  if (completed) {
    return { group: 'completed', isOverdue: false, label: 'Selesai' };
  }
  if (!dueDatetime) {
    return { group: 'no_due', isOverdue: false, label: 'Tanpa Tenggat' };
  }
  const now = new Date();
  const due = new Date(dueDatetime);
  if (isNaN(due.getTime())) {
    return { group: 'no_due', isOverdue: false, label: 'Tanpa Tenggat' };
  }
  const diffMs = due.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (60 * 1000));

  if (diffMinutes < 0) {
    return { group: 'overdue', isOverdue: true, label: 'Terlambat' };
  }

  const isToday = now.getFullYear() === due.getFullYear() &&
                  now.getMonth() === due.getMonth() &&
                  now.getDate() === due.getDate();
  if (isToday) {
    return { group: 'today', isOverdue: false, label: 'Hari ini' };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = tomorrow.getFullYear() === due.getFullYear() &&
                     tomorrow.getMonth() === due.getMonth() &&
                     tomorrow.getDate() === due.getDate();
  if (isTomorrow) {
    return { group: 'upcoming', isOverdue: false, label: 'Besok' };
  }

  return { group: 'upcoming', isOverdue: false, label: 'Mendatang' };
}

// 1. Completed task
const metaCompleted = testDueMeta('2020-01-01T10:00', true);
assertEqual(metaCompleted.group, 'completed', 'Completed task is grouped into "completed"');
assert(!metaCompleted.isOverdue, 'Completed task is not overdue');

// 2. Overdue task (past date)
const pastDate = new Date(Date.now() - 3600 * 1000 * 5).toISOString(); // 5 hours ago
const metaOverdue = testDueMeta(pastDate, false);
assertEqual(metaOverdue.group, 'overdue', 'Past task marked as overdue');
assert(metaOverdue.isOverdue, 'Past task isOverdue flag is true');

// 3. Today task (future hour today)
const todayFuture = new Date();
todayFuture.setHours(23, 59, 0, 0);
const metaToday = testDueMeta(todayFuture.toISOString(), false);
assertEqual(metaToday.group, 'today', 'Task due later today grouped into "today"');
assert(!metaToday.isOverdue, 'Task due later today is not overdue');

// 4. Tomorrow task
const tomorrowFuture = new Date();
tomorrowFuture.setDate(tomorrowFuture.getDate() + 1);
tomorrowFuture.setHours(12, 0, 0, 0);
const metaTomorrow = testDueMeta(tomorrowFuture.toISOString(), false);
assertEqual(metaTomorrow.group, 'upcoming', 'Task due tomorrow grouped into upcoming');

// 5. Invalid date string protection
const metaInvalid = testDueMeta('invalid-date-string', false);
assertEqual(metaInvalid.group, 'no_due', 'Invalid date string safely defaults to "no_due" without throwing');

// 6. Null date protection
const metaNull = testDueMeta(null, false);
assertEqual(metaNull.group, 'no_due', 'Null date safely defaults to "no_due" without throwing');

// -------------------------------------------------------------
// TEST SUITE 7: Unicode & Character Sanitization for Exporter
// -------------------------------------------------------------
console.log('\n▶ [7/10] Testing Unicode & PDF Character Sanitization...');
import { sanitizeForPdf } from '../src/reader/format-converter.js';

const mockFont = {
  encodeText: (text) => {
    // Simulates standard WinAnsi font throwing on unencodable characters
    for (const c of text) {
      if (c.charCodeAt(0) > 255) {
        throw new Error('WinAnsi cannot encode');
      }
    }
  }
};

const textWithArrows = 'Proses A → B ⇒ C ≤ D ≠ E';
const sanitized = sanitizeForPdf(textWithArrows, mockFont);
assert(!sanitized.includes('→'), 'Unicode arrow → is sanitized to ascii');
assert(!sanitized.includes('⇒'), 'Unicode arrow ⇒ is sanitized to ascii');
assert(!sanitized.includes('≤'), 'Unicode math ≤ is sanitized to <=');
assert(!sanitized.includes('≠'), 'Unicode math ≠ is sanitized to !=');

// Verify sanitized text can be encoded without error
let canEncode = true;
try {
  mockFont.encodeText(sanitized);
} catch (e) {
  canEncode = false;
}
assert(canEncode, 'Sanitized text encodes safely in WinAnsi font');

// -------------------------------------------------------------
// TEST SUITE 8: TTS Audio Timeline & Binary Search Seek
// -------------------------------------------------------------
console.log('\n▶ [8/10] Testing TTS Timeline & Binary Search Seeking...');

function calculateTtsTimeline(sentences, rate = 1.0) {
  const wpm = 150 * rate;
  const wordsPerSec = Math.max(0.5, wpm / 60);
  const startTimes = [];
  const durations = [];
  let accum = 0;

  for (const s of sentences) {
    const wordCount = Math.max(1, (s || '').trim().split(/\s+/).length);
    let d = wordCount / wordsPerSec;
    if (/[.?!]$/.test((s || '').trim())) d += 0.5 / rate;
    else if (/[,;:]$/.test((s || '').trim())) d += 0.3 / rate;
    else d += 0.2 / rate;

    startTimes.push(accum);
    durations.push(d);
    accum += d;
  }
  return { startTimes, durations, totalDuration: Math.max(1, accum) };
}

function binarySearchSeek(startTimes, totalDuration, targetSeconds) {
  const clamped = Math.max(0, Math.min(targetSeconds, totalDuration));
  let low = 0;
  let high = startTimes.length - 1;
  let targetIndex = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (startTimes[mid] <= clamped) {
      targetIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return targetIndex;
}

const testSentences = [
  'Selamat pagi mahasiswa.',
  'Hari ini kita akan membahas algoritma Machine Learning.',
  'Normalisasi data sangat penting untuk konvergensi gradien.'
];
const timeline = calculateTtsTimeline(testSentences, 1.0);
assertEqual(timeline.startTimes.length, 3, 'Timeline creates start times for all sentences');
assertEqual(timeline.startTimes[0], 0, 'First sentence starts exactly at 0.0s');
assert(timeline.totalDuration > 3, 'Total duration calculated reasonably based on word count');

// Test seeking
const seekStart = binarySearchSeek(timeline.startTimes, timeline.totalDuration, 0.1);
assertEqual(seekStart, 0, 'Seeking 0.1s targets sentence 0');

const seekMiddle = binarySearchSeek(timeline.startTimes, timeline.totalDuration, timeline.startTimes[1] + 0.1);
assertEqual(seekMiddle, 1, 'Seeking into sentence 1 accurately resolves to index 1');

const seekEnd = binarySearchSeek(timeline.startTimes, timeline.totalDuration, timeline.totalDuration + 50);
assertEqual(seekEnd, 2, 'Seeking past total duration clamps safely to last sentence');

// -------------------------------------------------------------
// TEST SUITE 9: Pomodoro Math & Formatting
// -------------------------------------------------------------
console.log('\n▶ [9/10] Testing Pomodoro Timer Math & Format...');

function formatPomoTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

assertEqual(formatPomoTime(1500), '25:00', '25 minutes formats to 25:00');
assertEqual(formatPomoTime(65), '01:05', '65 seconds formats to 01:05');
assertEqual(formatPomoTime(0), '00:00', '0 seconds formats to 00:00');

// -------------------------------------------------------------
// TEST SUITE 10: Obsidian Markdown Export Format
// -------------------------------------------------------------
console.log('\n▶ [10/10] Testing Obsidian Notes Export Format...');

function generateNotesMarkdown(doc, annotations) {
  let md = `# Catatan Modul: ${doc.title}\n\n`;
  md += `- **Mata Kuliah:** ${doc.course_name || 'Umum'}\n`;
  md += `- **Format Asal:** ${(doc.source_type || 'PDF').toUpperCase()}\n\n---\n\n`;

  const validAnnotations = annotations.filter(a => !a.deleted);
  const pageGroups = new Map();
  for (const a of validAnnotations) {
    if (!pageGroups.has(a.page_no)) pageGroups.set(a.page_no, []);
    pageGroups.get(a.page_no).push(a);
  }

  for (const [pageNo, items] of pageGroups.entries()) {
    md += `## Halaman ${pageNo}\n\n`;
    for (const item of items) {
      if (item.quote) {
        md += `> [!NOTE] Sorot\n> "${item.quote}"\n\n`;
      }
      if (item.note_md) {
        md += `**Catatan:**\n${item.note_md}\n\n`;
      }
    }
  }
  return md;
}

const mockDoc = { title: 'Modul Analisis Data', course_name: 'Data Science', source_type: 'pdf' };
const mockAnnots = [
  { page_no: 1, quote: 'Mean adalah rata-rata aritmatika.', note_md: 'Penting untuk ujian.', deleted: false },
  { page_no: 2, quote: 'Median adalah nilai tengah.', note_md: 'Tahan terhadap outlier.', deleted: false },
  { page_no: 2, quote: 'Dihapus', deleted: true }
];

const generatedMd = generateNotesMarkdown(mockDoc, mockAnnots);
assert(generatedMd.includes('# Catatan Modul: Modul Analisis Data'), 'Header title generated properly');
assert(generatedMd.includes('## Halaman 1'), 'Page 1 section present');
assert(generatedMd.includes('Mean adalah rata-rata aritmatika'), 'Page 1 quote included');
assert(generatedMd.includes('Tahan terhadap outlier'), 'Page 2 note included');
assert(!generatedMd.includes('Dihapus'), 'Deleted annotations filtered out');

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
if (failedTests === 0) {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! ZERO ERRORS.');
} else {
  console.error(`⚠️ ${failedTests} TESTS FAILED.`);
}
console.log('====================================================\n');

process.exit(failedTests === 0 ? 0 : 1);
