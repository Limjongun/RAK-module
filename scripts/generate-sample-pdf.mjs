// Script untuk membuat PDF modul kuliah simulasi untuk pengujian lokal
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function createSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Halaman 1: Sampul & Pengantar
  const page1 = pdfDoc.addPage([595, 842]); // A4
  page1.drawText('CS170: Desain dan Analisis Algoritma', {
    x: 50,
    y: 750,
    size: 20,
    font: fontBold,
    color: rgb(0.15, 0.25, 0.69)
  });

  page1.drawText('Bab 4: Jalur Terpendek pada Graf Berarah Tanpa Siklus (DAG)', {
    x: 50,
    y: 710,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  const introText = [
    'Graf berarah tanpa siklus (Directed Acyclic Graph atau DAG) adalah graf yang tidak',
    'memiliki jalur siklus kembali ke simpul asal. Setiap DAG dijamin memiliki minimal satu',
    'urutan topologis (topological order).',
    '',
    'Dengan memanfaatkan urutan topologis, pencarian jalur terpendek dari simpul tunggal dapat',
    'diselesaikan secara efisien dalam waktu linear O(V + E), bahkan ketika terdapat bobot sisi negatif.',
    'Hal ini karena relaksasi sisi dilakukan secara terurut satu arah tanpa risiko siklus negatif.'
  ];

  let yPos = 650;
  for (const line of introText) {
    if (line) {
      page1.drawText(line, { x: 50, y: yPos, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
    }
    yPos -= 22;
  }

  // Halaman 2: Algoritma & Kompleksitas
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('Langkah-Langkah Algoritma Relaksasi Linier', {
    x: 50,
    y: 750,
    size: 16,
    font: fontBold,
    color: rgb(0.15, 0.25, 0.69)
  });

  const page2Text = [
    '1. Hitung urutan topologis seluruh simpul menggunakan penelusuran DFS atau algoritma Kahn.',
    '2. Inisialisasi jarak ke simpul awal dist[s] = 0, dan dist[v] = tak hingga untuk seluruh simpul lainnya.',
    '3. Untuk setiap simpul u dalam urutan topologis:',
    '     Untuk setiap sisi keluar (u, v) dengan bobot w:',
    '       Jika dist[u] + w < dist[v], maka perbarui dist[v] = dist[u] + w.',
    '',
    'Analisis Kompleksitas Waktu:',
    'Pengurutan topologis membutuhkan waktu O(V + E). Relaksasi setiap sisi dilakukan tepat satu kali,',
    'sehingga total waktu eksekusi adalah O(V + E). Ini jauh lebih cepat daripada algoritma Dijkstra O((V + E) log V)',
    'maupun Bellman-Ford O(V * E).'
  ];

  yPos = 700;
  for (const line of page2Text) {
    if (line) {
      page2.drawText(line, { x: 50, y: yPos, size: 12, font, color: rgb(0.15, 0.15, 0.15) });
    }
    yPos -= 22;
  }

  const pdfBytes = await pdfDoc.save();
  const outPath = path.resolve('./public/sample-module.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Contoh modul PDF berhasil dibuat di: ${outPath}`);
}

createSamplePdf();

