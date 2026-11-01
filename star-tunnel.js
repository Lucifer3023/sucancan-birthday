/* Camera-local 3D stellar flight. Both the heads and trails are point particles. */
(() => {
  'use strict';

  const sharedVertex = `
    precision highp float;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aAlpha;
    attribute float aSeed;
    uniform float uDensity;
    varying vec3 vColor;
    varying float vFade;
    uniform float uViewportHeight;
    uniform float uPixelRatio;
    vec2 viewportSize() {
      float aspect = abs(projectionMatrix[1][1] / projectionMatrix[0][0]);
      return vec2(uViewportHeight * aspect, uViewportHeight);
    }
    float distanceFade(float depth) {
      return 0.26 + 0.74 * pow(1.0 - clamp(depth / 150.0, 0.0, 1.0), 0.6);
    }
  `;

  const headVertex = sharedVertex + `
    void main() {
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = clamp(aSize * uViewportHeight / max(0.6, -viewPosition.z), 1.8 * uPixelRatio, 8.0 * uPixelRatio);
      vColor = aColor;
      vFade = aAlpha * distanceFade(-viewPosition.z) * smoothstep(aSeed-.05,aSeed+.05,uDensity);
    }
  `;

  const headFragment = `
    precision highp float;
    varying vec3 vColor;
    varying float vFade;
    uniform float uOpacity;
    void main() {
      vec2 point = gl_PointCoord * 2.0 - 1.0;
      float r2 = dot(point, point);
      if (r2 > 1.0) discard;
      float light = (exp(-r2 * 10.0) + exp(-r2 * 3.7) * 0.25)
        * (1.0 - smoothstep(0.72, 1.0, r2));
      gl_FragColor = vec4(vColor * 2.4, light * vFade * uOpacity);
    }
  `;

  const trailVertex = sharedVertex + `
    uniform float uWorldTrail;
    uniform float uMaxTrail;
    varying vec2 vHeadScreen;
    varying vec2 vTailScreen;
    varying float vLength;
    void main() {
      vec4 headView = modelViewMatrix * vec4(position, 1.0);
      vec4 tailView = modelViewMatrix * vec4(position.x, position.y, position.z - uWorldTrail, 1.0);
      vec4 headClip = projectionMatrix * headView;
      vec4 tailClip = projectionMatrix * tailView;
      vec2 viewport = viewportSize();
      vec2 headNdc = headClip.xy / max(0.1, headClip.w);
      vec2 tailNdc = tailClip.xy / max(0.1, tailClip.w);
      vec2 deltaScreen = (headNdc - tailNdc) * viewport * 0.5;
      float lengthPixels = length(deltaScreen);
      float cappedLength = min(lengthPixels, uMaxTrail);
      vec2 direction = deltaScreen / max(lengthPixels, 0.001);
      vHeadScreen = (headNdc * 0.5 + 0.5) * viewport;
      vTailScreen = vHeadScreen - direction * cappedLength;
      vec2 centerNdc = ((vHeadScreen + vTailScreen) / viewport) - 1.0;
      gl_Position = headClip;
      gl_Position.xy = centerNdc * headClip.w;
      gl_PointSize = max(3.0 * uPixelRatio, cappedLength + 7.0 * uPixelRatio);
      vLength = cappedLength;
      vColor = aColor;
      vFade = aAlpha * distanceFade(-headView.z) * smoothstep(aSeed-.05,aSeed+.05,uDensity);
    }
  `;

  const trailFragment = `
    precision highp float;
    varying vec3 vColor;
    varying float vFade;
    varying vec2 vHeadScreen;
    varying vec2 vTailScreen;
    varying float vLength;
    uniform float uOpacity;
    uniform float uPixelRatio;
    void main() {
      if (vLength < 1.0) discard;
      vec2 line = vHeadScreen - vTailScreen;
      vec2 fromTail = gl_FragCoord.xy - vTailScreen;
      float along = clamp(dot(fromTail, line) / max(dot(line, line), 0.001), 0.0, 1.0);
      float distanceToLine = length(fromTail - line * along);
      float width = uPixelRatio * (0.65 + 0.25 * along);
      float transverse = exp(-distanceToLine * distanceToLine / max(0.1, width * width));
      float taper = pow(along, 0.7);
      float visibility = smoothstep(0.5, 12.0 * uPixelRatio, vLength);
      float alpha = transverse * taper * visibility * vFade * uOpacity * 0.66;
      gl_FragColor = vec4(vColor * 2.05, alpha);
    }
  `;

  function create(THREE, options = {}) {
    if (!THREE?.Points || !THREE?.ShaderMaterial) throw new TypeError('StarTunnel requires THREE.');
    const mobile = Boolean(options.mobile);
    const count = mobile ? 2000 : 4000;
    const group = new THREE.Group(); group.name = 'Through the stars'; group.visible = false;
    const forward = new THREE.Vector3(0, 0, -1), aimDirection = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3(), inverseCameraRotation = new THREE.Quaternion();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const velocities = new Float32Array(count);
    let seed = 0x22f17a9;
    function random() {
      seed += 0x6d2b79f5;
      let n = seed;
      n = Math.imul(n ^ n >>> 15, n | 1);
      n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    }

    function placeAcrossCylinder(index) {
      const i = index * 3;
      const angle = random() * Math.PI * 2;
      const centerColumn = random() < .22;
      const radial = centerColumn ? .045 + Math.sqrt(random()) * .17 : .15 + Math.sqrt(random()) * .85;
      positions[i] = Math.cos(angle) * radial * 18;
      positions[i + 1] = Math.sin(angle) * radial * 12;
    }
    for (let index = 0; index < count; index++) {
      const i = index * 3;
      placeAcrossCylinder(index);
      positions[i + 2] = -.65 - Math.pow(random(), 1.2) * 139.35;
      const warm = random() < .045;
      const white = random() < .35;
      colors[i] = warm ? 1.0 : white ? .87 : .62 + random() * .16;
      colors[i + 1] = warm ? .83 : white ? .94 : .81 + random() * .12;
      colors[i + 2] = warm ? .60 : 1.0;
      sizes[index] = .045 + Math.pow(random(), 1.5) * .115;
      alphas[index] = .46 + random() * .47;
      velocities[index] = .72 + random() * .62;
    }

    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(Array.from({length:count},()=>random()),1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -70), 74);

    const uniforms = {
      uOpacity: { value: 0 },
      uDensity: { value: 1 },
      uStretch: { value: 1 },
      uViewportHeight: { value: 1000 },
      uPixelRatio: { value: 1 },
      uWorldTrail: { value: 12 },
      uMaxTrail: { value: mobile ? 90 : 140 }
    };
    function material(vertexShader, fragmentShader) {
      return new THREE.ShaderMaterial({
        vertexShader, fragmentShader, uniforms,
        transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending, toneMapped: false
      });
    }
    const trailMaterial = material(trailVertex, trailFragment);
    const headMaterial = material(headVertex, headFragment);
    const trails = new THREE.Points(geometry, trailMaterial);
    const heads = new THREE.Points(geometry, headMaterial);
    trails.name = 'Perspective stellar trails'; heads.name = 'Incoming star cores';
    trails.frustumCulled = heads.frustumCulled = false;
    trails.renderOrder = 50; heads.renderOrder = 51;
    group.add(trails, heads);

    return {
      group, uniforms, heads, trails, count,
      aimAt(worldTarget, camera) {
        camera.getWorldPosition(cameraPosition);
        camera.getWorldQuaternion(inverseCameraRotation).invert();
        aimDirection.subVectors(worldTarget, cameraPosition);
        if (aimDirection.lengthSq() < 1e-12) return;
        aimDirection.normalize().applyQuaternion(inverseCameraRotation);
        group.quaternion.setFromUnitVectors(forward, aimDirection);
      },
      resetAim() { group.quaternion.identity(); },
      update(time, delta = 0) {
        const power = Math.max(0, Number.isFinite(uniforms.uOpacity.value) ? uniforms.uOpacity.value : 0);
        group.visible = power > .001 && uniforms.uDensity.value > .001;
        if (!group.visible) return;
        const dt = Math.max(0, Math.min(.06, Number.isFinite(delta) ? delta : 0));
        const speed = 60 + 140 * Math.min(1, power);
        uniforms.uWorldTrail.value = (8 + speed * .105) * Math.max(.06,uniforms.uStretch.value);
        for (let index = 0; index < count; index++) {
          const z = index * 3 + 2;
          positions[z] += speed * velocities[index] * dt;
          if (positions[z] > -.6) {
            positions[z] = -140 + random() * 7;
            placeAcrossCylinder(index);
          }
        }
        positionAttribute.needsUpdate = true;
      },
      resize(cssHeight, pixelRatio = 1) {
        const ratio = Math.min(2, Math.max(.5, Number.isFinite(pixelRatio) ? pixelRatio : 1));
        uniforms.uViewportHeight.value = Math.max(100, Number.isFinite(cssHeight) ? cssHeight : 800) * ratio;
        uniforms.uPixelRatio.value = ratio;
        uniforms.uMaxTrail.value = Math.min(230, (mobile ? 90 : 140) * ratio);
      },
      dispose() { geometry.dispose(); headMaterial.dispose(); trailMaterial.dispose(); group.clear(); }
    };
  }

  window.StarTunnel = Object.freeze({ create });
})();
