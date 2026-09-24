uniform float uTime;
uniform float uOmega;      // angular frequency ω
uniform float uAmplitude;  // pulse depth, 0..1
uniform float uBaseSize;   // pixels
uniform float uPixelRatio;
uniform float uPresence;   // 0 = hidden, 1 = fully formed

varying float vPulse;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

  // f(t) = sin(ωt) drives both scale and luminance.
  float pulse = 1.0 + uAmplitude * sin(uOmega * uTime);
  vPulse = pulse;

  // A 0D point has no size, so zooming never changes it.
  gl_PointSize = uBaseSize * uPixelRatio * pulse * uPresence;
}
