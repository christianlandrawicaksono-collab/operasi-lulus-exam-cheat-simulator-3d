import * as THREE from 'three';

/**
 * ProctorAI
 * Mengelola karakter pengawas ujian 3D, siklus jalan patroli mengelilingi ruang kelas,
 * kalkulasi Field of View (FOV 60 derajat), deteksi Line of Sight (LOS) ke meja pemain,
 * dan kalkulasi resiko kecurigaan.
 */
export class ProctorAI {
  constructor(scene, playerPosition = new THREE.Vector3(0, 1.2, 0)) {
    this.scene = scene;
    this.playerPosition = playerPosition;

    // Model 3D Pengawas
    this.mesh = new THREE.Group();
    this.headMesh = null;
    this.leftArm = null;
    this.rightArm = null;
    this.leftLeg = null;
    this.rightLeg = null;

    // Titik-titik Patroli (Waypoints mengelilingi lorong-lorong kelas)
    this.waypoints = [
      new THREE.Vector3(4.2, 0, -5.2),   // Dekat meja pengawas depan kanan
      new THREE.Vector3(-4.2, 0, -5.2),  // Depan papan tulis kiri
      new THREE.Vector3(-4.2, 0, -1.0),  // Lorong kiri dekat meja murid depan
      new THREE.Vector3(-4.2, 0, 3.8),   // Lorong belakang kiri
      new THREE.Vector3(-1.1, 0, 3.8),   // Lorong belakang tengah
      new THREE.Vector3(-1.1, 0, 0.5),   // Lorong tengah dekat samping pemain!
      new THREE.Vector3(1.1, 0, 0.5),    // Lorong tengah antara pemain dan Budi!
      new THREE.Vector3(4.2, 0, 3.8),    // Belakang kanan
      new THREE.Vector3(4.2, 0, -1.0)    // Samping kanan
    ];

    this.currentWaypointIndex = 0;
    this.speed = 1.15; // Kecepatan langkah berjalan (m/s)

    // State Mesin Pengawas
    this.state = 'PATROLLING'; // 'PATROLLING', 'PAUSED_LOOKING', 'INSPECTING'
    this.pauseTimer = 0;
    this.pauseDuration = 0;

    // Variabel Deteksi & FOV
    this.fovAngle = THREE.MathUtils.degToRad(60); // 60 Derajat Field of View
    this.maxViewDistance = 8.5; // Jarak pandang pengawas
    this.forwardVector = new THREE.Vector3(0, 0, 1);

    // Hasil Deteksi Terkini
    this.detectionState = {
      isPlayerInFOV: false,
      distanceToPlayer: 99,
      isDirectlyLookingAtPlayer: false,
      visionFactor: 0 // 0 = tidak terlihat, 1 = tepat di tengah pandangan mata
    };

    this.walkCycle = 0;

    this.buildProctorModel();
    this.scene.add(this.mesh);

    // Tempatkan di waypoint pertama
    this.mesh.position.copy(this.waypoints[0]);
  }

  buildProctorModel() {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 }); // Kemeja batik / abu formal
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });  // Rompi gelap pengawas
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }); // Celana bahan hitam
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });

    // 1. Torso / Badan
    const torsoGeo = new THREE.BoxGeometry(0.48, 0.65, 0.28);
    const torso = new THREE.Mesh(torsoGeo, vestMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Kemeja di bawah rompi
    const collarGeo = new THREE.BoxGeometry(0.25, 0.1, 0.15);
    const collar = new THREE.Mesh(collarGeo, shirtMat);
    collar.position.set(0, 1.48, 0.08);
    this.mesh.add(collar);

    // 2. Kepala & Kacamata
    this.headMesh = new THREE.Group();
    const headBoxGeo = new THREE.BoxGeometry(0.26, 0.28, 0.26);
    const headBox = new THREE.Mesh(headBoxGeo, skinMat);
    headBox.castShadow = true;
    this.headMesh.add(headBox);

    // Rambut rapi
    const hairGeo = new THREE.BoxGeometry(0.28, 0.1, 0.28);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.13;
    this.headMesh.add(hair);

    // Kacamata Guru Pengawas
    const glassesFrameGeo = new THREE.BoxGeometry(0.22, 0.05, 0.02);
    const glassesMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const glasses = new THREE.Mesh(glassesFrameGeo, glassesMat);
    glasses.position.set(0, 0.02, 0.135);
    this.headMesh.add(glasses);

    // Hidung
    const noseGeo = new THREE.BoxGeometry(0.04, 0.06, 0.04);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, -0.02, 0.14);
    this.headMesh.add(nose);

    this.headMesh.position.set(0, 1.62, 0);
    this.mesh.add(this.headMesh);

    // 3. Lengan
    const armGeo = new THREE.BoxGeometry(0.12, 0.58, 0.12);
    this.leftArm = new THREE.Mesh(armGeo, shirtMat);
    this.leftArm.position.set(-0.32, 1.18, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, shirtMat);
    this.rightArm.position.set(0.32, 1.18, 0);
    this.rightArm.castShadow = true;

    // Clipboard / Map Pengawas di tangan kanan
    const boardGeo = new THREE.BoxGeometry(0.25, 0.32, 0.02);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    const clipboard = new THREE.Mesh(boardGeo, boardMat);
    clipboard.position.set(0, -0.2, 0.12);
    clipboard.rotation.x = 0.4;
    this.rightArm.add(clipboard);

    this.mesh.add(this.rightArm);

    // 4. Kaki
    const legGeo = new THREE.BoxGeometry(0.15, 0.72, 0.16);
    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.14, 0.45, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.14, 0.45, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    // Sepatu pantofel
    const shoeGeo = new THREE.BoxGeometry(0.16, 0.1, 0.22);
    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(0, -0.38, 0.03);
    this.leftLeg.add(shoeL);

    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0, -0.38, 0.03);
    this.rightLeg.add(shoeR);
  }

  /**
   * Update pergerakan patroli, rotasi, animasi tubuh dan kalkulasi FOV
   */
  update(delta, time) {
    if (this.state === 'PATROLLING') {
      this.updatePatrolMovement(delta);
    } else if (this.state === 'PAUSED_LOOKING') {
      this.updatePauseLook(delta, time);
    }

    // Kalkulasi Line of Sight dan FOV ke pemain
    this.calculateVisionDetection();
  }

  updatePatrolMovement(delta) {
    const targetWaypoint = this.waypoints[this.currentWaypointIndex];
    const currentPos = this.mesh.position;
    const dir = new THREE.Vector3().subVectors(targetWaypoint, currentPos);
    dir.y = 0; // Tetap di lantai
    const dist = dir.length();

    if (dist < 0.2) {
      // Sampai di waypoint, sesekali berhenti untuk melihat-lihat sekeliling kelas
      if (Math.random() < 0.35) {
        this.state = 'PAUSED_LOOKING';
        this.pauseDuration = 2.2 + Math.random() * 2.0; // Berhenti 2 - 4 detik
        this.pauseTimer = 0;
      }

      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % this.waypoints.length;
      return;
    }

    dir.normalize();

    // Rotasi badan menghadap arah gerak secara mulus
    const targetAngle = Math.atan2(dir.x, dir.z);
    // Smooth angle lerp
    let diff = targetAngle - this.mesh.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.mesh.rotation.y += diff * Math.min(1, delta * 6);

    // Geser posisi
    this.mesh.position.addScaledVector(dir, this.speed * delta);

    // Animasi Langkah Berjalan (Walk Cycle)
    this.walkCycle += delta * 8;
    const legAngle = Math.sin(this.walkCycle) * 0.45;
    this.leftLeg.rotation.x = legAngle;
    this.rightLeg.rotation.x = -legAngle;
    this.leftArm.rotation.x = -legAngle * 0.6;
    this.rightArm.rotation.x = legAngle * 0.6;

    // Reset rotasi kepala jika sedang patroli normal
    if (this.headMesh) {
      this.headMesh.rotation.y = THREE.MathUtils.lerp(this.headMesh.rotation.y, 0, 0.1);
    }
  }

  updatePauseLook(delta, time) {
    this.pauseTimer += delta;

    // Ayunan kepala menoleh ke kiri dan kanan mengawasi seisi kelas
    if (this.headMesh) {
      this.headMesh.rotation.y = Math.sin(time * 1.8) * 0.65;
    }

    // Istirahatkan kaki
    this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.15);
    this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.15);
    this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0, 0.15);
    this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0, 0.15);

    if (this.pauseTimer >= this.pauseDuration) {
      this.state = 'PATROLLING';
    }
  }

  /**
   * Menghitung apakah pemain berada di dalam Cone FOV 60° pengawas
   */
  calculateVisionDetection() {
    // Vektor dari mata pengawas ke pemain
    const proctorHeadPos = new THREE.Vector3(
      this.mesh.position.x,
      1.6,
      this.mesh.position.z
    );

    const toPlayer = new THREE.Vector3().subVectors(this.playerPosition, proctorHeadPos);
    const distance = toPlayer.length();
    this.detectionState.distanceToPlayer = distance;

    if (distance > this.maxViewDistance) {
      this.detectionState.isPlayerInFOV = false;
      this.detectionState.isDirectlyLookingAtPlayer = false;
      this.detectionState.visionFactor = 0;
      return;
    }

    // Arah hadap total kepala pengawas (rotasi badan + rotasi kepala)
    const totalRotationY = this.mesh.rotation.y + (this.headMesh ? this.headMesh.rotation.y : 0);
    this.forwardVector.set(Math.sin(totalRotationY), 0, Math.cos(totalRotationY)).normalize();

    // Arah horizontal ke pemain
    const toPlayerHoriz = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();

    // Sudut antara arah hadap pengawas dan posisi pemain (dot product)
    const dot = this.forwardVector.dot(toPlayerHoriz);
    const angleToPlayer = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));

    // Cek apakah sudut berada dalam setengah FOV (60° / 2 = 30° = 0.523 rad)
    const halfFov = this.fovAngle / 2;

    if (angleToPlayer <= halfFov) {
      this.detectionState.isPlayerInFOV = true;

      // Seberapa dekat tatapan pengawas tepat ke pemain (1 = persis di tengah bola mata, 0 = di pinggir FOV)
      const centerFactor = (halfFov - angleToPlayer) / halfFov;
      // Jarak juga mempengaruhi kejelasan pandangan (makin dekat makin jelas)
      const distanceFactor = Math.max(0.2, 1 - (distance / this.maxViewDistance));

      this.detectionState.visionFactor = centerFactor * distanceFactor;
      this.detectionState.isDirectlyLookingAtPlayer = (angleToPlayer < THREE.MathUtils.degToRad(18));
    } else {
      this.detectionState.isPlayerInFOV = false;
      this.detectionState.isDirectlyLookingAtPlayer = false;
      this.detectionState.visionFactor = 0;
    }
  }

  getDetectionState() {
    return this.detectionState;
  }

  getPosition() {
    return this.mesh.position;
  }
}
