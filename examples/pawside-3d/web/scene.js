/* Original silhouette study. Coordinates are desk units; +Z points towards the viewer. */
(function () {
  'use strict';
  const T = THREE;
  const { layout, clamp, mix } = PawMotion;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const globe = new T.SphereGeometry(1, 42, 28);
  const palettes = {
    ink: {
      fur: '#302b32',
      shade: '#131216',
      light: '#26242b',
      stripe: '#29272e',
      eye: '#efb13e',
    },
    chestnut: {
      fur: '#cb8f67',
      shade: '#ad7254',
      light: '#f2cda7',
      stripe: '#945d43',
      eye: '#aac17a',
    },
  };
  function color(hex) {
    return new T.MeshBasicMaterial({ color: hex, side: T.DoubleSide });
  }
  function group(parent) {
    const o = new T.Group();
    parent.add(o);
    return o;
  }
  function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
    const o = new T.Mesh(geo, mat);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  function egg(parent, mat, x, y, z, w, h, d) {
    const o = mesh(parent, globe, mat, x, y, z);
    o.scale.set(w, h, d);
    return o;
  }
  function stroke(parent, mat, points, radius) {
    const pts = points.map((p) => V(...p));
    return mesh(
      parent,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(pts),
        Math.max(10, pts.length * 4),
        radius,
        7,
        false
      ),
      mat
    );
  }
  function slab(w, d, h, r) {
    const shape = new T.Shape(),
      x = w / 2,
      y = d / 2;
    shape.moveTo(-x + r, -y);
    shape.lineTo(x - r, -y);
    shape.quadraticCurveTo(x, -y, x, -y + r);
    shape.lineTo(x, y - r);
    shape.quadraticCurveTo(x, y, x - r, y);
    shape.lineTo(-x + r, y);
    shape.quadraticCurveTo(-x, y, -x, y - r);
    shape.lineTo(-x, -y + r);
    shape.quadraticCurveTo(-x, -y, -x + r, -y);
    const geo = new T.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: false,
      curveSegments: 6,
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }
  // Smooth individual cross sections for the head, ears, and the single continuous back.
  function skinSurface(parent, mat, profile, cols = 48) {
    const curve = [];
    for (let k = 0; k < 2; k++)
      curve.push(
        new T.CatmullRomCurve3(
          profile.map((row) => V(row[0], row[1 + k * 2], row[2 + k * 2])),
          false,
          'catmullrom',
          0.36
        )
      );
    const rows = (profile.length - 1) * 6,
      points = [],
      idx = [];
    for (let j = 0; j <= rows; j++) {
      const a = curve[0].getPoint(j / rows),
        b = curve[1].getPoint(j / rows);
      for (let i = 0; i < cols; i++) {
        const q = (2 * Math.PI * i) / cols;
        points.push(
          b.y + Math.max(0.002, a.y) * Math.cos(q),
          a.x,
          b.z + Math.max(0.002, a.z) * Math.sin(q)
        );
        if (j < rows) {
          const u = j * cols + i,
            v = j * cols + ((i + 1) % cols);
          idx.push(u, u + cols, v, v, u + cols, v + cols);
        }
      }
    }
    // Close the poles; an open end leaves a pinhole in the crown when viewed from above.
    for (const j of [0, rows]) {
      const row = profile[j === 0 ? 0 : profile.length - 1];
      const center = points.length / 3;
      points.push(row[3], row[0], row[4]);
      for (let i = 0; i < cols; i++) {
        const a = j * cols + i, b = j * cols + (i + 1) % cols;
        if (j === 0) idx.push(center, a, b);
        else idx.push(center, b, a);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    geo.computeVertexNormals();
    return mesh(parent, geo, mat);
  }
  // End caps and changes in limb thickness follow the curve, including a flat planted paw.
  class Limb {
    constructor(parent, mat, radius, segments = 36) {
      this.radius = radius;
      this.rows = segments;
      this.cols = 20;
      this.curve = new T.CatmullRomCurve3(
        [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)],
        false,
        'catmullrom',
        0.5
      );
      const geo = new T.BufferGeometry(),
        idx = [];
      for (let j = 0; j < segments; j++)
        for (let k = 0; k < this.cols; k++) {
          const a = j * this.cols + k,
            b = j * this.cols + ((k + 1) % this.cols);
          idx.push(a, b, a + this.cols, b, b + this.cols, a + this.cols);
        }
      this.pos = new T.BufferAttribute(
        new Float32Array((segments + 1) * this.cols * 3),
        3
      ).setUsage(T.DynamicDrawUsage);
      this.normal = new T.BufferAttribute(
        new Float32Array(this.pos.array.length),
        3
      ).setUsage(T.DynamicDrawUsage);
      geo.setAttribute('normal', this.normal);
      geo.setAttribute('position', this.pos);
      geo.setIndex(idx);
      this.mesh = mesh(parent, geo, mat);
      this.mesh.frustumCulled = false;
      this.center = V(0, 0, 0);
      this.next = V(0, 0, 0);
      this.axis = V(0, 0, 0);
      this.cross = V(0, 0, 0);
    }
    pose(points, width = 1) {
      this.curve.points.forEach((p, i) => p.copy(points[i]));
      for (let j = 0; j <= this.rows; j++) {
        const t = j / this.rows;
        this.curve.getPoint(t, this.center);
        this.curve.getTangent(t, this.next);
        // Transport the ring along the curve; a moving wrist must not flip its seam.
        if (j === 0) {
          if (Math.abs(this.next.z) > 0.90) this.axis.set(0, 1, 0);
          else this.axis.set(0, 0, 1);
          this.axis.cross(this.next).normalize();
        } else {
          this.axis.addScaledVector(this.next, -this.axis.dot(this.next)).normalize();
        }
        this.cross.crossVectors(this.next, this.axis);
        const tip = clamp((t - 0.90) / 0.10);
        const cap = Math.sqrt(Math.max(0, 1 - tip * tip));
        const r = this.radius(t) * width * cap;
        for (let k = 0; k < this.cols; k++) {
          const theta = (k * 2 * Math.PI) / this.cols;
          const cos = Math.cos(theta);
          const sin = Math.sin(theta);
          const a = r * cos;
          const b = r * sin;
          this.normal.setXYZ(
            j * this.cols + k,
            cap * (cos * this.axis.x + sin * this.cross.x) + tip * this.next.x,
            cap * (cos * this.axis.y + sin * this.cross.y) + tip * this.next.y,
            cap * (cos * this.axis.z + sin * this.cross.z) + tip * this.next.z
          );
          this.pos.setXYZ(
            j * this.cols + k,
            this.center.x + a * this.axis.x + b * this.cross.x,
            this.center.y + a * this.axis.y + b * this.cross.y,
            this.center.z + a * this.axis.z + b * this.cross.z
          );
        }
      }
      this.pos.needsUpdate = true;
      this.normal.needsUpdate = true;
    }
  }
  function faceDepth(x, y) {
    return (
      0.82 * Math.sqrt(Math.max(0.06, 1 - (x / 1.075) ** 2 - (y / 0.86) ** 2))
    );
  }
  function marking(head, mat, pts) {
    const sh = new T.Shape();
    sh.moveTo(...pts[0]);
    for (const q of pts.slice(1)) sh.quadraticCurveTo(...q);
    const g = new T.ShapeGeometry(sh, 12),
      a = g.attributes.position;
    for (let i = 0; i < a.count; i++)
      a.setZ(i, faceDepth(a.getX(i), a.getY(i)) + 0.039);
    return mesh(head, g, mat);
  }
  // A broad light across the crown and a compact rim reveal the volume at icon size.
  function velvetCoat(shader) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 furNormal = normalize(normal);
       float light = smoothstep(-0.28, 0.96, dot(furNormal, normalize(vec3(-0.48,0.77,0.51))));
       float rim = pow(1.0 - abs(dot(furNormal,normalize(vViewPosition))), 2.8);
       float coolBounce = smoothstep(0.28,0.98,dot(furNormal,normalize(vec3(0.85,0.32,0.22))));
       outgoingLight = outgoingLight * (0.78 + 0.23*light)
         + vec3(0.028,0.023,0.030)*light*light
         + rim*(vec3(0.064,0.055,0.061)*light + vec3(0.019,0.021,0.032)*coolBounce);
       #include <opaque_fragment>`
    );
  }
  function innerEar(fur, tint) {
    const mat = fur.clone();
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.earTint = { value: new T.Color(tint) };
      shader.vertexShader = 'varying vec3 earPoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nearPoint=position;'
      );
      shader.fragmentShader = 'varying vec3 earPoint; uniform vec3 earTint;\n' + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float height = (earPoint.y - 0.33) / 0.34;
         float width = 0.215 * (1.0 - 0.72*clamp(height,0.0,1.0));
         vec2 shape = vec2((earPoint.x - 0.018*sign(earPoint.x)*height)/width, (height-0.34)/0.85);
         float inside = (1.0-smoothstep(0.69,1.06,length(shape)))*smoothstep(0.05,0.14,earPoint.z);
         diffuseColor.rgb = mix(diffuseColor.rgb,earTint,inside*(0.64 + 0.23*clamp(height,0.0,1.0)));`
      );
    };
    return mat;
  }
  function inkForepaw(fur, side) {
    const material = fur.clone();
    // The paw cap is a sphere. Only the foreleg needs a fade into the shoulder.
    material.defaultAttributeValues = { pawContrast: [1] };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.pawFill = { value: new T.Color('#d5c7b9') };
      shader.uniforms.pawSide = { value: side };
      shader.vertexShader =
        'attribute float pawContrast; varying float pawWeight;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\npawWeight = pawContrast;'
        );
      shader.fragmentShader =
        'uniform vec3 pawFill; uniform float pawSide; varying float pawWeight;\n' +
        shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
           float rim = 1.0 - smoothstep(0.12, 0.52, facing);
           float innerArc = smoothstep(-0.35, 0.55, -normal.x * pawSide);
           float crest = smoothstep(0.03, 0.19, facing) * (1.0 - smoothstep(0.24, 0.45, facing));
           float glancingLight = rim * (0.15 + 0.47 * innerArc) + 0.26 * crest * innerArc;
           float darkCoat = 1.0 - smoothstep(0.05, 0.25, dot(diffuse, vec3(0.2126, 0.7152, 0.0722)));
           outgoingLight = mix(outgoingLight, pawFill, pawWeight * darkCoat * (0.016 + glancingLight));
           #include <opaque_fragment>`
        );
    };
    return material;
  }
  function mittenMaterial(fur, toes) {
    const mat = fur.clone();
    const light = fur.onBeforeCompile;
    mat.defaultAttributeValues = { pawContrast: [1] };
    mat.onBeforeCompile = (shader, renderer) => {
      light.call(mat, shader, renderer);
      shader.uniforms.toeTint = { value: toes };
      shader.vertexShader = 'varying vec3 mittenPoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nmittenPoint=position;'
      );
      shader.fragmentShader = 'varying vec3 mittenPoint; uniform vec3 toeTint;\n' + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float toe = smoothstep(0.32,0.65,0.69*mittenPoint.z - 0.65*mittenPoint.y);
         diffuseColor.rgb = mix(diffuseColor.rgb,toeTint,toe);`
      );
    };
    mat.customProgramCacheKey = () => 'mitten:' + fur.customProgramCacheKey();
    return mat;
  }
  function makeCat(parent, id, overrides = {}) {
    const long = id === 'chestnut',
      p = { ...palettes[id], ...overrides };
    const mats = {};
    for (const [name, tint] of Object.entries(p)) {
      mats[name] =
        name === 'fur' || name === 'shade'
          ? new T.MeshLambertMaterial({ color: tint, side: T.DoubleSide })
          : color(tint);
    }
    if (!long) mats.fur.onBeforeCompile = velvetCoat;
    const earCoat = innerEar(mats.fur, long ? '#cc8c75' : '#806569');
    mats.pupil = color('#17151b');
    mats.whisk = color(long ? '#e7c39d' : '#998a8a');
    const muzzleTint = new T.MeshLambertMaterial({ color: long ? p.light : mats.fur.color.clone().lerp(new T.Color('#5d5059'), 0.38) });
    const noseTint = color(long ? '#935d59' : '#ae8585');
    mats.sole = color(long ? '#f4d3af' : '#f1ede2');
    const root = group(parent),
      trunk = group(root),
      head = group(root);
    const body = skinSurface(trunk, mats.fur, [
      [0.035, 0.56, 0.48, 0.08, -0.18],
      [0.15, 0.96, 0.83, 0.07, -0.20],
      [0.50, 1.12, 0.97, 0.07, -0.19],
      [0.97, 1.11, 0.99, 0.04, -0.13],
      [1.48, 0.99, 0.89, -0.02, -0.05],
      [1.94, 0.82, 0.75, -0.07, 0.02],
      [2.34, 0.59, 0.57, -0.11, 0.08],
      [2.64, 0.37, 0.39, -0.12, 0.10],
    ]);
    const sideShape = skinSurface(trunk, mats.fur, [
      [0.035, 0.69, 0.53, 0.29, -0.14],
      [0.14, 1.11, 0.78, 0.30, -0.18],
      [0.50, 1.32, 0.93, 0.20, -0.17],
      [1.00, 1.25, 0.94, 0.03, -0.10],
      [1.54, 1.08, 0.85, -0.25, -0.02],
      [2.00, 0.84, 0.73, -0.55, 0.06],
      [2.36, 0.62, 0.59, -0.81, 0.11],
      [2.64, 0.39, 0.42, -0.98, 0.13],
    ]);
    body.geometry.morphAttributes.position = [
      sideShape.geometry.attributes.position.clone(),
    ];
    body.geometry.morphAttributes.normal = [
      sideShape.geometry.attributes.normal.clone(),
    ];
    body.updateMorphTargets();
    trunk.remove(sideShape);
    sideShape.geometry.dispose();
    if (long) {
      // Use the resting body coordinates so the three tufts of the bib follow the same morph as the shoulders.
      body.material = mats.fur.clone();
      body.material.onBeforeCompile = (shader) => {
        shader.uniforms.bibTint = { value: mats.light.color };
        shader.vertexShader =
          'varying vec3 coatPoint;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\ncoatPoint=position;'
          );
        shader.fragmentShader =
          'varying vec3 coatPoint; uniform vec3 bibTint;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
          float x = abs(coatPoint.x + 0.065);
          float edge = 0.59 + 1.38*x + 0.23*smoothstep(0.13,0.22,x) - 0.29*smoothstep(0.22,0.32,x);
          float lower = smoothstep(edge-0.025,edge+0.025,coatPoint.y);
          float sides = 1.0-smoothstep(0.54,0.62,x);
          float front = smoothstep(0.17,0.32,coatPoint.z);
          diffuseColor.rgb = mix(diffuseColor.rgb, bibTint, lower*sides*front);
        `
          );
      };
    }
    // The forehead, jowls and tucked chin share a continuous egg-shaped surface.
    const faceCoat = mats.fur.clone();
    faceCoat.onBeforeCompile = (shader) => {
      if (!long) velvetCoat(shader);
      shader.uniforms.cheekTint = { value: new T.Color(long ? '#cc8a76' : '#654c57') };
      shader.vertexShader = 'varying vec3 facePoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nfacePoint=position;'
      );
      shader.fragmentShader = 'varying vec3 facePoint; uniform vec3 cheekTint;\n' + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec2 cheek = (vec2(abs(facePoint.x),facePoint.y)-vec2(.69,-.22))/vec2(.29,.14);
         float warmth = (1.0-smoothstep(0.05,1.0,dot(cheek,cheek)))*smoothstep(.32,.68,facePoint.z);
         diffuseColor.rgb=mix(diffuseColor.rgb,cheekTint,0.39*warmth);`
      );
    };
    // The two coats share anatomy; only the short black coat gets the velvet response.
    faceCoat.customProgramCacheKey = () => 'cheeks:' + id;
    skinSurface(head, faceCoat, [
      [-0.81, 0.018, 0.025, 0, 0.11],
      [-0.73, 0.44, 0.40, 0, 0.10],
      [-0.57, 0.78, 0.62, 0, 0.075],
      [-0.32, 1.015, 0.775, 0, 0.035],
      [-0.045, 1.075, 0.82, 0, 0.005],
      [0.24, 1.00, 0.775, 0, -0.025],
      [0.50, 0.85, 0.65, 0, -0.032],
      [0.70, 0.62, 0.49, 0, -0.035],
      [0.82, 0.37, 0.29, 0, -0.035],
      [0.875, 0.025, 0.024, 0, -0.035],
    ]);
    head.scale.set(long ? 1.22 : 1.27, 1.19, 1.13);
    const ears = [],
      eyes = [],
      feet = [],
      arms = [],
      hind = [],
      tufts = [];
    const bibSleeve = long
      ? new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })
      : null;
    for (const side of [-1, 1]) {
      const sleeve = bibSleeve || inkForepaw(mats.fur, side);
      const ear = group(head);
      ear.position.set(side * (long ? 0.62 : 0.59), 0.39, -0.08);
      skinSurface(
        ear,
        earCoat,
        [
          [0, 0.405, 0.31, 0, 0],
          [0.19, 0.39, 0.294, 0.01 * side, 0],
          [0.40, 0.31, 0.24, 0.025 * side, 0],
          [0.59, 0.225, 0.17, 0.034 * side, -0.004],
          [0.71, 0.15, 0.111, 0.038 * side, -0.008],
          [0.781, 0.085, 0.064, 0.038 * side, -0.010],
          [0.809, 0.034, 0.028, 0.037 * side, -0.010],
          [0.814, 0.003, 0.003, 0.037 * side, -0.010],
        ],
        48
      );
      if (long) {
        for (let j = 0; j < 2; j++) {
          const g = mesh(
            ear,
            new T.ConeGeometry(0.036, 0.21 - j * 0.051, 8),
            mats.stripe,
            side * (0.09 + j * 0.035),
            0.79,
            -0.005
          );
          g.rotation.z = -side * (0.32 + j * 0.14);
        }
        for (let j = 0; j < 2; j++) {
          const tuft = mesh(
            head,
            new T.ConeGeometry(0.15 - j * 0.02, 0.34 - j * 0.035, 16),
            mats.fur,
            side * 0.88,
            -0.19 - j * 0.11,
            0.06
          );
          tuft.rotation.z = side * (-1.85 - j * 0.22);
          tufts.push(tuft);
        }
        marking(head, mats.light, [
          [side * 0.45, -0.23],
          [side * 0.67, -0.21, side * 0.84, -0.27],
          [side * 0.73, -0.31, side * 0.77, -0.36],
          [side * 0.65, -0.34, side * 0.71, -0.41],
          [side * 0.53, -0.37, side * 0.45, -0.23],
        ]);
        marking(head, mats.stripe, [
          [side * 0.16, 0.53],
          [side * 0.21, 0.49, side * 0.24, 0.43],
          [side * 0.2, 0.33, side * 0.18, 0.3],
          [side * 0.175, 0.43, side * 0.16, 0.53],
        ]);
        marking(head, mats.stripe, [
          [side * 0.37, 0.46],
          [side * 0.45, 0.43, side * 0.47, 0.37],
          [side * 0.4, 0.34, side * 0.355, 0.28],
          [side * 0.39, 0.38, side * 0.37, 0.46],
        ]);
      }
      const pad = egg(head, muzzleTint, side * 0.12, -0.23, 0.787, 0.17, 0.133, 0.089);
      pad.rotation.z = -side * 0.13;
      ear.scale.set(1.04, long ? 1.08 : 1.0, 1);
      ears.push(ear);
      const socket = group(head);
      socket.position.set(side * 0.425, 0.155, 0.748);
      socket.rotation.set(-0.12, side * 0.32, 0);
      const lid = group(socket);
      const paint = color(p.eye);
      const gaze = { value: new T.Vector2() },
        pupil = { value: new T.Vector2(0.34, 0.65) };
      paint.onBeforeCompile = (shader) => {
        shader.uniforms.pawGaze = gaze;
        shader.uniforms.pawPupil = pupil;
        shader.vertexShader =
          'varying vec2 eyePoint;\n' +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\neyePoint=position.xy;'
          );
        shader.fragmentShader =
          'varying vec2 eyePoint; uniform vec2 pawGaze; uniform vec2 pawPupil;\n' +
          shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
          vec2 xy = eyePoint;
          vec2 pt = xy-pawGaze;
          float edge = length(xy);
          float honey = smoothstep(-0.55,0.90,-xy.y);
          vec3 irisColor = diffuseColor.rgb * mix(0.66,1.28,honey);
          float innerRing = 1.0-smoothstep(0.76,1.08,length(pt/vec2(0.94,1.0)));
          irisColor *= 0.77 + 0.23*innerRing;
          float limbus = smoothstep(0.86,1.02,edge);
          irisColor = mix(irisColor,irisColor*0.19,limbus);
          float pupilEdge = length(pt/pawPupil);
          vec3 pupilInk = mix(vec3(.006,.005,.008),vec3(.032,.022,.025),honey);
          diffuseColor.rgb = mix(pupilInk,irisColor,smoothstep(0.96,1.025,pupilEdge));
          vec2 gleam = xy - 0.30*pawGaze;
          float window = 1.0-smoothstep(0.91,1.05,length((gleam-vec2(-.22,.30))/vec2(.19,.215)));
          float pin = 1.0-smoothstep(.055,.087,length(gleam-vec2(.16,.51)));
          float bounce = 1.0-smoothstep(.08,.16,length((gleam-vec2(.25,-.53))*vec2(.74,1.04)));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.96,.78,.49),bounce*.34);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.96,.83),max(window,pin*.86));`
          );
      };
      egg(lid, paint, 0, 0, 0, 0.315, 0.310, 0.100);
      eyes.push({ socket, lid, gaze, pupil });
      for (let j = 0; j < 2; j++)
        stroke(
          head,
          mats.whisk,
          [
            [side * 0.53, -0.20 - j * 0.043, 0.719],
            [side * 0.82, -0.19 - j * 0.075, 0.565],
            [side * (1.045 + 0.036 * j), -0.16 - j * 0.13, 0.444],
          ],
          0.008
        );
      const sole = group(root);
      const toeColor = long ? mats.light.color : new T.Color('#dbccc1');
      const mitten = mittenMaterial(mats.fur, toeColor);
      egg(sole, mitten, 0, 0.06, 0.085, 0.216, 0.160, 0.246);
      feet.push(sole);
      const radius = (t) => 0.29 - 0.116 * t + 0.042 * Math.sin(Math.PI * t);
      const arm = new Limb(root, sleeve, radius);
      if (long) {
        // Carry the bib over the shoulder so the root of the leg has no cut edge.
        const tint = new T.Color();
        const colors = [];
        for (let row = 0; row <= arm.rows; row++) {
          const t = T.MathUtils.smoothstep(row / arm.rows, 0.04, 0.39);
          tint.copy(mats.light.color).lerp(mats.fur.color, t);
          for (let k = 0; k < arm.cols; k++) colors.push(tint.r, tint.g, tint.b);
        }
        arm.mesh.geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      } else {
        const weights = new Float32Array((arm.rows + 1) * arm.cols);
        for (let row = 0; row <= arm.rows; row++) {
          const weight = T.MathUtils.smoothstep(row / arm.rows, 0.03, 0.31);
          weights.fill(weight, row * arm.cols, (row + 1) * arm.cols);
        }
        arm.mesh.geometry.setAttribute('pawContrast', new T.BufferAttribute(weights, 1));
      }
      arms.push(arm);
      const heel = group(root);
      const haunch = egg(heel, mats.fur, 0, 0.225, -0.018, 0.275, 0.307, 0.345);
      haunch.rotation.x = -0.51;
      hind.push(heel);
    }
    const tail = new Limb(
      root,
      long ? mats.shade : mats.fur,
      (t) => (long ? 0.175 + 0.108 * Math.sin(t * Math.PI) : 0.174 - 0.042 * t),
      60
    );
    if (long) {
      const colors = [],
        shade = mats.shade.color,
        tip = mats.light.color;
      const ring = mats.stripe.color,
        shadeAt = new T.Color();
      for (let j = 0; j <= tail.rows; j++) {
        const u = j / tail.rows;
        const bands = Math.max(
          0,
          1 - Math.abs(u - 0.49) / 0.06,
          1 - Math.abs(u - 0.69) / 0.052
        );
        shadeAt
          .copy(shade)
          .lerp(ring, bands * 0.65)
          .lerp(tip, clamp((u - 0.79) / 0.07));
        for (let k = 0; k < tail.cols; k++)
          colors.push(shadeAt.r, shadeAt.g, shadeAt.b);
      }
      tail.mesh.geometry.setAttribute(
        'color',
        new T.Float32BufferAttribute(colors, 3)
      );
      tail.mesh.material = new T.MeshLambertMaterial({
        vertexColors: true,
        side: T.DoubleSide,
      });
    }
    const smile = group(head);
    const smileInk = color(long ? '#8a5d4b' : '#211b22');
    for (const side of [-1, 1]) {
      stroke(smile, smileInk, [[0,-0.253,0.874],[side*0.064,-0.277,0.879],[side*0.123,-0.256,0.879]], 0.013);
    }
    const mouth = group(head);
    mouth.position.set(0, -0.315, 0.884);
    mouth.rotation.x = -0.39;
    const lip = color(long ? '#774337' : '#654656');
    egg(mouth, lip, 0, 0, 0, 0.12, 0.105, 0.027);
    egg(
      mouth,
      color(long ? '#bd766e' : '#c7888d'),
      0,
      -0.052,
      0.015,
      0.077,
      0.042,
      0.018
    );
    for (const side of [-1, 1]) {
      const fang = mesh(
        mouth,
        new T.ConeGeometry(0.033, 0.07, 9),
        mats.sole,
        side * 0.073,
        0.038,
        0.029
      );
      fang.rotation.z = Math.PI + 0.15 * side;
    }
    const nose = egg(
      head,
      noseTint,
      0,
      -0.181,
      0.879,
      0.072,
      0.043,
      0.031
    );
    return {
      root,
      trunk,
      body,
      head,
      ears,
      eyes,
      feet,
      arms,
      hind,
      tail,
      nose,
      smile,
      mouth,
      long,
      mats,
      tufts,
    };
  }
  function keyboard(parent) {
    const caps = new Map(),
      deck = group(parent),
      base = color('#252521');
    mesh(deck, slab(4.54, 1.6, 0.12, 0.14), base, 0.42, -0.03, 1.93);
    // Preserve the rounded edges at each width and draw equal-width keys together.
    const byWidth = new Map();
    for (const key of layout.values()) {
      const width = key.width.toFixed(3);
      if (!byWidth.has(width)) byWidth.set(width, []);
      byWidth.get(width).push(key);
    }
    const plastic = new T.MeshBasicMaterial({ vertexColors: true });
    const matrix = new T.Matrix4();
    for (const keys of byWidth.values()) {
      const geometry = slab(keys[0].width - 0.008, 0.205, 0.07, 0.034);
      const tones = new Float32Array(
        geometry.attributes.position.count * 3
      ).fill(1);
      for (const g of geometry.groups)
        if (g.materialIndex === 1)
          tones.fill(0.68, g.start * 3, (g.start + g.count) * 3);
      geometry.setAttribute('color', new T.BufferAttribute(tones, 3));
      geometry.clearGroups();
      const batch = new T.InstancedMesh(geometry, plastic, keys.length);
      batch.userData.keys = keys;
      batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
      deck.add(batch);
      keys.forEach((key, index) => {
        const accent = key.code === 'Enter' || key.code === 'Escape';
        const modifier = key.width > 0.36 && key.code !== 'Space';
        const base = new T.Color(
          accent ? '#eab05e' : modifier ? '#e0dece' : '#f7f5e9'
        );
        batch.setMatrixAt(index, matrix.makeTranslation(key.x, 0.112, key.z));
        batch.setColorAt(index, base);
        caps.set(key.code, { batch, index, key, base, depth: 0 });
      });
      batch.instanceColor.setUsage(T.DynamicDrawUsage);
      batch.computeBoundingSphere();
      batch.boundingSphere.radius += 0.05;
    }
    const mouse = group(parent);
    mouse.position.set(-2.32, 0.14, 1.82);
    egg(mouse, color('#aaa397'), 0, 0, 0, 0.296, 0.143, 0.421);
    egg(mouse, color('#e4dfd0'), 0, 0.035, -0.022, 0.281, 0.140, 0.366);
    const buttons = [1, -1].map((side) => {
      const cap = egg(
        mouse,
        color('#f7f3e8'),
        side * 0.118,
        0.065,
        0.075,
        0.135,
        0.095,
        0.285
      );
      return cap;
    });
    const wheel = group(mouse);
    wheel.position.set(0, 0.158, 0.157);
    const tread = new T.CylinderGeometry(0.077, 0.077, 0.064, 20);
    tread.rotateZ(Math.PI / 2);
    mesh(wheel, tread, color('#87694b'));
    const ribMat = color('#efc887');
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      egg(
        wheel,
        ribMat,
        0,
        Math.cos(angle) * 0.076,
        Math.sin(angle) * 0.076,
        0.034,
        0.009,
        0.009
      );
    }
    const cable = new Limb(parent, color('#54514b'), () => 0.013, 14);
    return { caps, mouse, buttons, wheel, cable };
  }
  function spriteTexture(paint, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d'), w, h);
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    return tx;
  }
  function icon(parent, texture, width, height) {
    const s = new T.Sprite(
      new T.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })
    );
    s.scale.set(width, height, 1);
    s.renderOrder = 9;
    parent.add(s);
    return s;
  }
  function angerStamp(g) {
    g.scale(2, 2);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [w, clr] of [
      [7, '#fff4e6'],
      [3.7, '#d85b59'],
    ]) {
      g.lineWidth = w;
      g.strokeStyle = clr;
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(32, 32);
        g.rotate((i * Math.PI) / 2 + 0.23);
        g.beginPath();
        g.moveTo(-22, -11);
        g.quadraticCurveTo(-11, -10, -6, -4);
        g.quadraticCurveTo(-9, -14, -4, -23);
        g.stroke();
        g.restore();
      }
    }
  }
  function impactStamp(g) {
    g.translate(64, 64);
    g.beginPath();
    for (let i = 0; i < 22; i++) {
      const r = i % 2 ? 24 : 41 + 6 * Math.cos(i * 2.1),
        a = (i * Math.PI) / 11;
      const x = r * Math.cos(a),
        y = r * Math.sin(a);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = '#282722';
    g.fillStyle = '#fff9e8';
    g.fill();
    g.stroke();
  }
  // A miniature mouse makes chord and wheel direction readable at tray-window size.
  function pointerStamp(mask, direction) {
    return spriteTexture(
      (g) => {
        g.scale(2, 2);
        g.lineJoin = g.lineCap = 'round';
        g.lineWidth = 2.5;
        g.fillStyle = '#fff9e9';
        g.strokeStyle = '#433d35';
        g.beginPath();
        g.roundRect(13, 4, 38, 53, [17, 17, 15, 15]);
        g.fill();
        g.stroke();
        g.save();
        g.clip();
        g.fillStyle = '#e9a34f';
        if (mask & 1) g.fillRect(13, 4, 19, 24);
        if (mask & 2) g.fillRect(32, 4, 19, 24);
        g.beginPath();
        g.moveTo(13, 29);
        g.lineTo(51, 29);
        g.moveTo(32, 4);
        g.lineTo(32, 28);
        g.stroke();
        g.restore();
        g.beginPath();
        g.roundRect(28, 10, 8, 15, 4);
        g.fillStyle = mask & 4 ? '#df8856' : '#f4e3bd';
        g.fill();
        g.stroke();
        if (direction) {
          const y = direction > 0 ? 47 : 39;
          g.beginPath();
          g.moveTo(26, y - direction * 6);
          g.lineTo(32, y);
          g.lineTo(38, y - direction * 6);
          g.stroke();
        }
      },
      128,
      128
    );
  }
  function labelTexture(text) {
    return spriteTexture(
      (g) => {
        g.fillStyle = '#fff9ed';
        g.strokeStyle = '#4c473e';
        g.lineWidth = 5;
        g.beginPath();
        g.roundRect(5, 5, 118, 64, 17);
        g.fill();
        g.stroke();
        g.fillStyle = '#302e2a';
        g.font = 'bold ' + (text.length > 3 ? 23 : 34) + 'px Arial, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text, 64, 40, 110);
      },
      128,
      80
    );
  }
  const labelName = (k) =>
    k.code === 'Space' ? 'space' : k.code === 'Backspace' ? '⌫' : k.label;
  class View {
    constructor(canvas) {
      this.renderer = new T.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power',
      });
      this.renderer.setClearColor(0, 0);
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.scene = new T.Scene();
      this.scene.add(new T.AmbientLight(0xfff7f0, 2.45));
      const light = new T.DirectionalLight(0xfff4eb, 1.8);
      light.position.set(-4, 7, 5);
      this.scene.add(light);
      const contact = spriteTexture(
        (g) => {
          const ramp = g.createRadialGradient(64, 64, 0, 64, 64, 63);
          ramp.addColorStop(0, 'rgba(63,54,49,.17)');
          ramp.addColorStop(0.56, 'rgba(63,54,49,.066)');
          ramp.addColorStop(1, 'rgba(63,54,49,0)');
          g.fillStyle = ramp;
          g.fillRect(0, 0, 128, 128);
        },
        128,
        128
      );
      for (const [x, z, w, h] of [
        [0.15, -0.03, 2.9, 1.94],
        [0.42, 1.96, 5.55, 2.15],
        [-2.32, 1.82, 0.78, 1.23],
      ]) {
        const sh = mesh(
          this.scene,
          new T.PlaneGeometry(w, h),
          new T.MeshBasicMaterial({
            map: contact,
            transparent: true,
            depthWrite: false,
          }),
          x,
          -0.043,
          z
        );
        sh.rotation.x = -Math.PI / 2;
      }
      this.camera = new T.PerspectiveCamera(26, 1, 0.1, 80);
      const keys = keyboard(this.scene);
      this.caps = keys.caps;
      this.mouse = keys.mouse;
      this.mouseCaps = keys.buttons;
      this.wheel = keys.wheel;
      this.cable = keys.cable;
      this.cordPath = [
        V(-2.32, 0.095, 2.19),
        V(-2.4, 0.027, 2.41),
        V(-2.52, 0.018, 2.6),
        V(-2.77, 0.018, 2.75),
        V(-3.07, 0.018, 2.89),
      ];
      this.cablePos = [NaN, NaN];
      this.inputBadge = icon(this.scene, null, 0.48, 0.48);
      this.inputBadge.visible = false;
      this.badgeMaps = new Map();
      this.mouseRestColor = new T.Color('#f7f3e8');
      this.mousePressColor = new T.Color('#e6ad61');
      this.pick = new T.Raycaster();
      this.targets = [...new Set([...this.caps.values()].map((k) => k.batch))];
      this.capMatrix = new T.Matrix4();
      this.capTint = new T.Color();
      this.profiles = new Map();
      for (const id of Object.keys(palettes))
        this.profiles.set(id, makeCat(this.scene, id));
      this.anger = icon(
        this.scene,
        spriteTexture(angerStamp, 128, 128),
        0.62,
        0.62
      );
      this.spark = icon(
        this.scene,
        spriteTexture(impactStamp, 128, 128),
        0.78,
        0.78
      );
      this.privateKeys = false;
      this.labels = Array.from({ length: 8 }, () => {
        const s = icon(this.scene, null, 0.49, 0.31);
        s.visible = false;
        return s;
      });
      this.labelMaps = new Map();
      this.select('ink');
    }
    resize(w, h, ratio = devicePixelRatio || 1) {
      this.logicalWidth = w;
      this.logicalHeight = h;
      // Supersample small windows as well as 1x monitors. Bound live GPU work on large displays.
      const scale = Math.min(
        Math.max(2, ratio),
        2.5,
        Math.max(1, Math.sqrt(2200000 / (w * h)))
      );
      this.renderer.setPixelRatio(scale);
      this.renderer.setSize(w, h, false);
      const a = w / h;
      const halfHeight = Math.max(3.08, 3.96 / a),
        dist = halfHeight / Math.tan((13 * Math.PI) / 180);
      this.camera.aspect = a;
      this.camera.position.set(-0.14, 1.62 + dist * 0.407, 0.7 + dist * 0.913);
      this.camera.lookAt(-0.14, 1.62, 0.7);
      this.camera.updateProjectionMatrix();
    }
    snapshot() {
      const surface = document.createElement('canvas');
      surface.width = this.logicalWidth;
      surface.height = this.logicalHeight;
      const ctx = surface.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.renderer.domElement, 0, 0, surface.width, surface.height);
      return surface.toDataURL('image/png');
    }
    select(id) {
      this.cat = this.profiles.get(id);
      for (const c of this.profiles.values()) c.root.visible = c === this.cat;
    }
    skin(id, options) {
      const old = this.profiles.get(id);
      this.scene.remove(old.root);
      const geos = new Set(),
        mats = new Set();
      old.root.traverse((o) => {
        if (o.geometry && o.geometry !== globe) geos.add(o.geometry);
        if (o.material) mats.add(o.material);
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      this.profiles.set(id, makeCat(this.scene, id, options));
      this.select(id);
    }
    hit(x, y) {
      this.pick.setFromCamera(new T.Vector2(x, y), this.camera);
      const first = this.pick.intersectObjects(
        [...this.targets, this.cat.head, this.mouse],
        true
      )[0];
      if (!first) return null;
      if (first.instanceId !== undefined && first.object.userData.keys)
        return first.object.userData.keys[first.instanceId].code;
      for (let o = first.object; o; o = o.parent) {
        if (o === this.mouse) return 'mouse';
        if (o === this.cat.head) return 'head';
      }
      return null;
    }
    render(m, t) {
      const c = this.cat,
        sideways = m.mouseLean,
        d = m.drive,
        r = Math.max(m.rage, 0.72 * m.pique),
        n = m.sleep,
        h = m.hello;
      const covered = m.privacy ? 1 : 0;
      const rub = m.nuzzle;
      const active = clamp((t - m.lastStrike) / 0.75),
        typing = (1 - active) * (1 - sideways),
        breath = Math.sin(t * 2.35);
      const reach = clamp(
        (m.paws[0].pos.x + m.paws[1].pos.x) * 0.105,
        -0.26,
        0.26
      );
      const leanX =
          0.13 * m.balance * typing +
          reach * 0.5 * (1 - sideways) -
          0.15 * r * (1 - sideways),
        leanZ = 0.28 * typing + 0.26 * d + 0.11 * r;
      const slowLook = typing * (1 - d) * (1 - r);
      const dip =
        0.10 * typing +
        0.14 * d +
        0.065 * r +
        0.22 * n +
        0.10 * m.landing -
        0.13 * m.lookup;
      const heat = m.rage;
      c.mouth.visible = heat > 0.065;
      c.smile.visible = !c.mouth.visible;
      c.mouth.scale.set(
        0.68 + 0.46 * heat,
        Math.max(0.001, heat * (0.75 + 0.5 * m.landing)),
        1
      );
      // Shear from the hips. Rump and hind feet stay on the same patch of desk.
      c.body.morphTargetInfluences[0] = sideways;
      c.trunk.matrixAutoUpdate = false;
      c.trunk.matrix.set(
        1 + 0.012 * breath,
        leanX * 0.42,
        0,
        0,
        0,
        1 - dip * 0.19,
        0,
        0.03,
        0,
        leanZ * 0.43,
        1,
        0,
        0,
        0,
        0,
        1
      );
      c.trunk.matrixWorldNeedsUpdate = true;
      const hx =
          -0.12 -
          (0.91 + 0.18 * m.grab) * sideways +
          leanX * 1.03 +
          0.13 * rub * Math.sin(t * 6),
        hz = 0.25 + leanZ * 1.11;
      c.head.position.set(
        hx,
        2.75 +
          0.25 * (1 - sideways) +
          0.025 * breath -
          dip +
          0.1 * h +
          0.03 * r * Math.sin(t * 23) -
          0.14 * covered,
        hz
      );
      c.head.rotation.set(
        0.13 +
          0.16 * d +
          0.14 * n -
          0.095 * h -
          0.235 * m.lookup +
          0.075 * m.landing,
        -0.34 * sideways + 0.14 * m.head[0] * (1 - sideways) + 0.18 * covered,
        0.11 * rub * Math.sin(t * 6 - 0.2) -
          0.15 * slowLook * m.head[0] -
          0.068 * m.balance * typing -
          0.04 * m.head[0] +
          0.052 * sideways + 0.046 * (1 - sideways) * (1 - typing) * (1 - heat) +
          r * 0.025 * Math.sin(t * 24)
      );
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1,
          eye = c.eyes[i],
          blink =
            1 -
            0.96 *
              clamp(1 - Math.abs(((t + (c.long ? 0.6 : 0)) % 4.7) - 3.2) / 0.1);
        const openness =
          (1 + 0.15 * slowLook + 0.12 * m.lookup) *
          (1 - (c.long ? 0.26 : 0.32) * d) *
          (1 - 0.25 * heat) *
          (1 - 0.89 * h) *
          (1 - 0.95 * n) *
          (1 - 0.96 * covered);
        eye.lid.scale.y = Math.max(
          0.04,
          Math.min(blink, 1 - 0.94 * m.reliefBlink) * openness
        );
        eye.lid.rotation.z = s * (0.015 + 0.08 * d + 0.29 * heat);
        eye.gaze.value.set(
          m.gaze[0] * (0.21 + 0.085 * slowLook),
          0.035 - 0.06 * typing + 0.14 * m.gaze[1]
        );
        eye.pupil.value.set(
          (0.71 + 0.13 * m.hunt + 0.055 * slowLook + 0.075 * m.lookup) *
            (1 - 0.22 * d) *
            (1 - 0.26 * heat),
          0.825 + 0.055 * m.hunt
        );
        const e = c.ears[i];
        e.rotation.z =
          -s *
            (0.21 +
              0.58 * heat +
              0.08 * d +
              0.19 * m.earBounce -
              0.11 * m.lookup) +
          0.019 * Math.sin(t * 2.7 + i);
        e.rotation.x = -0.22 * heat + 0.06 * m.earBounce;
        const pp = m.paws[i].pos,
          baseX = -0.12 - 0.43 * sideways + leanX * 0.78,
          reachSide = i === 0 ? sideways : 0,
          root = V(
            baseX + s * 0.31 - 0.21 * reachSide,
            1.76 - dip * 0.39,
            0.52 + leanZ * 0.71 - 0.06 * reachSide
          ),
          end = covered
            ? c.head.localToWorld(V(s * 0.425, 0.155, 0.91))
            : V(pp.x, pp.y, pp.z);
        const away = Math.abs(end.x - root.x);
        const elbow = V(
          mix(root.x, end.x, 0.48) + s * (0.08 + 0.055 * away),
          mix(root.y, end.y, 0.48) + 0.085 * typing,
          mix(root.z, end.z, 0.4) + 0.1
        );
        const curl = clamp((end.y - 0.37) * 2) * (1 - sideways) * (1 - n);
        // Pull the elbow in behind the wrist so the reaching foreleg has a visible bend.
        if (i === 0) {
          elbow.x += 0.17 * sideways;
          elbow.y -= 0.16 * sideways;
          elbow.z -= 0.12 * sideways;
        }
        elbow.x += s * 0.16 * curl + s * 0.29 * covered;
        elbow.z += 0.11 * curl;
        elbow.y -= 0.19 * curl;
        // Carry the extended foreleg onto the mouse, then roll over the toe pad.
        const extension = i === 0 && !covered ? sideways : 0;
        const wrist = V(
          mix(elbow.x, end.x, 0.78) - 0.13 * extension,
          end.y + 0.13 - 0.12 * curl + 0.085 * extension,
          mix(elbow.z, end.z, 0.8)
        );
        const armPoints = [
          V(root.x - 0.08 * s, root.y + 0.12, root.z - 0.48),
          V(
            mix(root.x, elbow.x, 0.47),
            mix(root.y, elbow.y, 0.48),
            mix(root.z, elbow.z, 0.42)
          ),
          elbow,
          wrist,
          V(
            end.x - 0.118 * extension,
            end.y + 0.072 - 0.035 * extension,
            end.z - 0.045 + 0.18 * extension
          ),
        ];
        c.arms[i].pose(armPoints);
        c.feet[i].children[0].scale.set(
          0.216 * (1 - 0.19 * extension),
          0.160 * (1 - 0.24 * extension),
          0.246 * (1 - 0.16 * extension)
        );
        c.feet[i].position.copy(end);
        c.feet[i].rotation.z =
          s * 0.39 * covered +
          clamp((root.x - end.x) * 0.24, -0.53, 0.53) +
          s * 0.52 * curl;
        c.hind[i].position.set(
          0.05 + s * 0.71 + 0.07 * sideways,
          0.099,
          0.51 + (i ? -0.04 : 0.03) * sideways
        );
      }
      const [mx, mz] = m.mouseOffset;
      this.mouse.position.set(-2.32 + mx, 0.14, 1.82 + mz);
      if (
        Math.abs(mx - this.cablePos[0]) + Math.abs(mz - this.cablePos[1]) >
          0.001 ||
        !Number.isFinite(this.cablePos[0])
      ) {
        this.cordPath[0].set(-2.32 + mx, 0.095, 2.19 + mz);
        this.cordPath[1].set(-2.4 + mx * 0.8, 0.027, 2.41 + mz * 0.73);
        this.cordPath[2].set(-2.52 + mx * 0.32, 0.018, 2.6 + mz * 0.33);
        this.cable.pose(this.cordPath);
        this.cablePos[0] = mx;
        this.cablePos[1] = mz;
      }
      for (let i = 0; i < 2; i++) {
        const cap = this.mouseCaps[i];
        cap.position.y = 0.065 - 0.045 * m.press[i];
        cap.rotation.x = 0.11 * m.press[i];
        cap.material.color
          .copy(this.mouseRestColor)
          .lerp(this.mousePressColor, m.press[i]);
      }
      this.wheel.rotation.x = m.wheelAngle;
      this.wheel.position.y = 0.158 - 0.046 * m.press[2];
      const badgeMask = m.press.reduce(
        (bits, p, i) => bits | (p > 0.26 ? 1 << i : 0),
        0
      );
      const direction = t < m.scrollUntil ? m.scrollSign : 0;
      this.inputBadge.visible = Boolean(badgeMask || direction);
      if (this.inputBadge.visible) {
        const pattern = badgeMask + ',' + direction;
        if (!this.badgeMaps.has(pattern))
          this.badgeMaps.set(pattern, pointerStamp(badgeMask, direction));
        this.inputBadge.material.map = this.badgeMaps.get(pattern);
        this.inputBadge.position.set(-2.73 + mx, 0.63, 1.8 + mz);
      }
      const slam = m.tailBeat,
        wave = Math.sin(t * 2.6),
        whip = Math.sin(t * 8.4),
        up = 0.1 * wave + 0.14 * d * whip;
      const tailBaseX = 0.68 + 0.26 * sideways,
        tx = 2.02 + 0.34 * sideways + 0.33 * slam;
      const tip = V(
        tx,
        0.99 +
          0.09 * wave * (1 - slam) +
          up * (1 - slam) -
          0.79 * slam -
          0.61 * n,
        -0.32 + 1.86 * slam
      );
      c.tail.pose(
        [
          V(tailBaseX, 0.43, -0.55),
          V(tailBaseX + 0.38, 0.4, -0.65),
          V(tx - 0.49, 0.54 + 0.15 * up - 0.24 * slam, -0.57 + 0.22 * slam),
          V(tx - 0.23, 1.13 + up - 1.01 * slam - 0.69 * n, -0.42 + 1.22 * slam),
          tip,
        ],
        c.long ? 1.1 : 1
      );
      this.anger.visible = r > 0.2;
      this.anger.position.set(hx - 0.62, c.head.position.y + 0.83, hz + 0.32);
      this.anger.material.rotation = -0.14 + 0.06 * Math.sin(t * 18);
      this.anger.material.opacity = clamp(r * 1.7);
      this.spark.visible = slam > 0.8 && r > 0.2;
      this.spark.position.copy(tip);
      this.spark.position.z += 0.12;
      this.spark.material.opacity = clamp((slam - 0.79) * 6);
      for (const [code, cap] of this.caps) {
        const depth = m.keyDepth(code, t);
        if (depth === cap.depth) continue;
        cap.depth = depth;
        this.capMatrix.makeTranslation(
          cap.key.x,
          0.112 - 0.046 * depth,
          cap.key.z
        );
        this.capTint
          .copy(cap.base)
          .lerp(code === 'Backspace' ? View.coral : View.green, 0.86 * depth);
        cap.batch.setMatrixAt(cap.index, this.capMatrix);
        cap.batch.setColorAt(cap.index, this.capTint);
        cap.batch.instanceMatrix.needsUpdate = true;
        cap.batch.instanceColor.needsUpdate = true;
      }
      this.updateLabels(m, t);
      this.renderer.render(this.scene, this.camera);
    }
    updateLabels(m, t) {
      const hits = m.hits
        .filter((e) => t >= e.at && t - e.at < 0.57)
        .slice(-this.labels.length);
      for (let i = 0; i < this.labels.length; i++) {
        const sprite = this.labels[i],
          hit = hits[i];
        sprite.visible = !!hit;
        if (!hit) continue;
        const k = layout.get(hit.code),
          word = this.privateKeys ? '•' : labelName(k),
          age = (t - hit.at) / 0.57;
        if (!this.labelMaps.has(word))
          this.labelMaps.set(word, labelTexture(word));
        if (sprite.material.map !== this.labelMaps.get(word)) {
          sprite.material.map = this.labelMaps.get(word);
          sprite.material.needsUpdate = true;
        }
        const w = word.length > 2 ? 0.65 : 0.44;
        sprite.scale.set(w, 0.29, 1);
        sprite.position.set(
          k.x + 0.07 * Math.sin(hit.phase) * age,
          0.4 + age * 0.98,
          k.z + 0.05
        );
        sprite.material.opacity = age < 0.68 ? 1 : clamp((1 - age) / 0.32);
      }
    }
  }
  View.green = new T.Color('#b7cb76');
  View.coral = new T.Color('#e99070');
  globalThis.PawScene = { View, palettes };
})();
