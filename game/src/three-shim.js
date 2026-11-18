// Re-export the vendored UMD three.js global as an ES module namespace,
// so game modules can `import * as THREE from './three-shim.js'`.
const T = window.THREE;
const {
  Scene, PerspectiveCamera, WebGLRenderer, ACESFilmicToneMapping, SRGBColorSpace,
  Fog, Color, Vector2, Vector3, Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry,
  CylinderGeometry, ConeGeometry, TorusGeometry, CircleGeometry, OctahedronGeometry,
  MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial,
  CanvasTexture, TextureLoader, DirectionalLight, HemisphereLight, PointLight, SpotLight,
  AmbientLight, Sprite, SpriteMaterial, Raycaster, Clock, MathUtils,
  DoubleSide, BackSide, FrontSide,
} = T;
export {
  Scene, PerspectiveCamera, WebGLRenderer, ACESFilmicToneMapping, SRGBColorSpace,
  Fog, Color, Vector2, Vector3, Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry,
  CylinderGeometry, ConeGeometry, TorusGeometry, CircleGeometry, OctahedronGeometry,
  MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial,
  CanvasTexture, TextureLoader, DirectionalLight, HemisphereLight, PointLight, SpotLight,
  AmbientLight, Sprite, SpriteMaterial, Raycaster, Clock, MathUtils,
  DoubleSide, BackSide, FrontSide,
};
export default T;
