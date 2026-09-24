uniform float uPresence;

varying float vPulse;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0; // 0 at center, 1 at the sprite edge
  if (d > 1.0) discard;

  float core = smoothstep(0.22, 0.0, d);
  float halo = pow(1.0 - d, 2.0) * 0.8;
  float energy = core + halo;
  // The fade lives only in alpha because additive blending already multiplies color by it.
  vec3 color = mix(vec3(0.55, 0.45, 1.0), vec3(1.0, 0.94, 0.82), core / max(energy, 1e-4));

  gl_FragColor = vec4(color * vPulse, min(energy, 1.0) * uPresence);
}
