uniform float uLevel;        // 0 = point, 1 = line, 2 = disc, 3 = sphere
uniform float uExtent;       // radius of the line and disc
uniform float uSphereRadius;
uniform float uSpin;         // radians about the vertical axis, kept within [-PI, PI]
uniform float uLatSegments;
uniform float uLonSegments;
uniform float uSpriteWorld;  // world-space width of one point sprite
uniform float uDensity;      // how many sprites may overlap one spot of the surface
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uOmega;
uniform float uAmplitude;
uniform float uWaveNumber;

varying vec3 vColor;
varying float vAlpha;

const float PI = 3.141592653589793;

void main() {
  float stretch = clamp(uLevel, 0.0, 1.0);
  float sweep = clamp(uLevel - 1.0, 0.0, 1.0);
  float wrap = clamp(uLevel - 2.0, 0.0, 1.0);

  // Latitude sets the distance from the center and longitude sets the final angle on the disc.
  float r = 1.0 - uv.y;
  float lineAngle = uv.x < 0.5 ? 0.0 : PI;
  float angle = mix(lineAngle, uv.x * 2.0 * PI, sweep);

  // Distance from the center measured along the surface, which wrapping preserves.
  float s = r * uExtent * stretch;

  // Raising the curvature rolls the disc into a sphere without stretching it.
  float curvature = wrap * PI / uExtent;
  float bend = s * curvature;
  float ringRadius = curvature > 1e-4 ? sin(bend) / curvature : s;
  float depth = curvature > 1e-4 ? (1.0 - cos(bend)) / curvature : 0.0;
  float scale = mix(1.0, uSphereRadius * PI / uExtent, wrap);
  vec3 p = vec3(cos(angle) * ringRadius, sin(angle) * ringRadius, wrap * uExtent / PI - depth) * scale;

  vec3 n = vec3(cos(angle) * sin(bend), sin(angle) * sin(bend), cos(bend));

  // The sphere tips its pole upright as it closes, then spins about that vertical axis.
  float tilt = -wrap * 0.5 * PI;
  mat3 tipUp = mat3(1.0, 0.0, 0.0, 0.0, cos(tilt), sin(tilt), 0.0, -sin(tilt), cos(tilt));
  float spin = uSpin * wrap;
  mat3 turn = mat3(cos(spin), 0.0, -sin(spin), 0.0, 1.0, 0.0, sin(spin), 0.0, cos(spin));
  p = turn * tipUp * p;
  n = turn * tipUp * n;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Surfaces seen edge-on pack more points per pixel, so they keep proportionally fewer.
  float facing = abs(dot(normalize(normalMatrix * n), normalize(-mvPosition.xyz)));

  // On the line only the first column per side is drawn because the rest share its spot.
  float column = floor(uv.x * uLonSegments + 0.5);
  bool representative = column == 0.0 || column == uLonSegments * 0.5;

  float seam = min(uv.x, 1.0 - uv.x);
  float meridian = smoothstep(0.012, 0.0, seam) * sweep;

  // Where sprites overlap, a random share of points is skipped so the surface stays evenly bright without dimming below one color step.
  float ringGap = uExtent * stretch / uLatSegments * scale;
  float arcGap = ringRadius * scale * sweep * 2.0 * PI / uLonSegments;
  // A closed sphere shows two layers, front and back, so each keeps half as many points.
  float layers = mix(1.0, 0.5, wrap);
  float overlap = min(1.0, arcGap / uSpriteWorld) * min(1.0, ringGap / uSpriteWorld);
  float surfaceChance = min(1.0, uDensity * overlap * layers * max(facing, 0.15));
  float keepChance = representative ? mix(1.0, surfaceChance, sweep) : surfaceChance;
  keepChance = max(keepChance, meridian);
  float hash = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
  float kept = hash < keepChance ? 1.0 : 0.0;

  float size = uPointSize * uPixelRatio * mix(0.4, 1.0, stretch);
  gl_PointSize = size * (8.0 / -mvPosition.z) * kept;

  // At the center this equals the 0D pulse, so every wave grows out of the singularity.
  float wave = 1.0 + uAmplitude * sin(uOmega * uTime - uWaveNumber * s);

  vec3 base = mix(vec3(0.35, 0.55, 1.0), vec3(0.75, 0.45, 1.0), r);
  vColor = mix(base, vec3(1.0, 0.72, 0.3), meridian) * wave;
  vAlpha = smoothstep(0.0, 0.08, stretch) * kept;
}
