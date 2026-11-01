/* A geographic globe of pearl-like light grains and sparse, slowly catching star facets. */
(() => {
  'use strict';
  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;

  const vertexShader = `
    precision highp float;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aAlpha;
    attribute float aPhase;
    attribute float aKind;
    uniform float uTime;
    uniform float uViewportHeight;
    uniform float uMinPoint;
    uniform float uMaxPoint;
    uniform float uSizeBoost;
    uniform float uAtmosphere;
    uniform float uGlint;
    uniform float uBody;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vFacing;
    varying float vFlare;
    varying float vTurn;
    void main() {
      vec3 normal = normalize(position);
      vec3 displaced = position + normal * sin(uTime * 0.5 + aPhase) * 0.0007;
      vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
      vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
      vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
      vFacing = dot(worldNormal, viewDirection);
      vec4 viewPosition = viewMatrix * worldPosition;
      gl_Position = projectionMatrix * viewPosition;
      float sizeFactor = uAtmosphere > 0.5 ? 0.7 : 1.0;
      // Independent slow phases let a few facets catch the light at a time.
      // There is no advancing latitude band or synchronized globe-wide pulse.
      float beat = .5 + .5 * sin(uTime * (.76 + fract(aPhase * 1.73) * .48) + aPhase * 8.0);
      vFlare = pow(beat, 16.0);
      float pointSize = aSize * uSizeBoost * sizeFactor * uViewportHeight / max(0.1, -viewPosition.z);
      if (uGlint > .5) pointSize *= .62 + .78 * vFlare;
      gl_PointSize = clamp(pointSize, uMinPoint, uMaxPoint);
      vTurn = aPhase * .29;
      vColor = aColor;
      if (aKind > .5 && uAtmosphere < .5 && uGlint < .5) {
        float pearl = step(.80, fract(aPhase * 2.13));
        float lilac = step(.95, fract(aPhase * 3.17));
        vColor = mix(vColor, vec3(.80, .94, 1.0), pearl * .16);
        vColor = mix(vColor, vec3(.73, .72, 1.0), lilac * .12);
      }
      vColor *= mix(vec3(1.0), vec3(.42, .76, 1.0), uBody);
      float shimmer = .88 + .12 * sin(uTime * .68 + aPhase * 7.0);
      float tinyCatch = pow(.5 + .5 * sin(uTime * .91 + aPhase * 13.0), 8.0);
      vAlpha = aAlpha * (shimmer + tinyCatch * .13);
      if (uGlint > .5) vAlpha = aAlpha * (.035 + .965 * vFlare);
    }
  `;

  const fragmentShader = `
    precision highp float;
    uniform float uOpacity;
    uniform float uAtmosphere;
    uniform float uBrightness;
    uniform float uGlint;
    varying vec3 vColor;
    varying float vAlpha;
    varying float vFacing;
    varying float vFlare;
    varying float vTurn;
    void main() {
      vec2 point = gl_PointCoord * 2.0 - 1.0;
      float radius2 = dot(point, point);
      if (radius2 > 1.0) discard;
      // Bright pinpoints sit inside separate translucent pearls, rather than
      // allowing every neighbouring blue halo to merge into a painted surface.
      float core = exp(-radius2 * 16.0);
      float softGlow = exp(-radius2 * 4.2) * .085;
      float shape = (core + softGlow) * (1.0 - smoothstep(0.7, 1.0, radius2));
      // The far side remains barely visible instead of mixing up continents.
      float front = 0.006 + 0.994 * smoothstep(-0.01, 0.22, vFacing);
      if (uAtmosphere > 0.5) {
        float rim = pow(max(0.0, 1.0 - abs(vFacing)), 3.2);
        front = rim;
        shape = (exp(-radius2 * 8.0) * 0.42 + exp(-radius2 * 3.5) * 0.42)
          * (1.0 - smoothstep(0.7, 1.0, radius2));
      }
      if (uGlint > .5) {
        float cs = cos(vTurn), sn = sin(vTurn);
        vec2 jewel = mat2(cs, -sn, sn, cs) * point;
        float vertical = exp(-jewel.x * jewel.x * 430.0 - abs(jewel.y) * 2.5);
        float horizontal = exp(-jewel.y * jewel.y * 430.0 - abs(jewel.x) * 2.5);
        vec2 diagonal = mat2(.70710678, -.70710678, .70710678, .70710678) * jewel;
        float shortFacet = exp(-diagonal.x * diagonal.x * 540.0 - abs(diagonal.y) * 6.0);
        core = exp(-radius2 * 54.0);
        shape = (core * 1.18 + (vertical + horizontal) * (.35 + .30 * vFlare)
          + shortFacet * .15 + exp(-radius2 * 5.0) * .035)
          * (1.0 - smoothstep(.62, 1.0, radius2));
        // Geographic star facets never shine through the opposite hemisphere.
        front = smoothstep(.015, .24, vFacing);
      }
      gl_FragColor = vec4(vColor * uBrightness * (1.0 + core * 0.14), shape * vAlpha * front * uOpacity);
    }
  `;

  function extractPolygons(geojson) {
    const polygons = [];
    function visit(value) {
      if (!value) return;
      if (value.type === 'FeatureCollection') value.features.forEach(visit);
      else if (value.type === 'Feature') visit(value.geometry);
      else if (value.type === 'GeometryCollection') value.geometries.forEach(visit);
      else if (value.type === 'Polygon') polygons.push(value.coordinates);
      else if (value.type === 'MultiPolygon') polygons.push(...value.coordinates);
    }
    visit(geojson);
    return polygons;
  }

  function prepareRing(coordinates) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let crossesDateline = false;
    const unwrapped = [];
    for (let i = 1; i < coordinates.length; i++) {
      const previous = coordinates[i - 1], current = coordinates[i];
      const poleSeam = Math.abs(previous[1]) > 89.999 && Math.abs(current[1]) > 89.999;
      if (!poleSeam && Math.abs(current[0] - previous[0]) > 180) crossesDateline = true;
    }
    const points = coordinates.map((coordinate, i) => {
      let x = coordinate[0];
      if (crossesDateline && i) {
        const previous = coordinates[i - 1][0];
        // Accumulate the shortest longitude step across the dateline.
        let step = coordinate[0] - previous;
        while (step > 180) step -= 360;
        while (step < -180) step += 360;
        x = unwrapped[i - 1] + step;
      }
      unwrapped[i] = x;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, coordinate[1]); maxY = Math.max(maxY, coordinate[1]);
      return [x, coordinate[1]];
    });
    return { points, minX, maxX, minY, maxY, center: (minX + maxX) / 2 };
  }
  function insideRing(x, y, ring) {
    x += 360 * Math.round((ring.center - x) / 360);
    if (x < ring.minX || x > ring.maxX || y < ring.minY || y > ring.maxY) return false;
    const points = ring.points;
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  function createClassifier(rawPolygons) {
    const polygons = rawPolygons.filter(polygon => polygon[0]?.length > 2).map(polygon => ({
      outer: prepareRing(polygon[0]), holes: polygon.slice(1).map(prepareRing)
    }));
    const bins = Array.from({ length: 18 }, () => []);
    polygons.forEach(polygon => {
      const first = Math.max(0, Math.min(17, Math.floor((polygon.outer.minY + 90) / 10)));
      const last = Math.max(0, Math.min(17, Math.floor((polygon.outer.maxY + 90) / 10)));
      for (let bin = first; bin <= last; bin++) bins[bin].push(polygon);
    });
    return (longitude, latitude) => {
      const bin = Math.max(0, Math.min(17, Math.floor((latitude + 90) / 10)));
      for (const polygon of bins[bin]) {
        if (insideRing(longitude, latitude, polygon.outer) && !polygon.holes.some(hole => insideRing(longitude, latitude, hole))) return true;
      }
      return false;
    };
  }

  function unitPoint(lon, lat) {
    const latitude = lat * DEG, longitude = lon * DEG;
    const c = Math.cos(latitude);
    return [c * Math.cos(longitude), Math.sin(latitude), -c * Math.sin(longitude)];
  }

  function create(THREE, options = {}) {
    if (!THREE?.Points || !THREE?.ShaderMaterial) throw new TypeError('ParticleEarth requires THREE.');
    const rawPolygons = extractPolygons(options.landGeoJSON);
    if (!rawPolygons.length) throw new TypeError('ParticleEarth requires the world land GeoJSON.');
    const mobile = Boolean(options.mobile);
    const radius = Math.max(.05, Number.isFinite(options.radius) ? options.radius : 1.7);
    const isLand = createClassifier(rawPolygons);
    const group = new THREE.Group(); group.name = 'Earth of light';
    const materials = [], geometries = [];
    const statistics = { land: 0, ocean: 0, coastline: 0, atmosphere: 0, glints: 0 };
    let seed = 0x110122ea;
    function random() {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    function makeData() { return { position: [], color: [], size: [], alpha: [], phase: [], kind: [] }; }
    function add(data, point, color, size, alpha, distance = radius, kind = 0) {
      data.position.push(point[0] * distance, point[1] * distance, point[2] * distance);
      data.color.push(...color); data.size.push(size); data.alpha.push(alpha); data.phase.push(random() * TAU);
      data.kind.push(kind);
    }
    function makePoints(name, data, atmosphere = false, coastline = false, glint = false) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
      geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(data.color, 3));
      geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(data.size, 1));
      geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(data.alpha, 1));
      geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(data.phase, 1));
      geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(data.kind, 1));
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.07);
      const material = new THREE.ShaderMaterial({
        vertexShader, fragmentShader,
        uniforms: {
          uTime: { value: 0 }, uOpacity: { value: 1 },
          uBrightness: { value: glint ? 3.4 : atmosphere ? 2.6 : coastline ? 2.7 : 1.25 },
          uSizeBoost: { value: glint ? 2.7 : 2.35 },
          uViewportHeight: { value: 1000 }, uMinPoint: { value: glint ? 7 : atmosphere ? 3.4 : coastline ? 4.5 : 5.2 },
          uMaxPoint: { value: glint ? 42 : atmosphere ? 9.5 : coastline ? 7 : 16 },
          uAtmosphere: { value: atmosphere ? 1 : 0 }, uGlint: { value: glint ? 1 : 0 },
          uBody: { value: glint || atmosphere || coastline ? 0 : 1 }
        },
        transparent: true, depthWrite: false, depthTest: true,
        // A translucent blue body leaves room for isolated additive star facets.
        // Adding every surface grain together used to wash the continents white.
        blending: glint || atmosphere || coastline ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false
      });
      material.userData.coastline = coastline;
      material.userData.glint = glint;
      const points = new THREE.Points(geometry, material); points.name = name;
      group.add(points); materials.push(material); geometries.push(geometry);
      return points;
    }

    const surface = makeData();
    const candidates = mobile ? 90000 : 180000;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < candidates; i++) {
      const sinLat = 1 - 2 * (i + .5) / candidates;
      const latitude = Math.asin(sinLat) / DEG;
      const longitude = ((i * goldenAngle / DEG + 180) % 360) - 180;
      const land = isLand(longitude, latitude);
      if (!land && random() > .13) continue;
      const point = unitPoint(longitude, latitude);
      if (land) {
        // Large individual sparks sit among dimmer grains, leaving the land porous
        // instead of adding every neighbouring halo into a solid white map.
        // Keep the existing random draw order so every geographic position stays fixed.
        const iceWhite = random() < .27;
        const lightSample = random();
        const spark = lightSample < .40;
        const brightness = spark ? .78 + lightSample / .40 * .22 : .46 + (lightSample - .40) / .60 * .38;
        const base = iceWhite ? [.85, .97, 1] : [.30 + random() * .28, .74 + random() * .22, 1];
        const color = base.map(channel => channel * brightness);
        const size = spark ? .019 + random() * .012 : .010 + random() * .008;
        const alpha = spark ? .48 + random() * .37 : .14 + random() * .18;
        add(surface, point, color, size, alpha, radius, 1);
        statistics.land++;
      } else {
        // Preserve the blue ocean's radiance while lowering the land material gain.
        add(surface, point, [.0675, .30 + random() * .105, .855 + random() * .21], .009 + random() * .007, .16 + random() * .14);
        statistics.ocean++;
      }
    }
    const surfacePoints = makePoints('Continents and oceans — light particles', surface);

    // Sample actual coastline arcs, including lake boundaries, on the 3D sphere.
    const segments = [];
    let totalArc = 0;
    for (const polygon of rawPolygons) for (const ring of polygon) {
      for (let i = 1; i < ring.length; i++) {
        const a = unitPoint(ring[i - 1][0], ring[i - 1][1]);
        const b = unitPoint(ring[i][0], ring[i][1]);
        const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        if (angle < 1e-7) continue;
        totalArc += angle; segments.push({ a, b, angle, end: totalArc });
      }
    }
    const coast = makeData();
    const coastCount = Math.min(mobile ? 5200 : 10000, Math.ceil(totalArc / (mobile ? .0095 : .0052)));
    let segmentIndex = 0;
    for (let i = 0; i < coastCount; i++) {
      const distance = (i + .5) / coastCount * totalArc;
      while (segmentIndex < segments.length - 1 && segments[segmentIndex].end < distance) segmentIndex++;
      const segment = segments[segmentIndex];
      const t = (distance - segment.end + segment.angle) / segment.angle;
      const sinAngle = Math.sin(segment.angle);
      const aWeight = Math.sin((1 - t) * segment.angle) / sinAngle;
      const bWeight = Math.sin(t * segment.angle) / sinAngle;
      const point = segment.a.map((value, j) => value * aWeight + segment.b[j] * bWeight);
      const color = i % 7 === 0 ? [.91, .99, 1] : [.57, .95, 1];
      add(coast, point, color, .013 + random() * .004, .40 + random() * .25, radius * 1.0015, 1);
    }
    statistics.coastline = coastCount;
    const coastlinePoints = makePoints('Geographic coastlines — light particles', coast, false, true);

    const atmosphere = makeData();
    const atmosphereCount = mobile ? 3500 : 6500;
    for (let i = 0; i < atmosphereCount; i++) {
      const y = 1 - 2 * (i + .5) / atmosphereCount;
      const angle = i * goldenAngle;
      const c = Math.sqrt(Math.max(0, 1 - y * y));
      const point = [c * Math.cos(angle), y, -c * Math.sin(angle)];
      add(atmosphere, point, [.12, .58 + random() * .18, 1], .013 + random() * .011, .30 + random() * .24, radius * (1.010 + random() * .021));
    }
    statistics.atmosphere = atmosphereCount;
    const atmospherePoints = makePoints('Atmospheric rim — 3D light particles', atmosphere, true);

    // Reuse precise land and coast coordinates for rare jewellery-like catches.
    // This runs after all original clouds are built, preserving their RNG stream,
    // particle counts, positions, phases and all geographic classifications.
    const glints = makeData(), landIndices = [];
    for (let i = 0; i < surface.kind.length; i++) if (surface.kind[i] > .5) landIndices.push(i);
    const glintCount = mobile ? 320 : 640;
    const glintPalette = [[.88, .97, 1], [.65, .91, 1], [.76, .80, 1], [1, .95, .88]];
    for (let i = 0; i < glintCount; i++) {
      const useCoast = i % 4 === 0;
      const source = useCoast ? coast : surface;
      const index = useCoast ? (i * 41) % coastCount : landIndices[Math.floor(i / glintCount * landIndices.length)];
      const offset = index * 3;
      const length = Math.hypot(source.position[offset], source.position[offset + 1], source.position[offset + 2]);
      const point = [source.position[offset] / length, source.position[offset + 1] / length, source.position[offset + 2] / length];
      const color = glintPalette[i % 17 === 0 ? 3 : i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0];
      add(glints, point, color, .060 + random() * .030, .64 + random() * .28, radius * 1.0025, 1);
    }
    statistics.glints = glintCount;
    const glintPoints = makePoints('Sparse crystalline star facets — land and coast', glints, false, false, true);
    glintPoints.renderOrder = 3;

    return {
      group, materials, radius, statistics, surfacePoints, coastlinePoints, atmospherePoints, glintPoints,
      isLand,
      update(time) {
        const t = Number.isFinite(time) ? time : 0;
        materials.forEach(material => { material.uniforms.uTime.value = t; });
      },
      resize(cssHeight, pixelRatio = 1) {
        const height = Math.max(100, Number.isFinite(cssHeight) ? cssHeight : 800);
        const ratio = Math.min(2, Math.max(.5, Number.isFinite(pixelRatio) ? pixelRatio : 1));
        materials.forEach(material => {
          material.uniforms.uViewportHeight.value = height * ratio;
          material.uniforms.uMinPoint.value = (material.userData.glint ? 7 : material.uniforms.uAtmosphere.value ? 3.4 : material.userData.coastline ? 4.5 : 5.2) * ratio;
          material.uniforms.uMaxPoint.value = (material.userData.glint ? 42 : material.uniforms.uAtmosphere.value ? 9.5 : material.userData.coastline ? 7 : 16) * ratio;
        });
      },
      dispose() { geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); group.clear(); }
    };
  }

  window.ParticleEarth = Object.freeze({ create });
})();
