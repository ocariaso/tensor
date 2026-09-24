import type * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

/** A text tag pinned to a point in the scene. */
export class Label {
  readonly object: CSS2DObject;
  private readonly el: HTMLDivElement;

  constructor(text: string, variant = '') {
    this.el = document.createElement('div');
    this.el.className = `label ${variant}`.trim();
    this.el.textContent = text;
    this.object = new CSS2DObject(this.el);
  }

  setText(text: string): void {
    if (this.el.textContent !== text) this.el.textContent = text;
  }

  setColor(color: string): void {
    this.el.style.color = color;
  }

  update(position: THREE.Vector3, opacity: number): void {
    this.object.position.copy(position);
    this.object.visible = opacity > 0.01;
    this.el.style.opacity = opacity.toFixed(3);
  }
}

export function createLabelRenderer(): CSS2DRenderer {
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'label-layer';
  document.body.appendChild(renderer.domElement);
  return renderer;
}
