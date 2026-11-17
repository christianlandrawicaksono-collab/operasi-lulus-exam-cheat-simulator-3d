import * as THREE from 'three';

/**
 * ClassroomScene
 * Mengelola lingkungan 3D ruang kelas, pencahayaan, objek meja pemain, LJK interaktif,
 * siswa NPC, dan kamera first-person seated view yang super responsif (Hybrid Control).
 */
export class ClassroomScene {
  constructor(containerElement) {
    this.container = containerElement;

    // Dimensi
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;

    // Three.js Core
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2130);
    this.scene.fog = new THREE.FogExp2(0x1a2130, 0.035);

    this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.1, 100);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Seated Camera Position (Pemain duduk di kursi)
    this.baseSeatedPosition = new THREE.Vector3(0, 1.22, 0);
    this.currentCameraPos = this.baseSeatedPosition.clone();
    this.camera.position.copy(this.currentCameraPos);

    // Rotasi leher (dalam radian)
    // Sumbu Y (yaw): negatif = nengok kanan (meja Budi), positif = nengok kiri (jendela)
    // Sumbu X (pitch): negatif = nunduk ke meja, positif = mendongak ke papan tulis
    this.yaw = 0;
    this.pitch = -0.22;
    this.targetYaw = 0;
    this.targetPitch = -0.22;

    // Batasan leher manusia saat duduk di kelas
    this.minYaw = -THREE.MathUtils.degToRad(85);   // Lirik kanan maksimal (meja Budi di x=2.2)
    this.maxYaw = THREE.MathUtils.degToRad(85);    // Lirik kiri maksimal (jendela kelas)
    this.minPitch = -THREE.MathUtils.degToRad(55); // Nunduk ke meja & LJK
    this.maxPitch = THREE.MathUtils.degToRad(30);  // Mendongak ke papan tulis & pengawas

    // State intip / peeking right
    this.isPeekingRight = false;
    this.peekLerp = 0;

    // Pointer Lock & Mouse tracking
    this.isPointerLocked = false;
    this.lastLjkStateKey = '';

    // Referensi objek interaktif
    this.ljkCanvas = null;
    this.ljkContext = null;
    this.ljkTexture = null;
    this.ljkMesh = null;
    this.penGroup = null;
    this.budiLjkMesh = null;
    this.clockHand = null;
    this.npcStudents = [];

    this.init();
  }

  init() {
    this.setupLighting();
    this.buildRoom();
    this.buildBlackboard();
    this.buildWallClock();
    this.buildDesksAndNPCs();
    this.setupPlayerDesk();
    this.setupEventListeners();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xfff3e0, 0.75);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    sunLight.position.set(-8, 9, 2);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 25;
    sunLight.shadow.bias = -0.001;
    this.scene.add(sunLight);

    const ceilingLights = [
      { x: -2, y: 3.8, z: -3 },
      { x: 2, y: 3.8, z: -3 },
      { x: -2, y: 3.8, z: 2 },
      { x: 2, y: 3.8, z: 2 }
    ];

    ceilingLights.forEach(pos => {
      const pLight = new THREE.PointLight(0xffffff, 0.45, 10, 2);
      pLight.position.set(pos.x, pos.y, pos.z);
      this.scene.add(pLight);

      const lampGeo = new THREE.BoxGeometry(0.8, 0.08, 0.2);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const lampMesh = new THREE.Mesh(lampGeo, lampMat);
      lampMesh.position.set(pos.x, pos.y + 0.05, pos.z);
      this.scene.add(lampMesh);
    });
  }

  buildRoom() {
    const floorSize = 20;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize, 20, 20);
    
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#b0b8c4';
    fctx.fillRect(0, 0, 512, 512);
    fctx.strokeStyle = '#828c9b';
    fctx.lineWidth = 4;
    const tileSize = 64;
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        if ((x / tileSize + y / tileSize) % 2 === 0) {
          fctx.fillStyle = '#bfc7d4';
          fctx.fillRect(x, y, tileSize, tileSize);
        }
        fctx.strokeRect(x, y, tileSize, tileSize);
      }
    }
    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 5);

    const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.6 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xded8c6, roughness: 0.9 });
    const wallBottomMat = new THREE.MeshStandardMaterial({ color: 0x47706d, roughness: 0.8 });

    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), wallMat);
    frontWall.position.set(0, 2.5, -7);
    this.scene.add(frontWall);

    const frontWallBase = new THREE.Mesh(new THREE.PlaneGeometry(20, 1), wallBottomMat);
    frontWallBase.position.set(0, 0.5, -6.99);
    this.scene.add(frontWallBase);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), wallMat);
    backWall.position.set(0, 2.5, 7);
    backWall.rotation.y = Math.PI;
    this.scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), wallMat);
    leftWall.position.set(-8, 2.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    const windowFrameGeo = new THREE.BoxGeometry(0.1, 2.2, 4);
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const windowFrame = new THREE.Mesh(windowFrameGeo, windowFrameMat);
    windowFrame.position.set(-7.95, 2.6, -1);
    this.scene.add(windowFrame);

    const glassGeo = new THREE.PlaneGeometry(3.8, 2.0);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x90caf9,
      transmission: 0.85,
      opacity: 0.7,
      transparent: true,
      roughness: 0.1
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(-7.92, 2.6, -1);
    glass.rotation.y = Math.PI / 2;
    this.scene.add(glass);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), wallMat);
    rightWall.position.set(8, 2.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);

    const ceilingGeo = new THREE.PlaneGeometry(20, 16);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf1f3f4, roughness: 0.9 });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.set(0, 4.5, 0);
    ceiling.rotation.x = Math.PI / 2;
    this.scene.add(ceiling);
  }

  buildBlackboard() {
    const boardGroup = new THREE.Group();
    const frameGeo = new THREE.BoxGeometry(6.4, 2.2, 0.08);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.7 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    boardGroup.add(frame);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e382b';
    ctx.fillRect(0, 0, 1024, 360);

    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.fillStyle = '#e8f5e9';
    ctx.textAlign = 'center';
    ctx.fillText('UJIAN AKHIR SEMESTER (UAS) FISIKA', 512, 70);

    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = '#fff9c4';
    ctx.fillText('WAKTU: 90 DETIK  |  JUMLAH SOAL: 5 NOMOR', 512, 120);

    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillStyle = '#ff8a80';
    ctx.fillText('⚠️ DILARANG MENYONTEK / MELIRIK TEMAN!', 512, 190);

    ctx.font = 'italic 18px sans-serif';
    ctx.fillStyle = '#cfd8dc';
    ctx.fillText('"Kejujuran adalah cerminan martabat seorang pelajar."', 512, 260);

    const boardTexture = new THREE.CanvasTexture(canvas);
    const boardMat = new THREE.MeshStandardMaterial({ map: boardTexture, roughness: 0.7 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.0), boardMat);
    board.position.z = 0.045;
    boardGroup.add(board);

    boardGroup.position.set(0, 2.6, -6.92);
    this.scene.add(boardGroup);
  }

  buildWallClock() {
    const clockGroup = new THREE.Group();
    const rimGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 32);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.4 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    clockGroup.add(rim);

    const faceGeo = new THREE.CircleGeometry(0.36, 32);
    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.045;
    clockGroup.add(face);

    const handGeo = new THREE.BoxGeometry(0.02, 0.28, 0.01);
    const handMat = new THREE.MeshBasicMaterial({ color: 0xd32f2f });
    this.clockHand = new THREE.Mesh(handGeo, handMat);
    this.clockHand.position.set(0, 0.1, 0.05);
    clockGroup.add(this.clockHand);

    clockGroup.position.set(0, 4.0, -6.9);
    this.scene.add(clockGroup);
  }

  createDeskMesh() {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xa06d42, roughness: 0.65 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.5, metalness: 0.6 });

    const topGeo = new THREE.BoxGeometry(1.2, 0.05, 0.7);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 0.75;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.75, 12);
    const legPositions = [
      [-0.55, 0.375, -0.3],
      [0.55, 0.375, -0.3],
      [-0.55, 0.375, 0.3],
      [0.55, 0.375, 0.3]
    ];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, metalMat);
      leg.position.set(...pos);
      leg.castShadow = true;
      group.add(leg);
    });

    const chairGroup = new THREE.Group();
    const seatGeo = new THREE.BoxGeometry(0.45, 0.04, 0.45);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.set(0, 0.45, 0.65);
    seat.castShadow = true;
    chairGroup.add(seat);

    const backGeo = new THREE.BoxGeometry(0.45, 0.35, 0.04);
    const back = new THREE.Mesh(backGeo, woodMat);
    back.position.set(0, 0.78, 0.85);
    back.castShadow = true;
    chairGroup.add(back);

    const chairLegGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
    const cLegPositions = [
      [-0.18, 0.225, 0.48],
      [0.18, 0.225, 0.48],
      [-0.18, 0.225, 0.82],
      [0.18, 0.225, 0.82]
    ];
    cLegPositions.forEach(pos => {
      const leg = new THREE.Mesh(chairLegGeo, metalMat);
      leg.position.set(...pos);
      leg.castShadow = true;
      chairGroup.add(leg);
    });

    group.add(chairGroup);
    return group;
  }

  createStudentNPC(shirtColor = 0x3b82f6) {
    const student = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const torsoGeo = new THREE.BoxGeometry(0.38, 0.45, 0.22);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.set(0, 0.75, 0.65);
    torso.castShadow = true;
    student.add(torso);

    const headGeo = new THREE.BoxGeometry(0.22, 0.24, 0.22);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.15, 0.63);
    head.castShadow = true;

    const hairGeo = new THREE.BoxGeometry(0.24, 0.08, 0.24);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.12;
    head.add(hair);

    student.add(head);
    student.userData.headMesh = head;

    const armGeo = new THREE.BoxGeometry(0.08, 0.32, 0.08);
    const armL = new THREE.Mesh(armGeo, shirtMat);
    armL.position.set(-0.24, 0.72, 0.52);
    armL.rotation.x = 0.6;
    student.add(armL);

    const armR = new THREE.Mesh(armGeo, shirtMat);
    armR.position.set(0.24, 0.72, 0.52);
    armR.rotation.x = 0.6;
    student.add(armR);

    return student;
  }

  buildDesksAndNPCs() {
    const cols = [-2.2, 0, 2.2];
    const rows = [-2.8, 0, 2.8];

    cols.forEach(x => {
      rows.forEach(z => {
        const desk = this.createDeskMesh();
        desk.position.set(x, 0, z);
        this.scene.add(desk);

        const isPlayerSeat = (x === 0 && z === 0);
        const isBudiSeat = (x === 2.2 && z === 0);

        if (!isPlayerSeat) {
          let shirtColor = 0xffffff;
          if (isBudiSeat) shirtColor = 0xe2e8f0;

          const student = this.createStudentNPC(shirtColor);
          student.position.set(x, 0, z);
          this.scene.add(student);
          this.npcStudents.push(student);

          if (isBudiSeat) {
            this.setupBudiDesk(x, z);
          }
        }
      });
    });

    const proctorDesk = this.createDeskMesh();
    proctorDesk.position.set(4.5, 0, -5.5);
    proctorDesk.rotation.y = Math.PI;
    this.scene.add(proctorDesk);
  }

  setupBudiDesk(bx, bz) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 720);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('LEMBAR JAWABAN UJIAN (LJK)', 60, 45);
    ctx.font = '16px monospace';
    ctx.fillText('NAMA: BUDI SANTOSO (XII-IPA 1)', 60, 75);
    ctx.fillText('STATUS: SELESAI (NILAI 100)', 60, 98);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 115);
    ctx.lineTo(472, 115);
    ctx.stroke();

    const budiAnswers = ['B', 'C', 'A', 'D', 'A'];
    const options = ['A', 'B', 'C', 'D'];

    ctx.font = 'bold 20px monospace';
    for (let q = 0; q < 5; q++) {
      const y = 170 + q * 70;
      ctx.fillStyle = '#1e293b';
      ctx.fillText(`NO. ${q + 1}:`, 50, y);

      options.forEach((opt, idx) => {
        const cx = 170 + idx * 75;
        const cy = y - 6;
        const radius = 22;

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (opt === budiAnswers[q]) {
          ctx.fillStyle = '#18181b';
          ctx.beginPath();
          ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(opt, cx, cy + 6);
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(opt, cx, cy + 5);
        }
      });
      ctx.textAlign = 'left';
    }

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#059669';
    ctx.fillText('★ KUNCI JAWABAN LENGKAP BUDI', 60, 560);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });

    const budiLjk = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.52), mat);
    budiLjk.rotation.x = -Math.PI / 2;
    budiLjk.rotation.z = 0.05;
    budiLjk.position.set(bx - 0.24, 0.776, bz - 0.05);
    budiLjk.receiveShadow = true;
    this.scene.add(budiLjk);
    this.budiLjkMesh = budiLjk;
  }

  setupPlayerDesk() {
    this.playerDeskGroup = new THREE.Group();

    // 1. Lembar Soal Ujian (Kiri Meja Pemain)
    const examQuestionCanvas = document.createElement('canvas');
    examQuestionCanvas.width = 512;
    examQuestionCanvas.height = 700;
    const qctx = examQuestionCanvas.getContext('2d');
    qctx.fillStyle = '#ffffff';
    qctx.fillRect(0, 0, 512, 700);

    qctx.fillStyle = '#000000';
    qctx.font = 'bold 22px serif';
    qctx.fillText('NASKAH SOAL UJIAN FISIKA', 80, 50);
    qctx.font = '14px serif';
    qctx.fillText('Petunjuk: Pilihlah jawaban A, B, C, atau D pada LJK.', 50, 85);

    qctx.strokeStyle = '#000';
    qctx.lineWidth = 1.5;
    qctx.beginPath();
    qctx.moveTo(40, 100);
    qctx.lineTo(472, 100);
    qctx.stroke();

    const questionsSummary = [
      '1. F = m * a jika m=5kg, a=4m/s^2, F=...?',
      '2. Energi Kinetik balok bermassa 4kg (v=5m/s)?',
      '3. Rangkaian Hambatan R=10 Ohm, Arus I=2A, V=...?',
      '4. Rumus Periode Bandul Sederhana T=...?',
      '5. Berapakah cepat rambat cahaya di ruang hampa?'
    ];

    questionsSummary.forEach((q, idx) => {
      qctx.font = 'bold 15px serif';
      qctx.fillText(q, 50, 140 + idx * 95);
      qctx.font = '13px serif';
      qctx.fillText('A. Pilihan   B. Pilihan   C. Pilihan   D. Pilihan', 65, 170 + idx * 95);
    });

    const qTexture = new THREE.CanvasTexture(examQuestionCanvas);
    const qMat = new THREE.MeshStandardMaterial({ map: qTexture, roughness: 0.85 });
    const questionPaper = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.44), qMat);
    questionPaper.rotation.x = -Math.PI / 2;
    questionPaper.position.set(-0.25, 0.776, -0.08);
    this.playerDeskGroup.add(questionPaper);

    // 2. Lembar Jawaban Komputer (LJK) Interaktif Pemain
    this.ljkCanvas = document.createElement('canvas');
    this.ljkCanvas.width = 512;
    this.ljkCanvas.height = 700;
    this.ljkContext = this.ljkCanvas.getContext('2d');
    this.drawPlayerLJK([], 1, 0, 'B', true);

    this.ljkTexture = new THREE.CanvasTexture(this.ljkCanvas);
    this.ljkTexture.anisotropy = 8;
    const ljkMat = new THREE.MeshStandardMaterial({ map: this.ljkTexture, roughness: 0.8 });
    this.ljkMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), ljkMat);
    this.ljkMesh.rotation.x = -Math.PI / 2;
    this.ljkMesh.rotation.z = 0.03;
    this.ljkMesh.position.set(0.12, 0.777, -0.05);
    this.playerDeskGroup.add(this.ljkMesh);

    // 3. Kotak Pensil & Gulungan Contekan
    const caseGeo = new THREE.BoxGeometry(0.24, 0.05, 0.1);
    const caseMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
    const pencilCaseMesh = new THREE.Mesh(caseGeo, caseMat);
    pencilCaseMesh.position.set(0.38, 0.795, -0.24);
    pencilCaseMesh.rotation.y = 0.2;
    this.playerDeskGroup.add(pencilCaseMesh);

    const cheatPaperGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.09, 16);
    const cheatPaperMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 });
    const cheatNoteMesh = new THREE.Mesh(cheatPaperGeo, cheatPaperMat);
    cheatNoteMesh.rotation.z = Math.PI / 2;
    cheatNoteMesh.rotation.y = 0.4;
    cheatNoteMesh.position.set(0.34, 0.785, -0.18);
    this.playerDeskGroup.add(cheatNoteMesh);

    // 4. Pulpen Pemain
    this.penGroup = new THREE.Group();
    const penBodyGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.16, 12);
    const penBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 });
    const penBody = new THREE.Mesh(penBodyGeo, penBodyMat);
    this.penGroup.add(penBody);

    const penTipGeo = new THREE.ConeGeometry(0.007, 0.025, 12);
    const penTipMat = new THREE.MeshStandardMaterial({ color: 0xd97706 });
    const penTip = new THREE.Mesh(penTipGeo, penTipMat);
    penTip.position.y = -0.09;
    penTip.rotation.x = Math.PI;
    this.penGroup.add(penTip);

    this.penGroup.position.set(0.32, 0.785, 0.08);
    this.penGroup.rotation.x = Math.PI / 2;
    this.penGroup.rotation.z = -0.4;
    this.playerDeskGroup.add(this.penGroup);

    this.scene.add(this.playerDeskGroup);
  }

  drawPlayerLJK(completedAnswers = [], activeQuestion = 1, currentFillProgress = 0, currentAttemptOpt = 'B', forceRedraw = false) {
    // Optimasi render: hanya gambar jika ada perubahan state
    const stateKey = `${completedAnswers.length}-${activeQuestion}-${Math.round(currentFillProgress * 20)}-${currentAttemptOpt}`;
    if (!forceRedraw && stateKey === this.lastLjkStateKey) return;
    this.lastLjkStateKey = stateKey;

    const ctx = this.ljkContext;
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 700);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('LEMBAR JAWABAN KOMPUTER (LJK)', 45, 45);
    ctx.font = '14px monospace';
    ctx.fillText('NAMA SISWA : PESERTA UJIAN', 45, 75);
    ctx.fillText('MATA UJIAN : FISIKA DASAR', 45, 95);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(30, 20, 452, 650);

    ctx.beginPath();
    ctx.moveTo(30, 115);
    ctx.lineTo(482, 115);
    ctx.stroke();

    const options = ['A', 'B', 'C', 'D'];

    for (let q = 1; q <= 5; q++) {
      const y = 170 + (q - 1) * 75;
      const isTarget = (q === activeQuestion);

      ctx.fillStyle = isTarget ? '#4338ca' : '#1e293b';
      ctx.font = isTarget ? 'bold 22px monospace' : 'bold 18px monospace';
      ctx.fillText(`SOAL ${q}:`, 50, y);

      const answered = completedAnswers.find(item => item.q === q);

      options.forEach((opt, idx) => {
        const cx = 175 + idx * 72;
        const cy = y - 6;
        const radius = 20;

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (answered && answered.opt === opt) {
          ctx.fillStyle = '#111827';
          ctx.beginPath();
          ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(opt, cx, cy + 6);
        } else if (isTarget && opt === currentAttemptOpt && currentFillProgress > 0) {
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(cx, cy, (radius - 2) * currentFillProgress, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = currentFillProgress > 0.6 ? '#ffffff' : '#475569';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(opt, cx, cy + 6);
        } else {
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(opt, cx, cy + 5);
        }
      });
      ctx.textAlign = 'left';
    }

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('*Hitamkan bulatan secara penuh dengan pensil 2B.', 50, 620);

    if (this.ljkTexture) {
      this.ljkTexture.needsUpdate = true;
    }
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());

    // Tracking pointer lock status
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === this.renderer.domElement || document.pointerLockElement === document.body);
    });

    // SISTEM MOUSE LOOK HYBRID (Bekerja 100% sempurna baik ada pointer lock maupun tanpa pointer lock!)
    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        // MODE 1: POINTER LOCK (FPS Look)
        const dx = e.movementX || 0;
        const dy = e.movementY || 0;
        const sens = 0.0032;

        this.targetYaw -= dx * sens;
        this.targetPitch -= dy * sens;
      } else {
        // MODE 2: FREE MOUSE LOOK (Orientasi Kepala Mengikuti Posisi Kursor di Layar)
        // Kursor di kanan -> nengok kanan (meja Budi)
        // Kursor di kiri -> nengok kiri (jendela)
        // Kursor di bawah -> nunduk ke meja (LJK)
        // Kursor di atas -> mendongak ke depan (papan tulis / pengawas)
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const factorX = (e.clientX - centerX) / (window.innerWidth * 0.48);
        const factorY = (e.clientY - centerY) / (window.innerHeight * 0.48);

        // Yaw: geser ke kanan (factorX > 0) -> targetYaw negatif
        this.targetYaw = -THREE.MathUtils.clamp(factorX, -1, 1) * THREE.MathUtils.degToRad(75);
        // Pitch: geser ke bawah (factorY > 0) -> targetPitch negatif (nunduk)
        this.targetPitch = -THREE.MathUtils.clamp(factorY, -1, 1) * THREE.MathUtils.degToRad(42) - 0.15;
      }

      // Batasi leher manusia
      this.targetYaw = THREE.MathUtils.clamp(this.targetYaw, this.minYaw, this.maxYaw);
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch, this.minPitch, this.maxPitch);
    });

    // Request pointer lock jika user klik canvas
    const requestLock = () => this.requestLock();
    this.renderer.domElement.addEventListener('click', requestLock);
  }

  requestLock() {
    try {
      const el = this.renderer.domElement;
      if (el && el.requestPointerLock) {
        el.requestPointerLock();
      }
    } catch (err) {}
  }

  onWindowResize() {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  setPeekingRight(isPeeking) {
    this.isPeekingRight = isPeeking;
  }

  animatePenWriting(isWriting, time) {
    if (!this.penGroup) return;
    if (isWriting) {
      this.penGroup.position.set(0.18 + Math.sin(time * 25) * 0.015, 0.785, -0.03 + Math.cos(time * 20) * 0.012);
      this.penGroup.rotation.x = Math.PI / 2.3;
      this.penGroup.rotation.z = -0.2 + Math.sin(time * 30) * 0.1;
    } else {
      this.penGroup.position.set(0.32, 0.785, 0.08);
      this.penGroup.rotation.x = Math.PI / 2;
      this.penGroup.rotation.z = -0.4;
    }
  }

  update(delta, time, isWriting = false) {
    // 1. Lerp rotasi leher kamera
    const lerpSpeed = 0.18;
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, lerpSpeed);
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, lerpSpeed);

    // 2. Efek Melirik Meja Budi di Kanan (PEEKING_RIGHT)
    const targetPeek = this.isPeekingRight ? 1.0 : 0.0;
    this.peekLerp = THREE.MathUtils.lerp(this.peekLerp, targetPeek, 0.14);

    // Posisi kamera condong ke kanan mendekati meja Budi (+x = kanan)
    const peekOffset = new THREE.Vector3(
      0.65 * this.peekLerp,
      -0.06 * this.peekLerp,
      -0.12 * this.peekLerp
    );
    this.camera.position.copy(this.baseSeatedPosition).add(peekOffset);

    // Jika sedang melirik kanan, arahkan pandangan tepat ke LJK meja Budi
    const activeYaw = this.yaw - (THREE.MathUtils.degToRad(38) * this.peekLerp);
    const activePitch = this.pitch - (THREE.MathUtils.degToRad(12) * this.peekLerp);

    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = activeYaw;
    this.camera.rotation.x = activePitch;

    // 3. Animasi jarum jam
    if (this.clockHand) {
      this.clockHand.rotation.z = -time * 0.5;
    }

    // 4. Animasi pulpen
    this.animatePenWriting(isWriting, time);

    // 5. Render adegan
    this.renderer.render(this.scene, this.camera);
  }
}
