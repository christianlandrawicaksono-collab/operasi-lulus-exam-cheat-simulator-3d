/**
 * ExamHUD
 * Mengatur tampilan UI overlay, meteran kecurigaan, timer countdown,
 * status pengerjaan soal, feedback visual peringatan merah, dan pop-up hasil ujian.
 */
export class ExamHUD {
  constructor(soundManager) {
    this.sound = soundManager;

    // DOM Elements
    this.timerEl = document.getElementById('hud-timer');
    this.suspicionBarEl = document.getElementById('hud-suspicion-bar');
    this.suspicionValEl = document.getElementById('hud-suspicion-val');
    this.suspicionIconEl = document.getElementById('suspicion-icon');
    this.suspicionVignetteEl = document.getElementById('suspicion-vignette');
    this.questionProgressEl = document.getElementById('hud-question-progress');
    
    this.currentQNumEl = document.getElementById('current-question-num');
    this.currentQTextEl = document.getElementById('current-question-text');
    this.answerKnownBadgeEl = document.getElementById('answer-known-badge');

    this.actionBannerEl = document.getElementById('action-banner');
    this.proctorAlertTagEl = document.getElementById('proctor-alert-tag');
    this.peekIndicatorEl = document.getElementById('peek-indicator');
    this.peekProgressTextEl = document.getElementById('peek-progress-text');

    // Kerepekan UI
    this.cheatPaperContainer = document.getElementById('cheat-paper-container');
    this.cheatReadingProgressEl = document.getElementById('cheat-reading-progress');
    this.cheatAnswersListEl = document.getElementById('cheat-answers-list');

    // Modals
    this.startModal = document.getElementById('start-modal');
    this.gameOverModal = document.getElementById('gameover-modal');
    this.gameoverReasonEl = document.getElementById('gameover-reason');
    this.failCountEl = document.getElementById('fail-completed-count');

    this.timeoverModal = document.getElementById('timeover-modal');
    this.timeoutCountEl = document.getElementById('timeout-completed-count');

    this.victoryModal = document.getElementById('victory-modal');

    // Buttons
    this.btnStart = document.getElementById('btn-start-game');
    this.btnRestartGameOver = document.getElementById('btn-restart-gameover');
    this.btnRestartTimeout = document.getElementById('btn-restart-timeout');
    this.btnRestartVictory = document.getElementById('btn-restart-victory');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');

    // Control buttons di footer
    this.btnWrite = document.getElementById('btn-write');
    this.btnCheat = document.getElementById('btn-cheat');
    this.btnPeek = document.getElementById('btn-peek');

    this.toastTimeout = null;

    this.initCheatAnswersUI();
    this.setupButtonListeners();
  }

  setupButtonListeners() {
    if (this.btnSoundToggle) {
      this.btnSoundToggle.addEventListener('click', () => {
        const isUnmuted = this.sound.toggleMute();
        this.btnSoundToggle.textContent = isUnmuted ? '🔊' : '🔇';
      });
    }
  }

  initCheatAnswersUI() {
    if (!this.cheatAnswersListEl) return;
    const cheatData = [
      { q: 1, text: "1. Balok 5kg, a=4 -> F = 5 * 4 = 20 N", opt: "B" },
      { q: 2, text: "2. Ek = 1/2 * 4 * (5^2) = 50 Joule", opt: "C" },
      { q: 3, text: "3. Hukum Ohm: V = I * R = 2 * 10 = 20 V", opt: "A" },
      { q: 4, text: "4. Bandul Sederhana: T = 2pi * akar(l/g)", opt: "D" },
      { q: 5, text: "5. Kecepatan Cahaya: c = 3 x 10^8 m/s", opt: "A" }
    ];

    this.cheatAnswersListEl.innerHTML = '';
    cheatData.forEach(item => {
      const row = document.createElement('div');
      row.id = `cheat-row-${item.q}`;
      row.className = 'flex justify-between items-center py-1 px-1.5 rounded border-b border-stone-300 filter blur transition-all duration-300';
      row.innerHTML = `
        <span class="text-stone-900 text-xs font-semibold">${item.text}</span>
        <span class="font-bold text-rose-700 bg-amber-200 px-1.5 py-0.5 rounded ml-2 border border-amber-300">[${item.opt}]</span>
      `;
      this.cheatAnswersListEl.appendChild(row);
    });
  }

  showToast(text, type = 'info') {
    if (!this.actionBannerEl) return;

    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.actionBannerEl.textContent = text;
    this.actionBannerEl.style.opacity = '1';
    this.actionBannerEl.className = 'mt-4 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-opacity duration-200 border shadow-lg ';

    if (type === 'warning') {
      this.actionBannerEl.className += 'bg-rose-900/90 text-rose-200 border-rose-500 animate-pulse';
    } else if (type === 'success') {
      this.actionBannerEl.className += 'bg-emerald-900/90 text-emerald-200 border-emerald-500';
    } else {
      this.actionBannerEl.className += 'bg-slate-900/90 text-indigo-300 border-indigo-500';
    }

    this.toastTimeout = setTimeout(() => {
      if (this.actionBannerEl) {
        this.actionBannerEl.style.opacity = '0';
      }
    }, 2500);
  }

  update(cheatSystem, proctorDetection) {
    // 1. Timer Format MM:SS
    const totalSec = Math.max(0, Math.ceil(cheatSystem.remainingTime));
    const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const secs = String(totalSec % 60).padStart(2, '0');
    this.timerEl.textContent = `${mins}:${secs}`;

    if (totalSec <= 15) {
      this.timerEl.className = 'font-mono text-xl md:text-2xl font-black text-rose-500 tracking-tight animate-pulse';
    } else {
      this.timerEl.className = 'font-mono text-xl md:text-2xl font-black text-amber-400 tracking-tight';
    }

    // 2. Suspicion Meter Bar & Vignette
    const suspicion = Math.round(cheatSystem.suspicion);
    this.suspicionValEl.textContent = `${suspicion}%`;
    this.suspicionBarEl.style.width = `${suspicion}%`;

    const vigOpacity = (suspicion / 100) * 0.95;
    document.body.style.setProperty('--suspicion-opacity', vigOpacity.toFixed(2));

    if (suspicion < 40) {
      this.suspicionBarEl.className = 'h-full rounded-full transition-all duration-150 ease-out bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
      this.suspicionValEl.className = 'font-mono text-sm text-emerald-400';
      this.suspicionIconEl.textContent = '👁️';
      document.body.classList.remove('danger-flash', 'shake-screen');
    } else if (suspicion < 75) {
      this.suspicionBarEl.className = 'h-full rounded-full transition-all duration-150 ease-out bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]';
      this.suspicionValEl.className = 'font-mono text-sm text-amber-400';
      this.suspicionIconEl.textContent = '⚠️';
      document.body.classList.remove('danger-flash', 'shake-screen');
    } else {
      this.suspicionBarEl.className = 'h-full rounded-full transition-all duration-150 ease-out bg-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.9)] animate-pulse';
      this.suspicionValEl.className = 'font-mono text-sm text-rose-500 font-bold';
      this.suspicionIconEl.textContent = '🚨';
      document.body.classList.add('danger-flash');
      if (suspicion > 88) {
        document.body.classList.add('shake-screen');
      } else {
        document.body.classList.remove('shake-screen');
      }
    }

    // Tag Peringatan Pengawas Mendekat
    if (proctorDetection.isPlayerInFOV && proctorDetection.distanceToPlayer < 4.5) {
      this.proctorAlertTagEl.style.display = 'flex';
      this.proctorAlertTagEl.classList.remove('hidden');
    } else {
      this.proctorAlertTagEl.style.display = 'none';
      this.proctorAlertTagEl.classList.add('hidden');
    }

    // 3. Status Soal & Progress Pengisian
    const completedCount = cheatSystem.completedAnswers.length;
    this.questionProgressEl.textContent = `${completedCount} / 5 Soal`;

    const currentQ = cheatSystem.getCurrentQuestion();
    if (currentQ) {
      this.currentQNumEl.textContent = `Soal #${currentQ.id}`;
      this.currentQTextEl.textContent = `"${currentQ.question}"`;

      const isKnown = cheatSystem.knownAnswers.has(currentQ.id);
      if (isKnown) {
        this.answerKnownBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
        this.answerKnownBadgeEl.textContent = `✓ Tahu (Opsi ${currentQ.correctAnswer})`;
      } else {
        this.answerKnownBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800';
        this.answerKnownBadgeEl.textContent = '❌ Belum Tahu';
      }
    } else {
      this.currentQNumEl.textContent = 'Selesai!';
      this.currentQTextEl.textContent = 'Semua 5 soal berhasil terisi!';
      this.answerKnownBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white';
      this.answerKnownBadgeEl.textContent = '✓ 100% Selesai';
    }

    // 4. Update Tampilan Kerepekan Kertas (Tombol E)
    if (cheatSystem.playerState === 'READING_NOTE') {
      this.cheatPaperContainer.style.transform = 'translate(-50%, 0)';
      this.cheatPaperContainer.style.opacity = '1';
      this.cheatPaperContainer.style.pointerEvents = 'auto';
      const prog = Math.round(cheatSystem.noteReadingProgress * 100);
      this.cheatReadingProgressEl.textContent = `Membaca... ${prog}%`;

      if (this.btnCheat) {
        this.btnCheat.classList.add('bg-sky-600', 'border-sky-400', 'scale-105');
      }
    } else {
      this.cheatPaperContainer.style.transform = 'translate(-50%, 120%)';
      this.cheatPaperContainer.style.opacity = '0';
      this.cheatPaperContainer.style.pointerEvents = 'none';

      if (this.btnCheat) {
        this.btnCheat.classList.remove('bg-sky-600', 'border-sky-400', 'scale-105');
      }
    }

    // Unblur teks contekan jika sudah dihafal
    for (let q = 1; q <= 5; q++) {
      const row = document.getElementById(`cheat-row-${q}`);
      if (row) {
        if (cheatSystem.knownAnswers.has(q)) {
          row.classList.remove('blur');
          row.classList.add('bg-emerald-100', 'border-emerald-400');
        } else {
          row.classList.add('blur');
          row.classList.remove('bg-emerald-100', 'border-emerald-400');
        }
      }
    }

    // 5. Update UI Melirik Kanan (Tombol D)
    if (cheatSystem.playerState === 'PEEKING_RIGHT') {
      this.peekIndicatorEl.style.display = 'flex';
      this.peekIndicatorEl.classList.remove('hidden');
      const peekPct = Math.round(cheatSystem.peekingProgress * 100);
      this.peekProgressTextEl.textContent = `${peekPct}%`;

      if (this.btnPeek) {
        this.btnPeek.classList.add('bg-emerald-600', 'border-emerald-400', 'scale-105');
      }
    } else {
      this.peekIndicatorEl.style.display = 'none';
      this.peekIndicatorEl.classList.add('hidden');

      if (this.btnPeek) {
        this.btnPeek.classList.remove('bg-emerald-600', 'border-emerald-400', 'scale-105');
      }
    }

    // 6. Highlight tombol tulis LJK jika sedang menulis
    if (this.btnWrite) {
      if (cheatSystem.playerState === 'WRITING') {
        this.btnWrite.classList.add('bg-amber-600', 'border-amber-400', 'scale-105');
      } else {
        this.btnWrite.classList.remove('bg-amber-600', 'border-amber-400', 'scale-105');
      }
    }

    // 7. Evaluasi Kondisi Akhir Game
    if (cheatSystem.isGameOver) {
      this.showGameOverModal(cheatSystem.gameOverReason, completedCount);
    } else if (cheatSystem.isVictory) {
      this.showVictoryModal();
    } else if (cheatSystem.isTimeUp) {
      this.showTimeOverModal(completedCount);
    }
  }

  showStartModal() {
    this.startModal.style.display = 'flex';
    this.startModal.classList.remove('hidden');
  }

  hideStartModal() {
    this.startModal.style.display = 'none';
    this.startModal.classList.add('hidden');
  }

  showGameOverModal(reason, completedCount) {
    this.gameOverModal.style.display = 'flex';
    this.gameOverModal.classList.remove('hidden');
    this.gameoverReasonEl.textContent = reason;
    this.failCountEl.textContent = `${completedCount} / 5`;
    document.body.classList.remove('danger-flash', 'shake-screen');
  }

  showTimeOverModal(completedCount) {
    this.timeoverModal.style.display = 'flex';
    this.timeoverModal.classList.remove('hidden');
    this.timeoutCountEl.textContent = `${completedCount} / 5`;
    document.body.classList.remove('danger-flash', 'shake-screen');
  }

  showVictoryModal() {
    this.victoryModal.style.display = 'flex';
    this.victoryModal.classList.remove('hidden');
    document.body.classList.remove('danger-flash', 'shake-screen');
  }

  hideEndModals() {
    this.gameOverModal.style.display = 'none';
    this.gameOverModal.classList.add('hidden');
    this.timeoverModal.style.display = 'none';
    this.timeoverModal.classList.add('hidden');
    this.victoryModal.style.display = 'none';
    this.victoryModal.classList.add('hidden');
  }
}
