import * as THREE from "three";

export type ReliefMaterialTone = "base" | "hover" | "selected";

const SURFACE_TONES: Record<
  ReliefMaterialTone,
  { brightness: number; contrast: number; tint: number; tintStrength: number }
> = {
  base: {
    brightness: 1.22,
    contrast: 1.05,
    tint: 0x5baac0,
    tintStrength: 0.46,
  },
  hover: {
    brightness: 1.24,
    contrast: 1.06,
    tint: 0xf2c94c,
    tintStrength: 0.12,
  },
  selected: {
    brightness: 1.24,
    contrast: 1.05,
    tint: 0xffc84a,
    tintStrength: 0.16,
  },
};

const WALL_TONES: Record<
  ReliefMaterialTone,
  {
    bottom: number;
    contact: number;
    middle: number;
    opacity: number;
    rim: number;
    top: number;
  }
> = {
  base: {
    bottom: 0x086e96,
    contact: 0x075777,
    middle: 0x117aa5,
    opacity: 1,
    rim: 0xe2fbff,
    top: 0x38add3,
  },
  hover: {
    bottom: 0x8b5b0a,
    contact: 0x4d3005,
    middle: 0xd49a1d,
    opacity: 1,
    rim: 0xfff4b0,
    top: 0xffd76a,
  },
  selected: {
    bottom: 0x8b5b0a,
    contact: 0x4d3005,
    middle: 0xd49a1d,
    opacity: 1,
    rim: 0xfff1a5,
    top: 0xffc846,
  },
};

/**
 * Opaque registered-terrain cap. The same aerial texel is colour-graded in
 * place rather than covered by a translucent polygon, so roads, rivers and
 * fields remain continuous between the ground and the raised surface.
 */
export function createTerrainSurfaceMaterial(
  texture: THREE.Texture,
  tone: ReliefMaterialTone,
) {
  const settings = SURFACE_TONES[tone];
  return new THREE.ShaderMaterial({
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    fragmentShader: `
      precision highp float;

      uniform sampler2D terrainMap;
      uniform vec3 surfaceTint;
      uniform float surfaceTintStrength;
      uniform float surfaceBrightness;
      uniform float surfaceContrast;
      uniform vec2 terrainUvOffset;
      uniform vec2 terrainUvScale;
      varying vec2 terrainUv;

      void main() {
        vec2 registeredUv = terrainUv * terrainUvScale + terrainUvOffset;
        vec3 terrain = texture2D(terrainMap, registeredUv).rgb;
        terrain = (terrain - 0.5) * surfaceContrast + 0.5;
        terrain *= surfaceBrightness;
        float luminance = dot(terrain, vec3(0.2126, 0.7152, 0.0722));
        vec3 gradedTint = surfaceTint * (0.34 + luminance * 0.78);
        terrain = mix(terrain, gradedTint, surfaceTintStrength);
        gl_FragColor = vec4(clamp(terrain, 0.0, 1.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
    uniforms: {
      surfaceBrightness: { value: settings.brightness },
      surfaceContrast: { value: settings.contrast },
      surfaceTint: { value: new THREE.Color(settings.tint) },
      surfaceTintStrength: { value: settings.tintStrength },
      terrainMap: { value: texture },
      terrainUvOffset: { value: new THREE.Vector2(0, 0) },
      terrainUvScale: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `
      varying vec2 terrainUv;

      void main() {
        terrainUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
}

/**
 * Stable opaque earth-wall material. The wall is real non-indexed prism
 * geometry; its colour changes only with vertical depth. Avoiding derivative
 * normals and high-frequency procedural bands prevents triangle seams,
 * moire, and black sub-pixel flicker along complex administrative rings.
 */
export function createGeologicalWallMaterial(
  _texture: THREE.Texture,
  tone: ReliefMaterialTone,
) {
  const settings = WALL_TONES[tone];
  return new THREE.ShaderMaterial({
    depthWrite: true,
    side: THREE.FrontSide,
    fragmentShader: `
      precision highp float;

      uniform vec3 wallTop;
      uniform vec3 wallMiddle;
      uniform vec3 wallBottom;
      uniform vec3 wallContact;
      uniform vec3 wallRim;
      uniform float wallOpacity;

      varying vec2 wallUv;
      varying float directionalShade;

      void main() {
        float depth = clamp(wallUv.y, 0.0, 1.0);
        vec3 geological = mix(wallTop, wallMiddle, smoothstep(0.04, 0.36, depth));
        geological = mix(geological, wallBottom, smoothstep(0.42, 0.9, depth));
        geological = mix(geological, wallContact, smoothstep(0.86, 1.0, depth) * 0.38);
        float topRim = 1.0 - smoothstep(0.0, 0.045, depth);
        geological = mix(geological, wallRim, topRim * 0.72);
        geological *= directionalShade;

        gl_FragColor = vec4(geological, wallOpacity);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
    transparent: settings.opacity < 1,
    uniforms: {
      wallBottom: { value: new THREE.Color(settings.bottom) },
      wallContact: { value: new THREE.Color(settings.contact) },
      wallMiddle: { value: new THREE.Color(settings.middle) },
      wallOpacity: { value: settings.opacity },
      wallRim: { value: new THREE.Color(settings.rim) },
      wallTop: { value: new THREE.Color(settings.top) },
    },
    vertexShader: `
      attribute float wallShade;
      varying vec2 wallUv;
      varying float directionalShade;

      void main() {
        wallUv = uv;
        directionalShade = wallShade;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
  });
}
