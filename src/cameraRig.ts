import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CameraRules } from './dimensions';

const SPECTATOR_HOME = new THREE.Vector3(0, 1.2, 7);
const INHABITANT_HOME = new THREE.Vector3(0, 0, 7);
const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const PAN_LIMIT = 2;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private rules: CameraRules = { rotate: true, pan: 'free', zoom: true };
  private gliding = false;
  private readonly glidePosition = new THREE.Vector3();
  private readonly glideTarget = new THREE.Vector3();
  private readonly scratch = new THREE.Vector3();

  constructor(surface: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200);
    this.camera.position.copy(SPECTATOR_HOME);

    this.controls = new OrbitControls(this.camera, surface);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 60;
  }

  apply(rules: CameraRules): void {
    this.rules = rules;
    this.controls.enableRotate = rules.rotate;
    this.controls.enablePan = rules.pan !== 'none';
    this.controls.enableZoom = rules.zoom;
    // Without rotation the view must face the world straight on, so glide there first.
    if (!rules.rotate) this.glideTo(INHABITANT_HOME, HOME_TARGET);
  }

  glideTo(position: THREE.Vector3, target: THREE.Vector3): void {
    this.glidePosition.copy(position);
    this.glideTarget.copy(target);
    this.gliding = true;
  }

  glideHome(): void {
    this.glideTo(SPECTATOR_HOME, HOME_TARGET);
  }

  update(dt: number): void {
    if (this.gliding) {
      this.controls.enabled = false;
      const k = 1 - Math.exp(-dt * 4);
      this.camera.position.lerp(this.glidePosition, k);
      this.controls.target.lerp(this.glideTarget, k);
      this.camera.lookAt(this.controls.target);
      if (this.camera.position.distanceToSquared(this.glidePosition) < 1e-5) {
        this.camera.position.copy(this.glidePosition);
        this.controls.target.copy(this.glideTarget);
        this.gliding = false;
      }
      return;
    }

    this.controls.enabled = true;
    this.controls.update(dt);
    if (this.rules.pan === 'x' || this.rules.pan === 'xy') this.constrainPan(this.rules.pan);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private constrainPan(axes: 'x' | 'xy'): void {
    const target = this.controls.target;
    const y = axes === 'xy' ? THREE.MathUtils.clamp(target.y, -PAN_LIMIT, PAN_LIMIT) : HOME_TARGET.y;
    const offset = this.scratch.set(
      THREE.MathUtils.clamp(target.x, -PAN_LIMIT, PAN_LIMIT) - target.x,
      y - target.y,
      HOME_TARGET.z - target.z,
    );
    target.add(offset);
    this.camera.position.add(offset);
  }
}
