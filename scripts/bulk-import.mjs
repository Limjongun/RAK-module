// Script Impor Massal Modul Lokal
// Menjalankan konversi lokal dan parsing teks untuk puluhan modul sekaligus

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const inputDir = process.argv[2] || './input-modules';
const outputDir = './output-converted';

if (!fs.existsSync(inputDir)) {
  console.log(`Direktori input "${inputDir}" tidak ditemukan. Buat folder dan letakkan modul di dalamnya.`);
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const files = fs.readdirSync(inputDir);
console.log(`Ditemukan ${files.length} file di ${inputDir}. Memulai proses konversi...`);

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const filePath = path.join(inputDir, file);

  if (ext === '.pdf') {
    console.log(`[PDF] Menyalin ${file} langsung ke output...`);
    fs.copyFileSync(filePath, path.join(outputDir, file));
  } else if (['.docx', '.pptx', '.ppt', '.doc'].includes(ext)) {
    console.log(`[Office] Mengonversi ${file} ke PDF menggunakan LibreOffice...`);
    try {
      execSync(`soffice --headless --convert-to pdf "${filePath}" --outdir "${outputDir}"`, { stdio: 'inherit' });
    } catch (e) {
      console.warn(`Gagal mengonversi ${file}:`, e.message);
    }
  }
}

console.log('Selesai! Semua modul siap diimpor ke Rak Modul.');

