import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { isLocked, type CameraRules } from './dimensions';

const HOME_POSITION = new THREE.Vector3(0, 1.2, 5.5);
const HOME_TARGET = new THREE.Vector3(0, 0, 0);

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private returningHome = false;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
    this.camera.position.copy(HOME_POSITION);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 40;
  }

  apply(rules: CameraRules): void {
    this.controls.enableRotate = rules.rotate;
    this.controls.enablePan = rules.pan;
    this.controls.enableZoom = rules.zoom;
    // A fully locked camera glides back to the home pose instead of freezing wherever it was.
    this.returningHome = isLocked(rules);
  }

  update(dt: number): void {
    if (this.returningHome) {
      const k = 1 - Math.exp(-dt * 4);
      this.camera.position.lerp(HOME_POSITION, k);
      this.controls.target.lerp(HOME_TARGET, k);
      if (this.camera.position.distanceToSquared(HOME_POSITION) < 1e-6) {
        this.camera.position.copy(HOME_POSITION);
        this.controls.target.copy(HOME_TARGET);
      }
    }
    this.controls.update(dt);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
