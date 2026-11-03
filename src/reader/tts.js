// Web Speech API Controller + Floating Player + Advanced Voice, Pitch, Rate & Sleep Timer Settings
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';
import { makeDraggable } from '../ui/drag.js';

export class TtsController {
  constructor({ onSentenceChange, onStateChange, onNextPage, onPrevPage } = {}) {
    this.synth = window.speechSynthesis;
    this.sentences = [];
    this.currentIndex = 0;
    this.isPlaying = false;

    // Pengaturan Nada, Kecepatan, Volume tersimpan di localStorage
    this.rate = parseFloat(localStorage.getItem('tts_rate') || '1.0');
    this.pitch = parseFloat(localStorage.getItem('tts_pitch') || '1.0');
    this.volume = parseFloat(localStorage.getItem('tts_volume') || '1.0');

    this.sleepTimerId = null;
    this.sleepTimerMinutes = 0;
    this.sleepTimerEnd = null;

    this.voices = [];
    this.currentVoice = null;
    this.playerElement = null;
    this.modalElement = null;
    this.activeSettingsTab = 'voices'; // 'voices' atau 'audio'
    this.utterance = null;
    this.onSentenceChange = onSentenceChange;
    this.onStateChange = onStateChange;
    this.onNextPage = onNextPage;
    this.onPrevPage = onPrevPage;
    this.pageInfo = null; // { currentPage: 1, totalPages: 1 }

    // Audio timeline & scrubber properties (seperti pemutar musik)
    this.timeline = { startTimes: [], durations: [], totalDuration: 1 };
    this.sentenceStartTime = null;
    this.tickerId = null;
    this.isUserDragging = false;

    this.initVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.initVoices();
    }
  }

  initVoices() {
    this.voices = this.synth.getVoices();
    if (this.voices.length === 0) return;

    const savedVoiceName = localStorage.getItem('preferred_voice_name');
    if (savedVoiceName) {
      const match = this.voices.find(v => v.name === savedVoiceName);
      if (match) {
        this.currentVoice = match;
        this.updatePlayerUI();
        return;
      }
    }

    // Urutan prioritas rekomendasi suara terbaik:
    // 1. Microsoft Gadis Online (Natural) - Bahasa Indonesia
    // 2. Microsoft Ardi Online (Natural) - Bahasa Indonesia
    // 3. Google Bahasa Indonesia
    // 4. Suara id-ID lainnya
    // 5. Microsoft Natural English / Google US English
    const priorityPick =
      this.voices.find(v => /gadis.*natural/i.test(v.name)) ||
      this.voices.find(v => /ardi.*natural/i.test(v.name)) ||
      this.voices.find(v => /google.*indonesia/i.test(v.name)) ||
      this.voices.find(v => v.lang.startsWith('id') || v.lang.startsWith('in')) ||
      this.voices.find(v => /jenny.*natural/i.test(v.name)) ||
      this.voices.find(v => /google.*us.*english/i.test(v.name)) ||
      this.voices[0];

    this.currentVoice = priorityPick;
    this.updatePlayerUI();
  }

  categorizeVoices() {
    const idVoices = [];
    const enVoices = [];
    const otherVoices = [];

    for (const v of this.voices) {
      const lang = (v.lang || '').toLowerCase();
      const isIndo = lang.startsWith('id') || lang.startsWith('in') || /indonesia/i.test(v.name);
      const isEnglish = lang.startsWith('en') || /english/i.test(v.name);

      if (isIndo) idVoices.push(v);
      else if (isEnglish) enVoices.push(v);
      else otherVoices.push(v);
    }

    const scoreVoice = (v) => {
      let score = 0;
      if (/natural/i.test(v.name)) score += 50;
      if (/google/i.test(v.name)) score += 30;
      if (/microsoft/i.test(v.name)) score += 20;
      return score;
    };

    idVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    enVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));

    return { idVoices, enVoices, otherVoices };
  }

  setVoice(voice) {
    this.currentVoice = voice;
    localStorage.setItem('preferred_voice_name', voice.name);
    this.updatePlayerUI();

    if (this.isPlaying) {
      this.speakSentence(this.currentIndex);
    }
  }

  setPitch(pitch) {
    this.pitch = Math.max(0.5, Math.min(1.8, pitch));
    localStorage.setItem('tts_pitch', this.pitch.toString());
    if (this.isPlaying) {
      this.speakSentence(this.currentIndex);
    }
  }

  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2.5, rate));
    localStorage.setItem('tts_rate', this.rate.toString());
    this.buildTimeline();
    this.updatePlayerUI();
    if (this.isPlaying) {
      this.speakSentence(this.currentIndex);
    }
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1.0, volume));
    localStorage.setItem('tts_volume', this.volume.toString());
    if (this.isPlaying) {
      this.speakSentence(this.currentIndex);
    }
  }

  setSleepTimer(minutes) {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
      this.sleepTimerEnd = null;
    }

    this.sleepTimerMinutes = minutes;
    if (minutes > 0) {
      this.sleepTimerEnd = Date.now() + minutes * 60 * 1000;
      this.sleepTimerId = setTimeout(() => {
        this.pause();
        showToast(`Timer tidur ${minutes} menit selesai. Pemutar dijeda.`);
        this.sleepTimerId = null;
        this.sleepTimerMinutes = 0;
        this.sleepTimerEnd = null;
      }, minutes * 60 * 1000);
      showToast(`Timer tidur disetel ke ${minutes} menit.`);
    } else {
      showToast('Timer tidur dimatikan.');
    }
  }

  testVoiceAndAudio(voice = this.currentVoice) {
    this.synth.cancel();
    const isIndo = !voice || voice.lang.startsWith('id') || voice.lang.startsWith('in') || /indonesia/i.test(voice.name);
    const sampleText = isIndo
      ? 'Halo, ini pengujian nada, kecepatan, dan intonasi suara untuk modul kuliahmu.'
      : 'Hello, this is a test of pitch, speed, and intonation for your study modules.';

    const testUtter = new SpeechSynthesisUtterance(sampleText);
    if (voice) testUtter.voice = voice;
    testUtter.pitch = this.pitch;
    testUtter.rate = this.rate;
    testUtter.volume = this.volume;
    this.synth.speak(testUtter);
  }

  openSettingsModal(initialTab = 'voices') {
    if (this.modalElement) this.modalElement.remove();
    this.activeSettingsTab = initialTab;

    this.voices = this.synth.getVoices();
    const { idVoices, enVoices, otherVoices } = this.categorizeVoices();

    const backdrop = document.createElement('div');
    backdrop.className = 'rm-modal-backdrop';

    const renderModalContent = () => {
      backdrop.innerHTML = `
        <div class="rm-modal" role="dialog" aria-label="Pengaturan Suara & Nada">
          <div class="rm-modal-header">
            <h3 class="rm-modal-title">Pengaturan Audio & Suara</h3>
            <button class="rm-btn rm-btn-ghost rm-btn-icon rm-modal-close" aria-label="Tutup dialog">
              ${icon('close')}
            </button>
          </div>

          <!-- Tabs -->
          <div class="rm-sidebar-tabs" style="padding:0 var(--space-4);">
            <button class="rm-sidebar-tab ${this.activeSettingsTab === 'voices' ? 'active' : ''}" id="rm-tab-btn-voices">
              Pilihan Suara
            </button>
            <button class="rm-sidebar-tab ${this.activeSettingsTab === 'audio' ? 'active' : ''}" id="rm-tab-btn-audio">
              Nada, Kecepatan & Timer
            </button>
          </div>

          <div class="rm-modal-body">
            ${this.activeSettingsTab === 'voices' ? `
              <p class="rm-muted" style="font-size:13px;margin:0 0 var(--space-3);">
                Pilih suara dari <b>Microsoft Natural AI</b> atau <b>Google</b> untuk intonasi terbaik.
              </p>

              ${idVoices.length > 0 ? `
                <div class="rm-voice-group-title">🇮🇩 Bahasa Indonesia (${idVoices.length} Suara)</div>
                ${idVoices.map(v => this.renderVoiceItemHTML(v)).join('')}
              ` : ''}

              ${enVoices.length > 0 ? `
                <div class="rm-voice-group-title">🇬🇧 Bahasa Inggris (${enVoices.length} Suara)</div>
                ${enVoices.map(v => this.renderVoiceItemHTML(v)).join('')}
              ` : ''}

              ${otherVoices.length > 0 ? `
                <div class="rm-voice-group-title">🌐 Suara Lainnya (${otherVoices.length} Suara)</div>
                ${otherVoices.slice(0, 15).map(v => this.renderVoiceItemHTML(v)).join('')}
              ` : ''}
            ` : `
              <!-- Tab Pengaturan Nada, Kecepatan & Timer -->
              <div style="padding:var(--space-2) 0;">
                <!-- Pitch (Nada) -->
                <div class="rm-range-group">
                  <div class="rm-range-header">
                    <span class="rm-range-label">Tinggi Nada (Pitch)</span>
                    <span class="rm-range-val" id="rm-val-pitch">${this.pitch.toFixed(1)}× ${this.pitch === 1.0 ? '(Normal)' : this.pitch < 1.0 ? '(Berat/Bass)' : '(Tinggi)'}</span>
                  </div>
                  <input type="range" class="rm-range-input" id="rm-slider-pitch" min="0.5" max="1.6" step="0.1" value="${this.pitch}">
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-muted);margin-top:2px;">
                    <span>Berat (0,5×)</span>
                    <span>Normal (1,0×)</span>
                    <span>Tinggi (1,6×)</span>
                  </div>
                </div>

                <!-- Rate (Kecepatan) -->
                <div class="rm-range-group">
                  <div class="rm-range-header">
                    <span class="rm-range-label">Kecepatan Membaca (Speed)</span>
                    <span class="rm-range-val" id="rm-val-rate">${this.rate.toFixed(2).replace('.', ',')}×</span>
                  </div>
                  <input type="range" class="rm-range-input" id="rm-slider-rate" min="0.5" max="2.5" step="0.05" value="${this.rate}">
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-muted);margin-top:2px;">
                    <span>Lambat (0,5×)</span>
                    <span>Normal (1,0×)</span>
                    <span>Cepat (2,5×)</span>
                  </div>
                </div>

                <!-- Volume -->
                <div class="rm-range-group">
                  <div class="rm-range-header">
                    <span class="rm-range-label">Volume Suara</span>
                    <span class="rm-range-val" id="rm-val-vol">${Math.round(this.volume * 100)}%</span>
                  </div>
                  <input type="range" class="rm-range-input" id="rm-slider-vol" min="0.1" max="1.0" step="0.05" value="${this.volume}">
                </div>

                <!-- Timer Tidur -->
                <div class="rm-range-group">
                  <div class="rm-range-header">
                    <span class="rm-range-label">Timer Tidur (Sleep Timer)</span>
                    <span class="rm-range-val">${this.sleepTimerMinutes > 0 ? `${this.sleepTimerMinutes} menit aktif` : 'Mati'}</span>
                  </div>
                  <select class="rm-select-input" id="rm-select-sleep">
                    <option value="0" ${this.sleepTimerMinutes === 0 ? 'selected' : ''}>Mati (Tidak ada batas)</option>
                    <option value="10" ${this.sleepTimerMinutes === 10 ? 'selected' : ''}>10 Menit</option>
                    <option value="20" ${this.sleepTimerMinutes === 20 ? 'selected' : ''}>20 Menit</option>
                    <option value="30" ${this.sleepTimerMinutes === 30 ? 'selected' : ''}>30 Menit</option>
                    <option value="45" ${this.sleepTimerMinutes === 45 ? 'selected' : ''}>45 Menit</option>
                    <option value="60" ${this.sleepTimerMinutes === 60 ? 'selected' : ''}>60 Menit</option>
                  </select>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-6);padding-top:var(--space-3);border-top:1px solid var(--line);">
                  <button class="rm-btn rm-btn-ghost" id="rm-btn-reset-audio">
                    Reset Default
                  </button>
                  <button class="rm-btn rm-btn-primary" id="rm-btn-test-settings">
                    ${icon('speaker')} Uji Pengaturan
                  </button>
                </div>
              </div>
            `}
          </div>
        </div>
      `;

      // Pasang listeners & draggable
      const modalEl = backdrop.querySelector('.rm-modal');
      const headerEl = backdrop.querySelector('.rm-modal-header');
      if (modalEl && headerEl) {
        makeDraggable(modalEl, headerEl);
      }
      backdrop.querySelector('.rm-modal-close').addEventListener('click', () => backdrop.remove());
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.remove();
      });

      backdrop.querySelector('#rm-tab-btn-voices').addEventListener('click', () => {
        this.activeSettingsTab = 'voices';
        renderModalContent();
      });

      backdrop.querySelector('#rm-tab-btn-audio').addEventListener('click', () => {
        this.activeSettingsTab = 'audio';
        renderModalContent();
      });

      if (this.activeSettingsTab === 'voices') {
        backdrop.querySelectorAll('.rm-voice-item').forEach(el => {
          el.addEventListener('click', (e) => {
            if (e.target.closest('.rm-btn-test-voice')) return;
            const voiceName = el.dataset.voiceName;
            const selected = this.voices.find(v => v.name === voiceName);
            if (selected) {
              this.setVoice(selected);
              renderModalContent();
            }
          });
        });

        backdrop.querySelectorAll('.rm-btn-test-voice').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const voiceName = btn.dataset.voiceName;
            const voice = this.voices.find(v => v.name === voiceName);
            if (voice) this.testVoiceAndAudio(voice);
          });
        });
      } else {
        // Audio controls
        const sliderPitch = backdrop.querySelector('#rm-slider-pitch');
        const valPitch = backdrop.querySelector('#rm-val-pitch');
        sliderPitch.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.setPitch(val);
          valPitch.textContent = `${val.toFixed(1)}× ${val === 1.0 ? '(Normal)' : val < 1.0 ? '(Berat/Bass)' : '(Tinggi)'}`;
        });

        const sliderRate = backdrop.querySelector('#rm-slider-rate');
        const valRate = backdrop.querySelector('#rm-val-rate');
        sliderRate.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.setRate(val);
          valRate.textContent = `${val.toFixed(2).replace('.', ',')}×`;
        });

        const sliderVol = backdrop.querySelector('#rm-slider-vol');
        const valVol = backdrop.querySelector('#rm-val-vol');
        sliderVol.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.setVolume(val);
          valVol.textContent = `${Math.round(val * 100)}%`;
        });

        const selectSleep = backdrop.querySelector('#rm-select-sleep');
        selectSleep.addEventListener('change', (e) => {
          this.setSleepTimer(parseInt(e.target.value, 10));
        });

        backdrop.querySelector('#rm-btn-reset-audio').addEventListener('click', () => {
          this.setPitch(1.0);
          this.setRate(1.0);
          this.setVolume(1.0);
          this.setSleepTimer(0);
          renderModalContent();
        });

        backdrop.querySelector('#rm-btn-test-settings').addEventListener('click', () => {
          this.testVoiceAndAudio(this.currentVoice);
        });
      }
    };

    renderModalContent();
    document.body.appendChild(backdrop);
    this.modalElement = backdrop;
  }

  renderVoiceItemHTML(v) {
    const isSelected = this.currentVoice && this.currentVoice.name === v.name;
    const isMicrosoft = /microsoft/i.test(v.name);
    const isGoogle = /google/i.test(v.name);
    const isNatural = /natural/i.test(v.name) || /online/i.test(v.name);

    return `
      <div class="rm-voice-item ${isSelected ? 'selected' : ''}" data-voice-name="${v.name}">
        <div class="rm-voice-info">
          <span class="rm-voice-name">${v.name.replace(/Online \(Natural\)/i, '(Natural)')}</span>
          <div class="rm-voice-badges">
            ${isMicrosoft ? '<span class="rm-badge rm-badge-ms">Microsoft</span>' : ''}
            ${isGoogle ? '<span class="rm-badge rm-badge-google">Google</span>' : ''}
            ${isNatural ? '<span class="rm-badge rm-badge-natural">Natural AI</span>' : ''}
            <span class="rm-badge">${v.lang}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-2);">
          <button class="rm-btn rm-btn-ghost rm-btn-test-voice" data-voice-name="${v.name}" style="height:28px;padding:0 8px;font-size:12px;" title="Coba dengarkan suara ini">
            Uji
          </button>
          ${isSelected ? `<span style="color:var(--pen);font-weight:bold;">${icon('check')}</span>` : ''}
        </div>
      </div>
    `;
  }

  getShortVoiceName(voice) {
    if (!voice) return 'Pilih Suara';
    let name = voice.name;
    name = name.replace(/Microsoft /i, 'MS ');
    name = name.replace(/Google /i, 'Google ');
    name = name.replace(/Online \(Natural\) - /i, '');
    name = name.replace(/- Indonesian \(Indonesia\)/i, '(ID)');
    name = name.replace(/- English \(United States\)/i, '(US)');
    return name.slice(0, 16);
  }

  setPageInfo(currentPage, totalPages) {
    this.pageInfo = { currentPage, totalPages };
    this.updatePlayerUI();
  }

  // Model Estimasi Garis Waktu Musik (Cumulative Timeline Table)
  buildTimeline() {
    const wpm = 150 * this.rate;
    const wordsPerSec = Math.max(0.5, wpm / 60);
    const startTimes = [];
    const durations = [];
    let accum = 0;

    for (const s of this.sentences) {
      const wordCount = Math.max(1, (s || '').trim().split(/\s+/).length);
      let d = wordCount / wordsPerSec;
      if (/[.?!]$/.test((s || '').trim())) d += 0.5 / this.rate;
      else if (/[,;:]$/.test((s || '').trim())) d += 0.3 / this.rate;
      else d += 0.2 / this.rate;

      startTimes.push(accum);
      durations.push(d);
      accum += d;
    }

    this.timeline = {
      startTimes,
      durations,
      totalDuration: Math.max(1, accum)
    };
  }

  formatTime(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  startProgressTicker() {
    this.stopProgressTicker();
    this.tickerId = setInterval(() => {
      if (!this.isPlaying || this.isUserDragging) return;
      this.updateProgressSlider();
    }, 150);
  }

  stopProgressTicker() {
    if (this.tickerId) {
      clearInterval(this.tickerId);
      this.tickerId = null;
    }
  }

  getCurrentPlaybackTime() {
    if (!this.timeline || !this.timeline.startTimes || this.timeline.startTimes.length === 0) {
      return 0;
    }
    const baseTime = this.timeline.startTimes[this.currentIndex] || 0;
    if (!this.sentenceStartTime || !this.isPlaying) return baseTime;
    const elapsed = (performance.now() - this.sentenceStartTime) / 1000;
    const maxSentenceDuration = this.timeline.durations[this.currentIndex] || 1;
    return Math.min(this.timeline.totalDuration, baseTime + Math.min(elapsed, maxSentenceDuration));
  }

  updateProgressSlider() {
    if (!this.playerElement) return;
    const curTime = this.getCurrentPlaybackTime();
    const totalTime = this.timeline?.totalDuration || 1;

    const slider = this.playerElement.querySelector('.rm-timeline-slider');
    if (slider && !this.isUserDragging) {
      slider.max = totalTime.toFixed(1);
      slider.value = curTime.toFixed(1);
      const pct = Math.min(100, Math.max(0, (curTime / totalTime) * 100));
      slider.style.background = `linear-gradient(to right, var(--pen) ${pct}%, var(--line-strong) ${pct}%)`;
    }

    const curLabel = this.playerElement.querySelector('.rm-time-cur');
    if (curLabel) curLabel.textContent = this.formatTime(curTime);

    const totalLabel = this.playerElement.querySelector('.rm-time-total');
    if (totalLabel) totalLabel.textContent = this.formatTime(totalTime);
  }

  seekToTime(targetSeconds) {
    if (!this.timeline || this.timeline.startTimes.length === 0) return;
    const clamped = Math.max(0, Math.min(targetSeconds, this.timeline.totalDuration));

    let low = 0;
    let high = this.timeline.startTimes.length - 1;
    let targetIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.timeline.startTimes[mid] <= clamped) {
        targetIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    this.speakSentence(targetIndex);
  }

  rewind(seconds = 10) {
    const cur = this.getCurrentPlaybackTime();
    const target = cur - seconds;
    if (target < 0 && this.onPrevPage) {
      this.onPrevPage();
    } else {
      this.seekToTime(Math.max(0, target));
    }
  }

  forward(seconds = 10) {
    const cur = this.getCurrentPlaybackTime();
    const target = cur + seconds;
    if (target >= (this.timeline?.totalDuration || 1) && this.onNextPage) {
      this.onNextPage();
    } else {
      this.seekToTime(Math.min(this.timeline?.totalDuration || 1, target));
    }
  }

  setSentences(sentences, startIndex = 0) {
    this.synth.cancel();
    this.stopProgressTicker();
    this.sentences = sentences || [];
    this.currentIndex = Math.max(0, Math.min(startIndex, Math.max(0, this.sentences.length - 1)));
    this.buildTimeline();
    this.updatePlayerUI();
    this.updateProgressSlider();
  }

  async play() {
    if (this.sentences.length === 0) {
      if (this.onNextPage) {
        await this.onNextPage();
      }
      return;
    }
    if (this.synth.paused) {
      this.synth.resume();
      this.isPlaying = true;
      this.sentenceStartTime = performance.now();
      this.startProgressTicker();
      this.updatePlayerUI();
      if (this.onStateChange) this.onStateChange(true);
      return;
    }

    this.speakSentence(this.currentIndex);
  }

  pause() {
    if (this.synth.speaking) {
      this.synth.pause();
      this.isPlaying = false;
      this.stopProgressTicker();
      this.updatePlayerUI();
      if (this.onStateChange) this.onStateChange(false);
    }
  }

  stop() {
    this.synth.cancel();
    this.isPlaying = false;
    this.stopProgressTicker();
    this.updatePlayerUI();
    this.updateProgressSlider();
    if (this.onStateChange) this.onStateChange(false);
    this.clearHighlight();
  }

  speakSentence(index) {
    if (index < 0 || index >= this.sentences.length) {
      this.stop();
      return;
    }

    this.synth.cancel();
    this.stopProgressTicker();
    this.currentIndex = index;
    const text = this.sentences[index];

    this.utterance = new SpeechSynthesisUtterance(text);
    if (this.currentVoice) this.utterance.voice = this.currentVoice;
    this.utterance.rate = this.rate;
    this.utterance.pitch = this.pitch;
    this.utterance.volume = this.volume;

    this.utterance.onstart = () => {
      this.isPlaying = true;
      this.sentenceStartTime = performance.now();
      this.startProgressTicker();
      this.updatePlayerUI();
      this.highlightSentence(text);
      if (this.onSentenceChange) this.onSentenceChange(index, text);
      if (this.onStateChange) this.onStateChange(true);
    };

    this.utterance.onend = async () => {
      this.stopProgressTicker();
      if (this.currentIndex + 1 < this.sentences.length) {
        this.speakSentence(this.currentIndex + 1);
      } else {
        // Halaman ini telah selesai dibacakan seluruh kalimatnya!
        if (this.onNextPage) {
          const advanced = await this.onNextPage();
          if (!advanced) {
            this.stop();
          }
        } else {
          this.stop();
        }
      }
    };

    this.utterance.onerror = (e) => {
      console.warn('TTS utterance error:', e);
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.stopProgressTicker();
      this.stop();
    };

    this.synth.speak(this.utterance);
  }

  async prev() {
    if (this.currentIndex > 0) {
      this.speakSentence(this.currentIndex - 1);
    } else if (this.onPrevPage) {
      await this.onPrevPage();
    }
  }

  async next() {
    if (this.currentIndex + 1 < this.sentences.length) {
      this.speakSentence(this.currentIndex + 1);
    } else if (this.onNextPage) {
      await this.onNextPage();
    }
  }

  cycleRate() {
    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(this.rate) + 1) % rates.length;
    this.setRate(rates[nextIdx]);
  }

  highlightSentence(sentence) {
    this.clearHighlight();
    if (!sentence) return;

    // Bersihkan karakter awalan simbol / nomor agar pencocokan teks akurat
    const cleanTarget = sentence
      .replace(/^[•\-\s\d.)]+/, '')
      .trim()
      .toLowerCase()
      .slice(0, 30);

    if (cleanTarget.length < 3) return;

    const textLayers = document.querySelectorAll('.rm-pdf-page .textLayer, section.docx p, .rm-docx-container p');

    for (const layer of textLayers) {
      if (layer.tagName === 'P') {
        if (layer.textContent.toLowerCase().includes(cleanTarget)) {
          layer.classList.add('rm-speaking');
          layer.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      } else {
        const spans = layer.querySelectorAll('span');
        for (const span of spans) {
          if (span.textContent.toLowerCase().includes(cleanTarget)) {
            span.classList.add('rm-speaking');
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
      }
    }
  }

  clearHighlight() {
    document.querySelectorAll('.rm-speaking').forEach(el => {
      el.classList.remove('rm-speaking');
    });
  }

  mountPlayer(container) {
    if (this.playerElement) this.playerElement.remove();

    const player = document.createElement('div');
    player.className = 'rm-player rm-floating-player';
    player.setAttribute('role', 'region');
    player.setAttribute('aria-label', 'Pemutar audio modul');

    player.innerHTML = `
      <!-- Baris 1: Scrubber Timeline Musik -->
      <div class="rm-player-timeline-row">
        <span class="rm-time-label rm-time-cur">00:00</span>
        <input type="range" class="rm-timeline-slider" min="0" max="100" step="0.5" value="0" aria-label="Posisi pemutaran">
        <span class="rm-time-label rm-time-total">00:00</span>
      </div>

      <!-- Baris 2: Kontrol Pemutar Musik & Metadata -->
      <div class="rm-player-controls-row">
        <div class="rm-player-meta" style="flex:1;cursor:grab;" title="Klik & seret untuk memindahkan pemutar">
          <b class="rm-tts-sentence-text">${this.sentences[this.currentIndex] || 'Bacakan Modul'}</b>
          <span class="rm-tts-voice-name">Kalimat ${this.currentIndex + 1} dari ${this.sentences.length || 1}</span>
        </div>

        <div class="rm-player-center-btns">
          <button class="rm-btn rm-btn-ghost rm-player-btn-seek rm-tts-rewind10" title="Mundur 10 detik (J atau ←)">
            -10s
          </button>
          <button class="rm-btn rm-btn-ghost rm-btn-icon rm-tts-prev" aria-label="Kalimat sebelumnya" title="Kalimat sebelumnya ([)">
            ${icon('prev')}
          </button>
          <button class="rm-player-play rm-tts-toggle" aria-label="Putar / Jeda" title="Putar / Jeda (Spasi)">
            ${this.isPlaying ? icon('pause') : icon('play')}
          </button>
          <button class="rm-btn rm-btn-ghost rm-btn-icon rm-tts-next" aria-label="Kalimat berikutnya" title="Kalimat berikutnya (])">
            ${icon('next')}
          </button>
          <button class="rm-btn rm-btn-ghost rm-player-btn-seek rm-tts-forward10" title="Maju 10 detik (L atau →)">
            +10s
          </button>
        </div>

        <div class="rm-player-right-btns">
          <button class="rm-chip rm-tts-voice-btn" title="Pilih Suara (Microsoft / Google)">
            ${this.getShortVoiceName(this.currentVoice)}
          </button>
          <button class="rm-btn rm-btn-ghost rm-btn-icon rm-tts-settings-btn" title="Pengaturan Nada & Audio">
            ${icon('sliders')}
          </button>
          <button class="rm-chip rm-tts-rate" aria-label="Kecepatan" title="Ubah Kecepatan">${this.rate.toString().replace('.', ',')}×</button>
          <button class="rm-btn rm-btn-ghost rm-btn-icon rm-tts-close" aria-label="Tutup pemutar" title="Tutup">
            ${icon('close')}
          </button>
        </div>
      </div>
    `;

    // Pasang scrubber events
    const slider = player.querySelector('.rm-timeline-slider');
    const curLabel = player.querySelector('.rm-time-cur');

    slider.addEventListener('input', (e) => {
      this.isUserDragging = true;
      const val = parseFloat(e.target.value);
      curLabel.textContent = this.formatTime(val);
      const total = this.timeline?.totalDuration || 1;
      const pct = Math.min(100, Math.max(0, (val / total) * 100));
      slider.style.background = `linear-gradient(to right, var(--pen) ${pct}%, var(--line-strong) ${pct}%)`;
    });

    slider.addEventListener('change', (e) => {
      this.isUserDragging = false;
      const targetSec = parseFloat(e.target.value);
      this.seekToTime(targetSec);
    });

    // Kontrol tombol
    player.querySelector('.rm-tts-rewind10').addEventListener('click', () => this.rewind(10));
    player.querySelector('.rm-tts-forward10').addEventListener('click', () => this.forward(10));
    player.querySelector('.rm-tts-prev').addEventListener('click', () => this.prev());
    player.querySelector('.rm-tts-toggle').addEventListener('click', () => {
      if (this.isPlaying) this.pause();
      else this.play();
    });
    player.querySelector('.rm-tts-next').addEventListener('click', () => this.next());
    player.querySelector('.rm-tts-voice-btn').addEventListener('click', () => this.openSettingsModal('voices'));
    player.querySelector('.rm-tts-settings-btn').addEventListener('click', () => this.openSettingsModal('audio'));
    player.querySelector('.rm-tts-rate').addEventListener('click', () => this.cycleRate());
    player.querySelector('.rm-tts-close').addEventListener('click', () => {
      this.stop();
      player.style.display = 'none';
    });

    // Dukungan drag pemutar melayang
    const metaEl = player.querySelector('.rm-player-meta');
    if (metaEl) {
      makeDraggable(player, metaEl);
    }

    this.keyListener = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (player.style.display === 'none') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.isPlaying) this.pause();
        else this.play();
      } else if (e.key === '[') {
        e.preventDefault();
        this.prev();
      } else if (e.key === ']') {
        e.preventDefault();
        this.next();
      } else if (e.key === 'j' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.rewind(10);
      } else if (e.key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.forward(10);
      }
    };
    window.addEventListener('keydown', this.keyListener);

    container.appendChild(player);
    this.playerElement = player;
    this.updateProgressSlider();
    return player;
  }

  updatePlayerUI() {
    if (!this.playerElement) return;

    const playBtn = this.playerElement.querySelector('.rm-tts-toggle');
    if (playBtn) {
      playBtn.innerHTML = this.isPlaying ? icon('pause') : icon('play');
      playBtn.setAttribute('aria-label', this.isPlaying ? 'Jeda' : 'Putar');
    }

    const textEl = this.playerElement.querySelector('.rm-tts-sentence-text');
    if (textEl && this.sentences[this.currentIndex]) {
      textEl.textContent = this.sentences[this.currentIndex];
    }

    const voiceEl = this.playerElement.querySelector('.rm-tts-voice-name');
    if (voiceEl) {
      const sentInfo = `Kalimat ${this.currentIndex + 1} dari ${this.sentences.length || 1}`;
      const pageInfo = this.pageInfo ? ` · Hal. ${this.pageInfo.currentPage} dari ${this.pageInfo.totalPages}` : '';
      voiceEl.textContent = sentInfo + pageInfo;
    }

    const voiceBtn = this.playerElement.querySelector('.rm-tts-voice-btn');
    if (voiceBtn) {
      voiceBtn.textContent = this.getShortVoiceName(this.currentVoice);
    }

    const rateBtn = this.playerElement.querySelector('.rm-tts-rate');
    if (rateBtn) {
      rateBtn.textContent = `${this.rate.toString().replace('.', ',')}×`;
    }

    this.updateProgressSlider();
  }

  destroy() {
    this.stop();
    this.stopProgressTicker();
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
    }
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
    }
    if (this.playerElement) {
      this.playerElement.remove();
      this.playerElement = null;
    }
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
  }
}
