// SuperMemo-2 (SM-2) Spaced Repetition Algorithm Implementation
// Digunakan untuk menghitung jadwal repetisi kartu flashcard secara adaptif

export function calculateNextReview(card, rating) {
  // rating: 1 = Again (Lupa), 2 = Hard (Sulit), 3 = Good (Ingat), 4 = Easy (Mudah)
  let reps = card.reps || 0;
  let ease = card.ease || 2.5;
  let intervalDays = card.interval_days || 0;

  // Pemetaan grade untuk rumus standar SM-2 (0-5)
  const gradeMap = {
    1: 1, // Again
    2: 3, // Hard
    3: 4, // Good
    4: 5  // Easy
  };
  const grade = gradeMap[rating] || 3;

  // Hitung faktor kemudahan (Ease Factor)
  let newEase = ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (newEase < 1.3) newEase = 1.3;
  newEase = Math.round(newEase * 100) / 100;

  let newInterval = 0;
  let newReps = reps;

  if (rating === 1) {
    // Again / Lupa: reset repetisi
    newReps = 0;
    newInterval = 0.04; // ~1 jam untuk review kembali hari ini
  } else if (rating === 2) {
    // Hard: interval diperpanjang sedikit
    newReps = reps + 1;
    newInterval = reps === 0 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
  } else if (rating === 3) {
    // Good: interval standar SM-2
    newReps = reps + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 3;
    } else {
      newInterval = Math.max(1, Math.round(intervalDays * newEase));
    }
  } else if (rating === 4) {
    // Easy: interval bonus
    newReps = reps + 1;
    if (newReps === 1) {
      newInterval = 3;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.max(1, Math.round(intervalDays * newEase * 1.3));
    }
  }

  const nextDueDate = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000);

  return {
    ...card,
    reps: newReps,
    ease: newEase,
    interval_days: newInterval,
    due_at: nextDueDate.toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function formatIntervalLabel(rating, card) {
  const next = calculateNextReview(card, rating);
  const days = next.interval_days;
  if (days < 0.1) return '< 1 jam';
  if (days === 1) return '1 hari';
  if (days < 30) return `${Math.round(days)} hari`;
  const months = Math.round(days / 30);
  return `${months} bulan`;
}

