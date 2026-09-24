uniform float uOpacity;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float falloff = smoothstep(0.5, 0.0, d);
  // Low opacity keeps the dense edges from washing out to white.
  gl_FragColor = vec4(vColor, falloff * vAlpha * uOpacity);
}
