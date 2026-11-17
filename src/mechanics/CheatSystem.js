import * as THREE from 'three';

/**
 * CheatSystem
 * Mengelola state pemain, daftar soal, kunci jawaban yang sudah dihafal,
 * progress pengisian LJK, timer ujian 90 detik, dan kalkulasi Suspicion Meter.
 */
export class CheatSystem {
  constructor(soundManager) {
    this.sound = soundManager;

    // State Interaksi Pemain: 'IDLE', 'WRITING', 'READING_NOTE', 'PEEKING_RIGHT'
    this.playerState = 'IDLE';

    // Timer Ujian (90 detik)
    this.totalExamTime = 90;
    this.remainingTime = 90;
    this.isExamActive = false;

    // Suspicion Meter (0% s/d 100%)
    this.suspicion = 0;
    this.maxSuspicion = 100;

    // Soal Ujian (5 Soal Fisika)
    this.questions = [
      {
        id: 1,
        question: "Sebuah balok bermassa 5kg ditarik dengan percepatan 4 m/s². Berapakah gaya total F?",
        options: { A: "10 N", B: "20 N", C: "25 N", D: "40 N" },
        correctAnswer: "B"
      },
      {
        id: 2,
        question: "Benda bermassa 4kg bergerak dengan kelajuan 5 m/s. Hitung Energi Kinetik (Ek) benda!",
        options: { A: "20 J", B: "40 J", C: "50 J", D: "100 J" },
        correctAnswer: "C"
      },
      {
        id: 3,
        question: "Sebuah resistor 10 Ohm dialiri arus listrik 2 Ampere. Beda potensialnya (V) adalah...?",
        options: { A: "20 Volt", B: "5 Volt", C: "12 Volt", D: "0.2 Volt" },
        correctAnswer: "A"
      },
      {
        id: 4,
        question: "Rumus manakah yang menyatakan periode ayunan bandul sederhana yang benar?",
        options: { A: "T = 2π√(g/l)", B: "T = m * g", C: "T = 1/2 * k * x", D: "T = 2π√(l/g)" },
        correctAnswer: "D"
      },
      {
        id: 5,
        question: "Berapakah konstanta cepat rambat cahaya (c) dalam ruang hampa udara?",
        options: { A: "3 × 10⁸ m/s", B: "3 × 10⁶ m/s", C: "330 m/s", D: "9.8 m/s²" },
        correctAnswer: "A"
      }
    ];

    // Status Progres Pengerjaan
    this.currentQuestionIndex = 0; // 0 = Soal #1
    this.completedAnswers = [];    // [{ q: 1, opt: 'B' }, ...]
    this.knownAnswers = new Set(); // Kunci jawaban yang sudah dihafal pemain
    
    // Kecepatan Aksi (Responsif & Seru)
    this.writingProgress = 0;
    this.writingSpeed = 0.85; // ~1.1 detik untuk mengisi 1 bulatan LJK

    this.noteReadingProgress = 0;
    this.noteReadingSpeed = 1.15; // ~0.85 detik tahan [E] untuk menghafal kunci berikutnya

    this.peekingProgress = 0;
    this.peekingSpeed = 1.05; // ~0.95 detik tahan [D] untuk mengintip LJK Budi

    // Status Game
    this.isGameOver = false;
    this.gameOverReason = '';
    this.isVictory = false;
    this.isTimeUp = false;

    // Callback untuk notifikasi UI
    this.onToastMessage = null;
    this.onAnswerLearned = null;
  }

  startExam() {
    this.isExamActive = true;
    this.remainingTime = this.totalExamTime;
    this.suspicion = 0;
    this.isGameOver = false;
    this.gameOverReason = '';
    this.isVictory = false;
    this.isTimeUp = false;
    this.currentQuestionIndex = 0;
    this.completedAnswers = [];
    this.knownAnswers.clear();
    this.writingProgress = 0;
    this.noteReadingProgress = 0;
    this.peekingProgress = 0;
    this.playerState = 'IDLE';
  }

  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] || null;
  }

  isCurrentAnswerKnown() {
    const currentQ = this.getCurrentQuestion();
    return currentQ ? this.knownAnswers.has(currentQ.id) : false;
  }

  setPlayerAction(action) {
    if (!this.isExamActive || this.isGameOver || this.isVictory) return;
    
    // Suara gemerisik kertas saat membuka contekan
    if (action === 'READING_NOTE' && this.playerState !== 'READING_NOTE') {
      this.sound.playPaperRustle();
    }

    // Suara pensil saat menulis LJK
    if (action === 'WRITING' && this.playerState !== 'WRITING') {
      if (this.isCurrentAnswerKnown()) {
        this.sound.startWritingSound();
      } else {
        if (this.onToastMessage) {
          this.onToastMessage("⚠️ Kamu belum tahu jawabannya! Tahan [E] (Kerepekan) atau [D] (Lirik Budi)!", "warning");
        }
      }
    }

    if (this.playerState === 'WRITING' && action !== 'WRITING') {
      this.sound.stopWritingSound();
    }

    this.playerState = action;
  }

  update(delta, proctorDetection) {
    if (!this.isExamActive || this.isGameOver || this.isVictory) return;

    // 1. Countdown Timer
    this.remainingTime -= delta;
    if (this.remainingTime <= 0) {
      this.remainingTime = 0;
      this.triggerTimeUp();
      return;
    }

    // 2. Evaluasi Aksi Pemain
    this.handlePlayerActionLogic(delta);

    // 3. Kalkulasi Suspicion Meter (Kecurigaan Pengawas)
    this.calculateSuspicion(delta, proctorDetection);

    // 4. Update audio heartbeat
    this.sound.updateHeartbeat(this.suspicion);
  }

  handlePlayerActionLogic(delta) {
    const currentQ = this.getCurrentQuestion();
    if (!currentQ) return;

    // Aksi 1: Menulis Jawaban di LJK (Klik Kiri / Spasi)
    if (this.playerState === 'WRITING') {
      if (this.isCurrentAnswerKnown()) {
        this.writingProgress += this.writingSpeed * delta;
        if (this.writingProgress >= 1.0) {
          this.writingProgress = 0;
          this.completedAnswers.push({
            q: currentQ.id,
            opt: currentQ.correctAnswer
          });
          this.sound.playQuestionComplete();

          if (this.onToastMessage) {
            this.onToastMessage(`✓ Soal #${currentQ.id} selesai terisi!`, 'success');
          }

          this.currentQuestionIndex++;
          if (this.currentQuestionIndex >= this.questions.length) {
            this.triggerVictory();
          }
        }
      } else {
        this.writingProgress = 0;
      }
    } else {
      this.writingProgress = Math.max(0, this.writingProgress - delta * 0.8);
    }

    // Aksi 2: Buka Kerepekan (Tombol E)
    if (this.playerState === 'READING_NOTE') {
      this.noteReadingProgress += this.noteReadingSpeed * delta;
      if (this.noteReadingProgress >= 1.0) {
        this.noteReadingProgress = 0;
        this.learnNextAnswer('Kerepekan Kertas');
      }
    } else {
      this.noteReadingProgress = Math.max(0, this.noteReadingProgress - delta * 1.5);
    }

    // Aksi 3: Melirik Meja Budi (Tombol D)
    if (this.playerState === 'PEEKING_RIGHT') {
      this.peekingProgress += this.peekingSpeed * delta;
      if (this.peekingProgress >= 1.0) {
        this.peekingProgress = 0;
        this.learnNextAnswer('LJK Budi');
      }
    } else {
      this.peekingProgress = Math.max(0, this.peekingProgress - delta * 1.5);
    }
  }

  learnNextAnswer(sourceName) {
    const currentQ = this.getCurrentQuestion();
    let targetQ = null;

    if (currentQ && !this.knownAnswers.has(currentQ.id)) {
      targetQ = currentQ;
    } else {
      targetQ = this.questions.find(q => !this.knownAnswers.has(q.id));
    }

    if (targetQ) {
      this.knownAnswers.add(targetQ.id);
      this.sound.playIdeaChime();

      if (this.onToastMessage) {
        this.onToastMessage(`💡 Hafal Jawaban Soal #${targetQ.id}: Opsi (${targetQ.correctAnswer}) dari ${sourceName}! Segera tulis!`, 'info');
      }
      if (this.onAnswerLearned) {
        this.onAnswerLearned(targetQ.id, targetQ.correctAnswer);
      }
    } else {
      if (this.onToastMessage) {
        this.onToastMessage(`✓ Semua kunci jawaban sudah diketahui! Tahan Klik / Spasi untuk mengisi LJK!`, 'info');
      }
    }
  }

  calculateSuspicion(delta, proctorDetection) {
    const { isPlayerInFOV, distanceToPlayer, isDirectlyLookingAtPlayer, visionFactor } = proctorDetection;

    let suspicionDelta = 0;
    const isCheating = (this.playerState === 'READING_NOTE' || this.playerState === 'PEEKING_RIGHT');

    if (isCheating) {
      if (isPlayerInFOV) {
        // TERTANGKAP MATA PENGAWAS!
        const severity = 38 + (visionFactor * 60);
        suspicionDelta = severity * delta;
      } else {
        // Pengawas membelakangi pemain
        suspicionDelta = 2 * delta;
      }
    } else if (this.playerState === 'WRITING') {
      if (isDirectlyLookingAtPlayer && distanceToPlayer < 2.2) {
        suspicionDelta = 4 * delta;
      } else {
        suspicionDelta = -12 * delta;
      }
    } else {
      // IDLE / Duduk diam bersikap wajar
      suspicionDelta = -20 * delta;
    }

    this.suspicion = THREE.MathUtils.clamp(this.suspicion + suspicionDelta, 0, this.maxSuspicion);

    if (this.suspicion >= 100) {
      this.triggerGameOver(
        this.playerState === 'READING_NOTE'
          ? "Pengawas melihatmu membuka gulungan contekan di bawah meja!"
          : this.playerState === 'PEEKING_RIGHT'
          ? "Pengawas melihat lehermu condong mengintip lembar jawaban Budi!"
          : "Pengawas melihat gerak-gerikmu yang sangat mencurigakan!"
      );
    }
  }

  triggerGameOver(reason) {
    this.isExamActive = false;
    this.isGameOver = true;
    this.gameOverReason = reason;
    this.sound.playCaughtWhistle();
  }

  triggerVictory() {
    this.isExamActive = false;
    this.isVictory = true;
    this.sound.playVictoryJingle();
  }

  triggerTimeUp() {
    this.isExamActive = false;
    this.isTimeUp = true;
    this.sound.playCaughtWhistle();
  }
}
