// Pomodoro Timer Controller & Sound Notification
// Terintegrasi langsung dengan pelacakan waktu belajar (study_sessions)

import { recordStudySession } from '../data/local-db.js';
import { showToast } from '../ui/toast.js';
import { icon } from '../ui/icons.js';

export class PomodoroController {
  constructor({ documentId = null, onTick = null, onComplete = null } = {}) {
    this.documentId = documentId;
    this.durationMinutes = parseInt(localStorage.getItem('rm-pomo-duration') || '25', 10);
    this.remainingSeconds = this.durationMinutes * 60;
    this.isRunning = false;
    this.timerId = null;
    this.startedAt = null;
    this.startPage = 1;
    this.currentPage = 1;
    this.onTick = onTick;
    this.onComplete = onComplete;
  }

  setDocument(docId, currentPage = 1) {
    this.documentId = docId;
    this.startPage = currentPage;
    this.currentPage = currentPage;
  }

  updateCurrentPage(pageNo) {
    this.currentPage = pageNo;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    if (!this.startedAt) {
      this.startedAt = new Date().toISOString();
      this.startPage = this.currentPage;
    }

    this.timerId = setInterval(() => {
      this.tick();
    }, 1000);
    if (this.onTick) this.onTick(this.formatTime(), this.isRunning);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.onTick) this.onTick(this.formatTime(), this.isRunning);
  }

  reset() {
    this.pause();
    this.remainingSeconds = this.durationMinutes * 60;
    this.startedAt = null;
    if (this.onTick) this.onTick(this.formatTime(), this.isRunning);
  }

  setDuration(minutes) {
    this.pause();
    this.durationMinutes = minutes;
    this.remainingSeconds = minutes * 60;
    this.startedAt = null;
    localStorage.setItem('rm-pomo-duration', minutes.toString());
    if (this.onTick) this.onTick(this.formatTime(), this.isRunning);
  }

  tick() {
    if (this.remainingSeconds > 0) {
      this.remainingSeconds--;
      if (this.onTick) this.onTick(this.formatTime(), this.isRunning);
    } else {
      this.complete();
    }
  }

  async complete() {
    this.pause();
    this.playChime();

    const pagesRead = Math.max(1, Math.abs(this.currentPage - this.startPage) + 1);
    await recordStudySession({
      document_id: this.documentId,
      minutes: this.durationMinutes,
      pages_read: pagesRead,
      started_at: this.startedAt || new Date().toISOString()
    });

    showToast(`🎉 Sesi ${this.durationMinutes} menit selesai! Waktu belajar Anda telah dicatat.`);

    if (this.onComplete) {
      this.onComplete(this.durationMinutes);
    }

    this.reset();
  }

  formatTime() {
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  playChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;

      // Chord nada lonceng belajar (C5, G5, C6)
      const notes = [523.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.2, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 1.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 1.2);
      });
    } catch {
      // AudioContext not allowed or unsupported
    }
  }

  destroy() {
    this.pause();
  }
}

