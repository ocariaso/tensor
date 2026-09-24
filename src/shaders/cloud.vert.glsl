uniform float uCollapse;   // 1 = full shape, 0 = collapsed to the origin
uniform float uPointSize;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 p = position * uCollapse;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Points shrink while collapsing to avoid a white glare at the center.
  float size = uPointSize * uPixelRatio * mix(0.2, 1.0, uCollapse);
  gl_PointSize = size * (8.0 / -mvPosition.z);

  // Latitude gradient plus an amber meridian stripe so rotation is readable.
  vec3 base = mix(vec3(0.25, 0.45, 1.0), vec3(0.7, 0.35, 1.0), uv.y);
  float seamDistance = min(uv.x, 1.0 - uv.x);
  float meridian = smoothstep(0.02, 0.0, seamDistance);
  vColor = mix(base, vec3(1.0, 0.72, 0.3), meridian);

  vAlpha = smoothstep(0.0, 0.08, uCollapse);
}
