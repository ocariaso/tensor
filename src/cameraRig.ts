import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CameraRules } from './dimensions';

const SPECTATOR_HOME = new THREE.Vector3(0, 1.2, 5.5);
const INHABITANT_HOME = new THREE.Vector3(0, 0, 5.5);
const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const PAN_LIMIT = 2;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private rules: CameraRules = { rotate: true, pan: 'free', zoom: true };
  private gliding = false;
  private readonly scratch = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
    this.camera.position.copy(SPECTATOR_HOME);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 40;
  }

  apply(rules: CameraRules): void {
    this.rules = rules;
    this.controls.enableRotate = rules.rotate;
    this.controls.enablePan = rules.pan !== 'none';
    this.controls.enableZoom = rules.zoom;
    // Without rotation the view must face the world straight on, so glide there first.
    this.gliding = !rules.rotate;
  }

  update(dt: number): void {
    if (this.gliding) {
      this.controls.enabled = false;
      const k = 1 - Math.exp(-dt * 4);
      this.camera.position.lerp(INHABITANT_HOME, k);
      this.controls.target.lerp(HOME_TARGET, k);
      this.camera.lookAt(this.controls.target);
      if (this.camera.position.distanceToSquared(INHABITANT_HOME) < 1e-5) {
        this.camera.position.copy(INHABITANT_HOME);
        this.controls.target.copy(HOME_TARGET);
        this.gliding = false;
      }
      return;
    }

    this.controls.enabled = true;
    this.controls.update(dt);
    if (this.rules.pan === 'x') this.constrainPanToX();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private constrainPanToX(): void {
    const target = this.controls.target;
    const offset = this.scratch.set(
      THREE.MathUtils.clamp(target.x, -PAN_LIMIT, PAN_LIMIT) - target.x,
      HOME_TARGET.y - target.y,
      HOME_TARGET.z - target.z,
    );
    target.add(offset);
    this.camera.position.add(offset);
  }
}
