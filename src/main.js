import * as THREE from 'three';
import { SoundManager } from './audio/SoundManager.js';
import { ClassroomScene } from './scene/ClassroomScene.js';
import { ProctorAI } from './ai/ProctorAI.js';
import { CheatSystem } from './mechanics/CheatSystem.js';
import { ExamHUD } from './ui/ExamHUD.js';

class GameController {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // Inisialisasi Subsistem
    this.sound = new SoundManager();
    this.scene = new ClassroomScene(this.container);
    this.proctor = new ProctorAI(this.scene.scene, this.scene.baseSeatedPosition);
    this.cheat = new CheatSystem(this.sound);
    this.hud = new ExamHUD(this.sound);

    this.clock = new THREE.Clock();

    // Key states
    this.keys = {
      e: false,
      d: false,
      space: false,
      mouseDown: false
    };

    // Callback toast
    this.cheat.onToastMessage = (msg, type) => this.hud.showToast(msg, type);

    this.setupInputs();
    this.setupGameLifecycle();
    this.startLoop();
  }

  setupGameLifecycle() {
    // Tombol Mulai Ujian
    this.hud.btnStart.addEventListener('click', () => {
      try {
        this.sound.ensureContext();
      } catch (e) {}

      this.hud.hideStartModal();
      this.cheat.startExam();
      this.scene.requestLock();
      window.focus();
      this.hud.showToast("Ujian dimulai! Tahan [E] (Kerepekan) atau [D] (Lirik Budi)!", "info");
    });

    // Tombol Restart
    const restartGame = () => {
      this.hud.hideEndModals();
      this.cheat.startExam();
      this.scene.drawPlayerLJK([], 1, 0, 'B', true);
      this.scene.requestLock();
      window.focus();
      this.hud.showToast("Ujian diulang! Jangan sampai ketahuan pengawas!", "warning");
    };

    if (this.hud.btnRestartGameOver) this.hud.btnRestartGameOver.addEventListener('click', restartGame);
    if (this.hud.btnRestartTimeout) this.hud.btnRestartTimeout.addEventListener('click', restartGame);
    if (this.hud.btnRestartVictory) this.hud.btnRestartVictory.addEventListener('click', restartGame);
  }

  setupInputs() {
    // Keyboard Event Listeners (E, D, Spasi)
    window.addEventListener('keydown', (e) => {
      if (!this.cheat.isExamActive) return;

      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyE' || key === 'e') {
        this.keys.e = true;
        this.evaluateActiveAction();
      } else if (code === 'KeyD' || key === 'd') {
        this.keys.d = true;
        this.evaluateActiveAction();
      } else if (code === 'Space' || key === ' ') {
        e.preventDefault();
        this.keys.space = true;
        this.evaluateActiveAction();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'KeyE' || key === 'e') {
        this.keys.e = false;
        this.evaluateActiveAction();
      } else if (code === 'KeyD' || key === 'd') {
        this.keys.d = false;
        this.evaluateActiveAction();
      } else if (code === 'Space' || key === ' ') {
        this.keys.space = false;
        this.evaluateActiveAction();
      }
    });

    // Mouse Click & Hold di Layar 3D
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.cheat.isExamActive) {
        const target = e.target;
        if (target && target.closest && (target.closest('#btn-cheat') || target.closest('#btn-peek') || target.closest('#btn-sound-toggle') || target.closest('#btn-start-game'))) {
          return;
        }
        this.keys.mouseDown = true;
        this.evaluateActiveAction();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.keys.mouseDown = false;
        this.evaluateActiveAction();
      }
    });

    // Interaktivitas Tombol UI di Layar Bawah (Bisa diklik & ditahan dengan mouse atau touch)
    const setupHoldButton = (btnId, keyName) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      const onStart = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (!this.cheat.isExamActive) return;
        this.keys[keyName] = true;
        this.evaluateActiveAction();
      };

      const onEnd = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.keys[keyName] = false;
        this.evaluateActiveAction();
      };

      btn.addEventListener('mousedown', onStart);
      btn.addEventListener('mouseup', onEnd);
      btn.addEventListener('mouseleave', onEnd);
      btn.addEventListener('touchstart', onStart, { passive: false });
      btn.addEventListener('touchend', onEnd);
      btn.addEventListener('touchcancel', onEnd);
    };

    setupHoldButton('btn-write', 'mouseDown');
    setupHoldButton('btn-cheat', 'e');
    setupHoldButton('btn-peek', 'd');
  }

  evaluateActiveAction() {
    if (!this.cheat.isExamActive) {
      this.cheat.setPlayerAction('IDLE');
      this.scene.setPeekingRight(false);
      return;
    }

    if (this.keys.e) {
      // 1. Tahan Kerepekan Kertas
      this.cheat.setPlayerAction('READING_NOTE');
      this.scene.setPeekingRight(false);
    } else if (this.keys.d) {
      // 2. Tahan Melirik Meja Budi
      this.cheat.setPlayerAction('PEEKING_RIGHT');
      this.scene.setPeekingRight(true);
    } else if (this.keys.mouseDown || this.keys.space) {
      // 3. Tahan Menulis LJK
      this.cheat.setPlayerAction('WRITING');
      this.scene.setPeekingRight(false);
    } else {
      // 4. Posisi Normal (IDLE)
      this.cheat.setPlayerAction('IDLE');
      this.scene.setPeekingRight(false);
    }
  }

  startLoop() {
    const animate = () => {
      requestAnimationFrame(animate);

      const delta = Math.min(this.clock.getDelta(), 0.1);
      const time = this.clock.getElapsedTime();

      // Update AI Pengawas
      this.proctor.update(delta, time);
      const proctorDetection = this.proctor.getDetectionState();

      // Update Mekanik Cheat System & Timer Ujian
      this.cheat.update(delta, proctorDetection);

      // Update Visual LJK di Meja 3D (hanya jika ada perubahan)
      const isWriting = (this.cheat.playerState === 'WRITING' && this.cheat.isCurrentAnswerKnown());
      const currentQ = this.cheat.getCurrentQuestion();
      if (currentQ) {
        this.scene.drawPlayerLJK(
          this.cheat.completedAnswers,
          currentQ.id,
          this.cheat.writingProgress,
          currentQ.correctAnswer
        );
      }

      // Update Render Scene 3D & Gerakan Kamera
      this.scene.update(delta, time, isWriting);

      // Update HUD Overlay
      this.hud.update(this.cheat, proctorDetection);
    };

    animate();
  }
}

// Inisialisasi Game
window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});
