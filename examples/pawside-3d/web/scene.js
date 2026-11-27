/* Original silhouette study. Coordinates are desk units; +Z points towards the viewer. */
(function () {
  'use strict';
  const T = THREE;
  const { layout, paperLayout, paperDesk, clamp, mix, mouseX, keyPalmHeight } = PawMotion;
  const { palettes, normalize, patterns } = PawLooks;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const globe = new T.SphereGeometry(1, 42, 28);
  const keyCap = { bottom: 0.112, height: 0.07, travel: 0.046 };
  const padHeight = 0.133;
  const padCompression = 0.085;
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
  function whisker(head, mat, points, radius = 0.0085) {
    const path = new T.CubicBezierCurve3(...points.map((p) => V(...p)));
    const rings = 22, sides = 7;
    const geom = new T.TubeGeometry(path, rings, radius, sides, false);
    const pos = geom.attributes.position, center = V(0,0,0), point = V(0,0,0);
    for (let j = 0; j <= rings; j++) {
      const t = j / rings;
      path.getPointAt(t, center);
      const taper = (0.45 + 0.55 * T.MathUtils.smoothstep(t, 0, 0.23)) * (1 - 0.91 * t * t);
      for (let k = 0; k <= sides; k++) {
        const i = j*(sides+1) + k;
        point.fromBufferAttribute(pos,i).sub(center).multiplyScalar(taper).add(center);
        pos.setXYZ(i,point.x,point.y,point.z);
      }
    }
    return mesh(head,geom,mat);
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
  // Short guard hairs break the cheek silhouette. Each tapered strip grows
  // from the same head profile and stays attached as the character turns.
  function cheekFur(head, tint, long, form) {
    if (form.furFuzz === 0) return;
    const points = [], colors = [], indices = [];
    let seed = 73;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const strands = long ? 560 : 104;
    for (const side of [-1, 1]) {
      for (let i = 0; i < strands; i++) {
        const y = -.64 + 1.16*random();
        const angle = -.97 + 1.75*random();
        const [rx,rz,cz] = headSection(y, long, form);
        const x = side*rx*Math.cos(angle);
        const z = cz+rz*Math.sin(angle);
        const root = V(x*.996,y,z);
        const normal = V(side*Math.cos(angle),y*.95,Math.sin(angle)*1.32).normalize();
        const direction = V(side*.50,-.88,-.20);
        direction.addScaledVector(normal,-direction.dot(normal)).normalize();
        const width = V(0,0,0).crossVectors(normal,direction).normalize();
        const atCheek = 1-T.MathUtils.smoothstep(y,-.15,.49);
        const length = (.035+.047*random())*(.55+.65*atCheek)*(long?1.58:0.70)*form.furFuzz;
        const halfWidth = .004+.006*random();
        const mid = root.clone().addScaledVector(direction,length*.53).addScaledVector(normal,.009);
        const tip = root.clone().addScaledVector(direction,length).addScaledVector(normal,.008+.018*random());
        const index = points.length/3;
        const shade = .90+.20*random();
        for (const [center,radius,light] of [[root,-halfWidth,.98],[root,halfWidth,.98],
          [mid,-halfWidth*.54,1.09],[mid,halfWidth*.54,1.09],[tip,0,1.33]]) {
          const vertex = center.clone().addScaledVector(width,radius);
          points.push(vertex.x,vertex.y,vertex.z);
          colors.push((tint.r+.005)*shade*light,(tint.g+.005)*shade*light,(tint.b+.006)*shade*light);
        }
        indices.push(index,index+1,index+2,index+1,index+3,index+2,index+2,index+3,index+4);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    mesh(head,geometry,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));
  }
  // Both the head mesh and its attachments sample the same smooth surface.
  // The broad cheek plane narrows into the chin; the muzzle projects forward.
  function headSection(y, long, form) {
    const v = clamp((y - 0.015) / 0.805, -1, 1);
    const circle = Math.sqrt(Math.max(0, 1 - v * v));
    const lower = Math.exp(-(((v + 0.30) / 0.54) ** 2));
    const temple = (0.074 + .21*(form.forehead-1)) * Math.exp(-(((v - 0.54) / 0.40) ** 2));
    const jawline = .35*(form.jaw-1)*Math.exp(-(((v + .72) / .32) ** 2));
    const cheek = 1.0 - 0.075 * v + ((long ? .087 : .065) + .28*(form.cheeks-1))*lower + temple + jawline;
    return [
      circle * cheek * (1.0 + 0.027*lower),
      circle * (0.753 - 0.040 * v),
      -0.060 + 0.055 * (1 - v)
    ];
  }
  function muzzleRelief(x, y, form) {
    const padX = (Math.abs(x) / form.muzzleWidth - 0.17) / 0.225;
    const padY = (y + 0.255 - .75*form.noseLift) / 0.178;
    const bridge = Math.exp(-((x / 0.13) ** 2) - ((y + 0.055) / 0.28) ** 2);
    return form.muzzleDepth * (0.166 * Math.exp(-padX * padX - padY * padY) + 0.064 * bridge);
  }
  function faceDepth(x, y, long, form) {
    const [rx, rz, z] = headSection(y, long, form);
    const front = Math.sqrt(Math.max(0, 1 - (x / Math.max(0.001, rx)) ** 2));
    return z + rz * front + muzzleRelief(x, y, form) * front * front;
  }
  function kittenHead(head, mat, long, form) {
    const geo = new T.SphereGeometry(1, 72, 48);
    const pos = geo.attributes.position;
    const normal = geo.attributes.normal;
    const surface = (u, v) => {
      const y = 0.015 + 0.805 * Math.sin(v);
      const [rx, rz, z] = headSection(y, long, form);
      const x = rx * Math.cos(u), front = Math.sin(u);
      return V(x, y, z + rz * front + muzzleRelief(x, y, form) * Math.max(0, front) ** 2);
    };
    // Bounded finite differences give the two seam rows identical normals.
    for (let i = 0; i < pos.count; i++) {
      const v = Math.asin(clamp(pos.getY(i), -1, 1));
      const u = Math.atan2(pos.getZ(i), pos.getX(i));
      const point = surface(u, v);
      let n;
      if (Math.abs(pos.getY(i)) > 0.99999) n = V(0, Math.sign(pos.getY(i)), 0);
      else n = surface(u, v + 0.001).sub(surface(u, v - 0.001))
        .cross(surface(u + 0.001, v).sub(surface(u - 0.001, v))).normalize();
      pos.setXYZ(i, point.x, point.y, point.z);
      normal.setXYZ(i, n.x, n.y, n.z);
    }
    return mesh(head, geo, mat);
  }
  // Cross sections come from the same meshes that animate the seated torso.
  // The elbow can fold behind the wrist, but must stay on the visible side of the ribs.
  function ribSections(body, bent, opposite, sides) {
    const straight = body.geometry.attributes.position;
    const leaning = bent.geometry.attributes.position;
    const rings = [];
    for (let i = 0; i + sides <= straight.count; i += sides) {
      const section = (p) => {
        const right = p.getX(i), left = p.getX(i + sides/2);
        const front = p.getZ(i + sides/4), back = p.getZ(i + sides*3/4);
        return [(right+left)/2, (front+back)/2, (right-left)/2, (front-back)/2];
      };
      rings.push({
        y: straight.getY(i), rest: section(straight), left: section(leaning),
        right: opposite ? section(opposite.geometry.attributes.position) : null,
      });
    }
    return rings;
  }
  function ribSlice(body, rings, height) {
    const m = body.parent.matrix.elements;
    const y = (height - m[13]) / m[5];
    const right = body.morphTargetInfluences[1] || 0;
    const bend = right || body.morphTargetInfluences[0];
    const side = right ? 'right' : 'left';
    let index = 1;
    while (index + 1 < rings.length && rings[index].y < y) index++;
    const lo = rings[index - 1], hi = rings[index];
    const t = clamp((y - lo.y) / (hi.y - lo.y));
    const at = (i) => mix(mix(lo.rest[i], lo[side][i], bend), mix(hi.rest[i], hi[side][i], bend), t);
    return { x: m[0] * at(0) + m[4] * y, z: m[10] * at(1) + m[6] * y,
      width: m[0] * at(2), depth: m[10] * at(3) };
  }
  function ribFront(section, x) {
    const u = (x - section.x) / section.width;
    return Math.abs(u) < 1 ? section.z + section.depth * Math.sqrt(1 - u * u) : -Infinity;
  }
  function frontOfRibs(body, rings, point) {
    return ribFront(ribSlice(body, rings, point.y), point.x);
  }
  // One indexed grid per moving surface. Its topology and storage survive each pose.
  class Sweep {
    constructor(parent, mat, segments, sides, controls) {
      this.rows = segments;
      this.cols = sides;
      this.curve = new T.CatmullRomCurve3(
        Array.from({ length: controls }, () => V(0, 0, 0)),
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
  }
  class Limb extends Sweep {
    constructor(parent, mat, radius, segments = 36) {
      super(parent, mat, segments, 20, 5);
      this.radius = radius;
      this.circle = Array.from({ length: this.cols }, (_, i) => {
        const angle = 2 * Math.PI * i / this.cols;
        return [Math.cos(angle), Math.sin(angle)];
      });
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
          const [cos, sin] = this.circle[k];
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
  // Shoulder, elbow, carpus and toes form one surface. The last fifth of the
  // curve runs along the paw instead of down the leg, so the foot can plant flat.
  class Foreleg extends Sweep {
    constructor(parent, mat, outlineMaterial, form) {
      super(parent, mat, 55, 32, 6);
      this.widthAxis = V(1, 0, 0);
      this.aim = V(0, 0, 1);
      this.crossSection = [];
      this.circle = [];
      const coatCoords = [];
      const outline = new T.SplineCurve([
        new T.Vector2(.12,.13), new T.Vector2(.24,.24), new T.Vector2(.276,.265),
        new T.Vector2(.246,.242), new T.Vector2(.205,.204), new T.Vector2(.173,.17),
        new T.Vector2(.148,.142), new T.Vector2(.165,.137), new T.Vector2(.208,.133),
        new T.Vector2(.184,.112), new T.Vector2(0,0)
      ]);
      for (let k = 0; k < this.cols; k++) {
        const q = 2 * Math.PI * k / this.cols;
        this.circle.push([Math.cos(q), Math.sin(q)]);
      }
      for (let j = 0; j <= this.rows; j++) {
        const t = j / this.rows;
        const radii = outline.getPoint(t);
        // An elliptical toe dome has a vertical tangent at its very front.
        if (t >= .8) {
          const dome = Math.sqrt(Math.max(0, 1 - ((t - .8) / .2) ** 2));
          // Keep the sole height fixed. Sculpt the toe envelope in plan view.
          radii.set(.208 * dome ** form.pawRound, padHeight * dome);
        }
        radii.x *= 1 + (form.pawWidth - 1) * T.MathUtils.smoothstep(t, .46, .78);
        this.crossSection.push(radii);
        for (const [x, y] of this.circle) coatCoords.push(t, x, y);
      }
      this.mesh.geometry.setAttribute('pawPoint', new T.Float32BufferAttribute(coatCoords, 3));
      if (outlineMaterial) {
        // Share the deformed surface. The outline does not participate in paw contacts.
        const outline = mesh(parent, this.mesh.geometry, outlineMaterial);
        outline.frustumCulled = false;
      }
    }
    // At the shoulder the two skins share the chest's lighting normal. Fade to
    // the leg normal as it clears the ribs, including when the torso leans.
    blendShoulder(body, ribs) {
      const point = this.center;
      const chestNormal = this.cross;
      const legNormal = this.axis;
      for (let j = 0; j <= this.rows * 0.36; j++) {
        const t = j / this.rows;
        this.curve.getPoint(t, point);
        const section = ribSlice(body, ribs, point.y);
        const above = ribSlice(body, ribs, point.y + 0.035);
        const below = ribSlice(body, ribs, point.y - 0.035);
        const nearRoot = 1 - T.MathUtils.smoothstep(t, 0.20, 0.36);
        for (let k = 0; k < this.cols; k++) {
          const index = j * this.cols + k;
          const x = this.pos.getX(index), z = this.pos.getZ(index);
          const front = ribFront(section, x);
          const blend = nearRoot * (1 - T.MathUtils.smoothstep(z - front, 0.03, 0.24));
          if (!blend) continue;
          const top = ribFront(above, x), bottom = ribFront(below, x);
          if (!Number.isFinite(top + bottom)) continue;
          const u = (x - section.x) / section.width;
          chestNormal.set(section.depth * u / (section.width * Math.sqrt(Math.max(0.002, 1 - u*u))),
            (bottom - top) / 0.07, 1).normalize();
          legNormal.fromBufferAttribute(this.normal, index).lerp(chestNormal, blend).normalize();
          this.normal.setXYZ(index, legNormal.x, legNormal.y, legNormal.z);
        }
      }
    }
    place(shoulder, palm, side, reach, cover, squash, body, ribs) {
      const [root, upper, elbow, wrist, pad, toe] = this.curve.points;
      pad.copy(palm);
      const lift = clamp((palm.y - .45) / .75);
      root.copy(shoulder);
      root.x -= side * 0.13;
      root.y += 0.24;
      root.z -= 0.25;
      upper.copy(shoulder);
      upper.x += side * 0.042;
      upper.y -= 0.105;
      upper.z += 0.074;
      elbow.lerpVectors(upper, palm, 0.49);
      // The humerus folds back along the ribs; the wrist stays over the paw.
      elbow.x += side * (0.075 + 0.19 * lift - 0.23 * reach);
      elbow.y -= 0.16 + 0.18 * lift - 0.11 * reach;
      elbow.z -= .23 + .17 * lift;
      elbow.z = Math.max(elbow.z, frontOfRibs(body, ribs, elbow) + 0.045);
      this.aim.set(
        clamp((palm.x - shoulder.x) * .37, -.60, .60) * (1 - cover) - side*.12*cover,
        -.10 - .21 * reach + .13 * lift + 1.12 * cover,
        1 - .82 * cover
      ).normalize();
      wrist.copy(palm).addScaledVector(this.aim, -.205);
      wrist.y += .16 - .09 * cover;
      wrist.z -= .047 * lift;
      wrist.z = Math.max(wrist.z, frontOfRibs(body, ribs, wrist) + .01);
      toe.copy(palm).addScaledVector(this.aim, .235);
      // Transport width backwards from the toes. Both paws keep their soles
      // facing the desk at contact and turn them towards the viewer at the eyes.
      this.widthAxis.set(this.aim.z, 0, -this.aim.x).normalize();
      for (let j = this.rows; j >= 0; j--) {
        const t = j / this.rows;
        this.curve.getPoint(t, this.center);
        this.curve.getTangent(t, this.next);
        this.widthAxis.addScaledVector(this.next, -this.widthAxis.dot(this.next)).normalize();
        this.cross.crossVectors(this.next, this.widthAxis);
        const shape = this.crossSection[j];
        const pressure = squash * T.MathUtils.smoothstep(t, .62, .8);
        const width = shape.x * (1 + .085 * pressure + .12 * cover * T.MathUtils.smoothstep(t, .62, .8));
        const height = shape.y * (1 - padCompression * pressure);
        for (let k = 0; k < this.cols; k++) {
          const [cos, sin] = this.circle[k];
          const a = cos * width, b = sin * height;
          this.pos.setXYZ(j * this.cols + k,
            this.center.x + a*this.widthAxis.x + b*this.cross.x,
            this.center.y + a*this.widthAxis.y + b*this.cross.y,
            this.center.z + a*this.widthAxis.z + b*this.cross.z);
        }
      }
      this.pos.needsUpdate = true;
      this.mesh.geometry.computeVertexNormals();
      this.blendShoulder(body, ribs);
      // The coincident vertices on the tip share the tangent normal.
      for (let k = 0; k < this.cols; k++)
        this.normal.setXYZ(this.rows * this.cols + k, this.aim.x, this.aim.y, this.aim.z);
      this.normal.needsUpdate = true;
    }
  }
  function paintedCoat(shader, form, shade, illustration) {
    shader.uniforms.lightPower = { value: form.lightPower };
    shader.uniforms.shadeTint = { value: shade };
    shader.uniforms.illustration = { value: illustration ? 1 : 0 };
    shader.fragmentShader = 'uniform float lightPower, illustration; uniform vec3 shadeTint;\n' +
      shader.fragmentShader.replace('#include <color_fragment>',
        'float coatContact = 0.0;\n#include <color_fragment>').replace(
        '#include <opaque_fragment>', `
        vec3 pigment = diffuseColor.rgb;
        vec3 coatNormal = normalize(normal);
        float keyLight = dot(coatNormal, vec3(-0.36, 0.82, 0.44));
        float luminance = dot(pigment, vec3(.213,.715,.072));
        float matte = max(illustration, smoothstep(.034,.19,luminance));
        float sky = smoothstep(-.26,.89,keyLight);
        float bounce = smoothstep(-.30,.89,dot(coatNormal,vec3(.78,-.35,.52)));
        vec3 darkCoat = pigment*(.72+.46*sky+.12*bounce) + vec3(.0054,.0061,.0090)*sky*sky;
        darkCoat = mix(mix(pigment,darkCoat,lightPower),shadeTint,.13*(1.0-sky));
        // Use the local pigment for spots and white socks, with a wash of the
        // chosen shadow tint so the whole palette stays in the same family.
        vec3 shadow = mix(pigment*vec3(.76,.72,.70),shadeTint,.16);
        float plane = smoothstep(mix(-.36,-.14,illustration),mix(.62,.42,illustration),keyLight);
        vec3 paint = mix(pigment,shadow,clamp((1.0-plane)*lightPower*.64,0.0,.84));
        float overlap = clamp(coatContact,0.0,.65);
        outgoingLight = mix(darkCoat,paint,matte)*(1.0-overlap*.53);
        #include <opaque_fragment>
      `);
  }
  function innerEar(fur, paint) {
    const { form, tones, lit, id } = paint;
    const mat = fur.clone();
    mat.onBeforeCompile = (shader) => {
      lit(shader);
      shader.uniforms.earTint = { value: tones.ear };
      shader.uniforms.earStripe = { value: tones.stripe };
      shader.uniforms.earInside = { value: form.earInside };
      shader.uniforms.earPoints = { value: form.pattern === 'point' ? form.patternAmount : 0 };
      shader.vertexShader = 'varying vec3 earPoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nearPoint=position;'
      );
      shader.fragmentShader =
        'varying vec3 earPoint; uniform vec3 earTint, earStripe; uniform float earInside, earPoints;\n' +
        shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float height = (earPoint.y - 0.33) / 0.34;
         float width = 0.215 * (1.0 - 0.72*clamp(height,0.0,1.0));
         vec2 shape = vec2((earPoint.x - 0.018*sign(earPoint.x)*height)/width, (height-0.34)/0.85);
         float inside = (1.0-smoothstep(0.69,1.06,length(shape)/earInside))*smoothstep(0.015,0.075,earPoint.z);
         float bowl = .68 + .32 * smoothstep(-.45,.70,shape.y);
         float fold = exp(-6.8*dot(shape-vec2(0.0,-.33),shape-vec2(0.0,-.33)));
         diffuseColor.rgb = mix(diffuseColor.rgb,earStripe,earPoints*smoothstep(.05,.48,earPoint.y));
         diffuseColor.rgb = mix(diffuseColor.rgb,earTint*bowl,inside*.86);
         coatContact = .44*inside*fold;`
      );
    };
    mat.customProgramCacheKey = () => 'ear:' + id;
    return mat;
  }
  function forelegOutline(tones, form) {
    const { fur: furColor, shade } = tones;
    const luma = .213*furColor.r + .715*furColor.g + .072*furColor.b;
    const lightCoat = T.MathUtils.smoothstep(luma, .036, .21);
    const line = furColor.clone().lerp(new T.Color('#aaa39a'), .32).lerp(shade, lightCoat);
    const mat = new T.MeshBasicMaterial({
      color: line,
      side: T.BackSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.furBase = { value: furColor };
      shader.uniforms.armLine = { value: form.armLine * mix(1, .77, lightCoat) };
      shader.vertexShader = 'attribute vec3 pawPoint; varying float contour; uniform float armLine;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float along = smoothstep(0.27, 0.57, pawPoint.x) *
           (1.0 - smoothstep(0.89, 1.0, pawPoint.x));
         float offDesk = smoothstep(0.026, 0.16, position.y);
         contour = along * offDesk;
         transformed += normalize(normal) * (0.029 * contour * armLine);`
      );
      shader.fragmentShader = 'varying float contour; uniform vec3 furBase;\n' + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.rgb = mix(furBase, diffuseColor.rgb, smoothstep(0.18, 0.85, contour));`
      );
    };
    return mat;
  }
  function forelegCoat(fur, paint, side) {
    const { form, tones, lit, id, contacts } = paint;
    const cuff = 1.04 - .40 * (side < 0 ? form.sockLeft : form.sockRight);
    const mat = fur.clone();
    mat.onBeforeCompile = (shader) => {
      lit(shader);
      shader.uniforms.armSide = { value: side };
      shader.uniforms.toeTint = { value: tones.paw };
      shader.uniforms.pawPoints = { value: form.pattern === 'point' ? form.patternAmount : 0 };
      shader.uniforms.pawStripe = { value: tones.stripe };
      shader.uniforms.padTint = { value: tones.pad };
      shader.uniforms.padAmount = { value: form.padAmount };
      shader.uniforms.cuff = { value: cuff };
      shader.uniforms.chestFromDesk = { value: contacts.chestFromDesk };
      shader.vertexShader = 'attribute vec3 pawPoint; uniform mat4 chestFromDesk; varying vec3 coatPoint, trunkPoint;\n' +
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\ncoatPoint=pawPoint;\ntrunkPoint=(chestFromDesk*modelMatrix*vec4(position,1.0)).xyz;');
      shader.fragmentShader =
        'varying vec3 coatPoint, trunkPoint; uniform vec3 toeTint, pawStripe, padTint; uniform float cuff, pawPoints, padAmount, armSide;\n' +
        shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float u = coatPoint.x, across = coatPoint.y, up = coatPoint.z;
          float hem = .019*up + .013*sin(across*5.0+up*3.0);
          float sock = smoothstep(cuff-.028,cuff+.032,u-hem);
          diffuseColor.rgb = mix(diffuseColor.rgb,pawStripe,pawPoints*smoothstep(.52,.95,u));
          diffuseColor.rgb = mix(diffuseColor.rgb,toeTint,sock*.91);
          float crease = (1.-smoothstep(.024,.093,abs(abs(across)-.35))) *
             smoothstep(.82,.91,u) * (1.-smoothstep(.94,.989,u)) * smoothstep(.35,.81,up);
          float fold = smoothstep(.15,.35,u)*(1.-smoothstep(.50,.70,u));
          float inside = smoothstep(.20,.95,-across*armSide)*(1.-smoothstep(.05,.74,up));
          float sole = smoothstep(.62,.82,u)*(1.-smoothstep(-.70,-.28,up));
          coatContact = .26*fold*inside + .19*sole + .40*crease;
          float bean = length(vec2((u-.794)/.071,across/.49));
          float digit = length(vec2((u-.906)/.035,(abs(across)-.52)/.21));
          float middle = length(vec2((u-.927)/.034,across/.20));
          float pad = (1.-smoothstep(.79,1.05,min(bean,min(digit,middle))))*(1.-smoothstep(-.80,-.53,up));
          diffuseColor.rgb = mix(diffuseColor.rgb,padTint,clamp(.90*pad*padAmount,0.0,1.0));`);
      paintedMarkings(shader, 'trunkPoint', false, paint, '(1.0-smoothstep(.31,.67,coatPoint.x))');
    };
    mat.customProgramCacheKey = () => 'foreleg:' + id;
    return mat;
  }
  function paintedMarkings(shader, point, face, paint, coverage = '1.0') {
    const { form, tones } = paint;
    Object.assign(shader.uniforms, {
      markingMode: { value: patterns.findIndex(([id]) => id === form.pattern) },
      marking: { value: V(form.patternAmount, form.patternScale, form.patternShift) },
      markingLight: { value: tones.light },
      markingDark: { value: tones.stripe },
    });
    shader.fragmentShader = `
      uniform int markingMode;
      uniform vec3 marking, markingLight, markingDark;
      float coatPatch(vec2 pos, vec2 center, vec2 size) {
        return 1.0-smoothstep(.87,1.08,length((pos-center)/size));
      }
    ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 mark = ${face ? point + '.xy' : `vec2(${point}.x+.38*${point}.z,${point}.y*.64-.83)`};
      mark = mark/marking.y-vec2(marking.z,.10*marking.z);
      float a = 0.0, b = 0.0;
      if (markingMode==1) {
        a = ${face ? 'coatPatch(mark,vec2(0.0,-.29),vec2(.42,.25))*smoothstep(.48,.72,facePoint.z)' :
          'coatPatch(mark,vec2(.05,-.04),vec2(.41,.70))*smoothstep(.27,.74,trunkPoint.z)'};
      } else if (markingMode==2) {
        ${face ? `
          float mx = abs(mark.x);
          float forehead = smoothstep(.19,.36,mark.y)*(1.0-smoothstep(.61,.81,mark.y));
          float nearCenter = (mx-(.14-.27*(mark.y-.43)+.012*sin(9.0*mark.y)))/.042;
          float outside = (mx-(.35+.41*(mark.y-.42)+.014*cos(6.5*mark.y)))/.041;
          float cheekBars = smoothstep(.38,.91,cos(24.0*(mark.y+.22*mx)+.44*sin(8.1*mx)))
            *smoothstep(.50,.90,mx)*(1.0-smoothstep(-.02,.19,mark.y));
          b = clamp(forehead*(.90*exp(-nearCenter*nearCenter)+.69*exp(-outside*outside))+.68*cheekBars,0.0,1.0);
        ` : `
          float waves = cos(16.5*mark.y+5.0*mark.x*mark.x+1.5*sin(mark.x*4.5)+.52*sin(mark.y*6.0));
          b = smoothstep(.43,.88,waves)*smoothstep(.24,.96,abs(mark.x))*.76;
        `}
      } else if (markingMode==3) {
        a = max(coatPatch(mark,vec2(-.43,.46),vec2(.62,.45)),
          coatPatch(mark,vec2(.61,-.47),vec2(.69,.38)));
        b = max(coatPatch(mark,vec2(.54,.43),vec2(.47,.58)),
          coatPatch(mark,vec2(-.69,-.61),vec2(.49,.35)));
      } else if (markingMode==4) {
        b = ${face ? 'coatPatch(mark,vec2(.03,-.075),vec2(.68,.51))*smoothstep(.39,.65,facePoint.z)' :
          '.14*(1.0-smoothstep(-.82,-.35,mark.y+.18*sin(mark.x*3.0)))'};
      } else if (markingMode==5) {
        b = max(coatPatch(mark,vec2(-.47,.38),vec2(.61,.54)),
          coatPatch(mark,vec2(.68,-.43),vec2(.73,.54)));
      }
      float pigmentCoverage = marking.x*${coverage};
      diffuseColor.rgb = mix(diffuseColor.rgb,markingLight,a*pigmentCoverage);
      diffuseColor.rgb = mix(diffuseColor.rgb,markingDark,b*pigmentCoverage);
    `);
  }
  function torsoCoat(fur, paint) {
    const { form, tones, lit, id, contacts } = paint;
    const material = fur.clone();
    material.onBeforeCompile = (shader) => {
      lit(shader);
      shader.uniforms.bib = { value: V(form.bibWidth, form.bibHeight, form.bibAmount) };
      shader.uniforms.bibTint = { value: tones.light };
      shader.uniforms.chinShade = { value: form.chinShade };
      shader.uniforms.chinCenter = { value: contacts.chin };
      shader.uniforms.leftShoulder = { value: contacts.arms[0] };
      shader.uniforms.rightShoulder = { value: contacts.arms[1] };
      shader.vertexShader = 'varying vec3 trunkPoint, chestWorld;\n' +
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\ntrunkPoint=position;').replace('#include <project_vertex>',
          'chestWorld=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
      shader.fragmentShader = `
        varying vec3 trunkPoint, chestWorld;
        uniform vec3 bib, bibTint, chinCenter;
        uniform vec4 leftShoulder, rightShoulder;
        uniform float chinShade;
        float shoulderShadow(vec4 spot) {
          vec2 d = (chestWorld.xy-spot.xy)/vec2(.25,.44);
          return (1.0-smoothstep(.10,1.36,dot(d,d)))*spot.w;
        }
      ` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float x = trunkPoint.x+.045;
        float bibX = abs(x)/bib.x;
        float hem = 1.20-.62*bib.y + 1.78*bibX*bibX + .027*sin(23.0*bibX);
        float badge = smoothstep(hem-.055,hem+.097,trunkPoint.y)
          *(1.0-smoothstep(.43,.61,bibX))*smoothstep(.16,.36,trunkPoint.z);
        diffuseColor.rgb=mix(diffuseColor.rgb,bibTint,badge*bib.z);
        vec2 chinGap = (chestWorld.xy-chinCenter.xy)/vec2(chinCenter.z,.41);
        float neck = (1.0-smoothstep(.08,1.38,dot(chinGap,chinGap))) * .55 * chinShade;
        float shoulder = max(shoulderShadow(leftShoulder),shoulderShadow(rightShoulder));
        coatContact = smoothstep(.03,.45,trunkPoint.z)*(neck+shoulder);
      `);
      paintedMarkings(shader, 'trunkPoint', false, paint);
    };
    material.customProgramCacheKey = () => 'trunk:' + id;
    return material;
  }
  function makeCat(parent, id, appearance = {}, illustration = false) {
    const long = id === 'chestnut';
    const { coat: p, form: f } = normalize(id, appearance);
    const tones = Object.fromEntries(Object.entries(p).map(([name, value]) => [name, new T.Color(value)]));
    const mats = {};
    for (const [name, tint] of Object.entries(p)) {
      mats[name] =
        name === 'fur' || name === 'shade'
          ? new T.MeshLambertMaterial({ color: tint, side: T.DoubleSide })
          : color(tint);
    }
    const lightCoat = (shader) => paintedCoat(shader, f, tones.shade, illustration);
    mats.fur.onBeforeCompile = lightCoat;
    mats.fur.customProgramCacheKey = () => 'fur:' + id;
    const contacts = {
      chin: V(0, 2, .55),
      arms: [new T.Vector4(), new T.Vector4()],
      chestFromDesk: new T.Matrix4(),
    };
    const paint = { form: f, tones, lit: lightCoat, id, contacts };
    const armOutline = f.armLine > 0 ? forelegOutline(tones, f) : null;
    const earCoat = innerEar(mats.fur, paint);
    const depth = (x, y) => faceDepth(x, y, long, f);
    const noseTint = mats.nose;
    mats.sole = color(long ? '#f4d3af' : '#f1ede2');
    const root = group(parent),
      trunk = group(root),
      head = group(root);
    const torsoProfile = [
      [0.035, 0.56, 0.48, 0.08, -0.18],
      [0.15, 0.96, 0.83, 0.07, -0.20],
      [0.50, 1.12, 0.97, 0.07, -0.19],
      [0.97, 1.11, 0.99, 0.04, -0.13],
      [1.48, 0.99, 0.89, -0.02, -0.05],
      [1.94, 0.82, 0.75, -0.07, 0.02],
      [2.34, 0.59, 0.57, -0.11, 0.08],
      [2.64, 0.37, 0.39, -0.12, 0.10],
    ];
    const leanProfile = [
      [0.035, 0.69, 0.53, 0.29, -0.14],
      [0.14, 1.11, 0.78, 0.30, -0.18],
      [0.50, 1.32, 0.93, 0.20, -0.17],
      [1.00, 1.25, 0.94, 0.03, -0.10],
      [1.54, 1.08, 0.85, -0.25, -0.02],
      [2.00, 0.84, 0.73, -0.55, 0.06],
      [2.36, 0.62, 0.59, -0.81, 0.11],
      [2.64, 0.39, 0.42, -0.98, 0.13],
    ];
    const body = skinSurface(trunk, mats.fur, torsoProfile);
    const sideShape = skinSurface(trunk, mats.fur, leanProfile);
    const bends = [sideShape];
    const opposite = illustration ? skinSurface(trunk, mats.fur,
      leanProfile.map(([y,w,d,x,z], i) => [y,w,d,2*torsoProfile[i][3]-x,z])) : null;
    if (opposite) bends.push(opposite);
    body.geometry.morphAttributes.position = bends.map(shape => shape.geometry.attributes.position.clone());
    body.geometry.morphAttributes.normal = bends.map(shape => shape.geometry.attributes.normal.clone());
    body.updateMorphTargets();
    const ribs = ribSections(body, sideShape, opposite, 48);
    for (const shape of bends) {
      trunk.remove(shape);
      shape.geometry.dispose();
    }
    body.material = torsoCoat(mats.fur, paint);
    // The forehead, jowls and tucked chin share a continuous egg-shaped surface.
    const faceCoat = mats.fur.clone();
    const eyeX = .392 + f.eyeSpace;
    const eyeY = .116 + f.eyeLift;
    const eyeSize = new T.Vector4(Math.min(.281 * f.eyeWidth, eyeX - .031),
      (long ? .229 : .258) * f.eyeHeight, eyeX, eyeY);
    // Each eye lives on the curved face. The gaze stays in head coordinates
    // when the kitten turns, and blinking closes the upper lid over the iris.
    const eyes = [-1, 1].map(() => ({
      pupil: new T.Vector4(0, 0, 0.47, 0.89),
      lid: new T.Vector2(1, 0),
    }));
    faceCoat.onBeforeCompile = (shader) => {
      lightCoat(shader);
      shader.uniforms.tabbyStripe = { value: mats.stripe.color };
      shader.uniforms.muzzleTint = { value: tones.muzzle };
      shader.uniforms.cheekTint = { value: tones.cheek };
      shader.uniforms.facePaint = { value: new T.Vector4(f.muzzleWidth, f.noseLift, f.muzzleMark, f.blaze) };
      shader.uniforms.faceGrain = { value: f.furGrain };
      shader.uniforms.blazeTint = { value: tones.light };
      shader.vertexShader = 'varying vec3 facePoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nfacePoint=position;'
      );
      shader.fragmentShader = `
        varying vec3 facePoint;
        uniform vec3 cheekTint, muzzleTint, tabbyStripe, blazeTint;
        uniform vec4 facePaint;
        uniform float faceGrain;
      ` + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // A faint broken wash keeps the cheeks quiet at desktop scale.
         vec2 nap = vec2(abs(facePoint.x),facePoint.y);
         float along = nap.x * 0.48 + nap.y + 0.30*nap.x*nap.x;
         float phase = 68.0*along + 1.8*sin(nap.x*18.0+along*16.0);
         float grain = sin(phase)*sin(nap.x*53.0-along*15.0)*(1.0-smoothstep(.55,2.6,fwidth(phase)));
         float sidePlane = smoothstep(.25,.74,nap.x) * smoothstep(-.79,-.57,nap.y);
         diffuseColor.rgb *= 1.0 + .021*grain*sidePlane*faceGrain;
         vec2 cheek = (vec2(abs(facePoint.x),facePoint.y)-vec2(.69,-.22))/vec2(.29,.14);
         float warmth = (1.0-smoothstep(0.05,1.0,dot(cheek,cheek)))*smoothstep(.32,.68,facePoint.z);
         diffuseColor.rgb=mix(diffuseColor.rgb,cheekTint,0.24*warmth);
         vec2 pad = (vec2(abs(facePoint.x)/facePaint.x,facePoint.y-.75*facePaint.y) - vec2(.158,-.255)) / vec2(.217,.142);
         float mask = (1.-smoothstep(.58,1.22,length(pad))) * smoothstep(.63,.80,facePoint.z);
         diffuseColor.rgb=mix(diffuseColor.rgb,muzzleTint,min(1.0,mask*facePaint.z));
         float blazeWidth = .075 + .078*facePaint.w + .026*sin(facePoint.y*7.0);
         float faceBlaze = (1.0-smoothstep(.74,1.2,abs(facePoint.x+.026)/blazeWidth))
           *smoothstep(-.32,-.17,facePoint.y)*(1.0-smoothstep(.42,.60,facePoint.y))
           *smoothstep(.38,.64,facePoint.z);
         diffuseColor.rgb=mix(diffuseColor.rgb,blazeTint,faceBlaze*facePaint.w);
         vec2 browPoint = (vec2(abs(facePoint.x),facePoint.y)-vec2(.442,.367))/vec2(.226,.075);
         vec2 chinPoint = (facePoint.xy-vec2(0.0,-.46))/vec2(.26,.112);
         float browPlane = exp(-dot(browPoint,browPoint))*smoothstep(.40,.62,facePoint.z);
         vec2 bridgePoint = (facePoint.xy-vec2(0.0,-.028))/vec2(.096,.220);
         float bridge = exp(-dot(bridgePoint,bridgePoint))*smoothstep(.66,.78,facePoint.z);
         diffuseColor.rgb = mix(diffuseColor.rgb,muzzleTint,.10*bridge);
         float chin = exp(-dot(chinPoint,chinPoint))*smoothstep(.48,.68,facePoint.z);
         diffuseColor.rgb = mix(diffuseColor.rgb,muzzleTint,clamp((.19*browPlane+.38*chin)*facePaint.z,0.0,1.0));
         coatContact = .23*(1.0-smoothstep(-.73,-.42,facePoint.y));
         vec2 holes = (vec2(abs(facePoint.x),facePoint.y)-vec2(.135,-.26))/vec2(.265,.12);
         vec2 follicle = fract(holes*vec2(2.8,1.42)+vec2(.28*floor(holes.y*1.42),0.0))-.5;
         diffuseColor.rgb *= 1.0-.19*mask*(1.0-smoothstep(.03,.16,length(follicle)));
         ${long ? `float ax = abs(facePoint.x), y = facePoint.y;
         float brow = smoothstep(.26,.41,y)*(1.-smoothstep(.52,.67,y));
         float centerStroke = (ax-(.13+.13*(y-.34)))/.043;
         float outerStroke = (ax-(.37+.27*(y-.34)))/.047;
         float bars = exp(-centerStroke*centerStroke) + .73*exp(-outerStroke*outerStroke);
         float stripe = clamp(brow*bars*smoothstep(.27,.58,facePoint.z),0.,1.);
         diffuseColor.rgb=mix(diffuseColor.rgb,tabbyStripe,stripe*.70);
         vec2 ruffPoint = vec2((ax-.64)/.26, (y+.33-.13*(ax-.64))/.093);
         float ruff = exp(-dot(ruffPoint,ruffPoint));
         diffuseColor.rgb=mix(diffuseColor.rgb,muzzleTint,.43*ruff*smoothstep(.25,.53,facePoint.z));` : ''}`
      );
      paintedMarkings(shader, 'facePoint', true, paint);
      shader.uniforms.leftIris = { value: tones.eye };
      shader.uniforms.rightIris = { value: tones.eyeRight };
      shader.uniforms.eyeForm = { value: eyeSize };
      shader.uniforms.eyeTaper = { value: f.eyeTaper };
      shader.uniforms.irisFinish = { value: new T.Vector4(f.irisDetail, f.glintSize, f.glintStrength, f.lidShade) };
      shader.uniforms.leftPupil = { value: eyes[0].pupil };
      shader.uniforms.rightPupil = { value: eyes[1].pupil };
      shader.uniforms.leftLid = { value: eyes[0].lid };
      shader.uniforms.rightLid = { value: eyes[1].lid };
      shader.fragmentShader = `
        uniform vec3 leftIris, rightIris;
        uniform vec4 eyeForm, irisFinish, leftPupil, rightPupil;
        uniform vec2 leftLid, rightLid;
        uniform float eyeTaper;
      ` +
        shader.fragmentShader.replace('#include <opaque_fragment>', `
          vec4 pupil = facePoint.x < 0.0 ? leftPupil : rightPupil;
          vec2 lid = facePoint.x < 0.0 ? leftLid : rightLid;
          vec3 eyeTint = facePoint.x < 0.0 ? leftIris : rightIris;
          vec2 eye = (facePoint.xy - vec2(sign(facePoint.x)*eyeForm.z, eyeForm.w)) / eyeForm.xy;
          eye.y -= eye.x * lid.y;
          float boundary = length(eye * vec2(1.0, 1.0+(0.03+0.25*eyeTaper)*eye.x*eye.x)) - 1.0;
          float lower = -0.96 + 0.57 * min(eye.x*eye.x, 1.0);
          float upper = mix(lower, 1.15, smoothstep(0.04, 1.25, lid.x));
          float eyeEdge = max(boundary, eye.y - upper);
          float aa = clamp(fwidth(eyeEdge), 0.012, 0.16);
          float eyeMask = (1.0-smoothstep(-aa, aa, eyeEdge)) * smoothstep(0.36,0.58,facePoint.z)
            * smoothstep(0.055,0.20,lid.x);
          vec2 q = eye - pupil.xy;
          float pupilEdge = length(q / pupil.zw) - 1.0;
          float pupilAA = clamp(fwidth(pupilEdge), 0.02, 0.21);
          float rimDist = abs(boundary-.018);
          float socketRim = (1.0-smoothstep(.016,.069+aa,rimDist))*smoothstep(-.02,.64,-eye.y);
          outgoingLight += ${long ? 'vec3(.024,.018,.017)' : 'vec3(.010,.008,.011)'} *
            socketRim*smoothstep(.35,.62,facePoint.z)*smoothstep(.30,.88,lid.x);
          float irisRadius = length(q);
          float angle = atan(q.y,q.x);
          float fibers = sin(31.0*angle+3.0*irisRadius) * cos(9.0*angle-4.0*irisRadius);
          float detail = 1.0-smoothstep(.63,2.65,31.0*length(fwidth(q))/max(.3,irisRadius));
          float eyelidShadow = smoothstep(-.48,.89,eye.y);
          float irisTexture = mix(.080,.036,matte);
          vec3 iris = eyeTint * (1.06 - mix(.32,.26,matte)*eyelidShadow*irisFinish.w +
            irisTexture*fibers*detail*irisFinish.x);
          iris = mix(iris*.47,iris,1.0-smoothstep(.86,1.02,length(eye)));
          iris = mix(iris,iris*vec3(1.07,.81,.63),.48*(1.0-smoothstep(.50,.83,irisRadius)));
          vec3 eyePaint = mix(mix(vec3(.006,.005,.007),vec3(.022,.021,.022),.68*(1.0-smoothstep(-.78,.47,eye.y))), iris, smoothstep(-pupilAA,pupilAA,pupilEdge));
          // A single small window reflection, shared by both eyes.
          float reflection = length((q-vec2(-0.19,0.43))*vec2(1.0,0.89)) - 0.112*irisFinish.y;
          float lightAA = clamp(fwidth(reflection), 0.012, 0.10);
          eyePaint = mix(eyePaint,vec3(0.98,0.94,0.80),clamp(irisFinish.z*(1.0-smoothstep(-lightAA,lightAA,reflection)),0.0,1.0));
          float foldDist = abs(eye.y - (0.08 - .27*eye.x*eye.x));
          float closedArc = (1.0-smoothstep(.022,.080+aa,foldDist)) *
            (1.0-smoothstep(.60,.96,abs(eye.x)))*smoothstep(.36,.58,facePoint.z);
          outgoingLight = mix(outgoingLight, outgoingLight*.40, closedArc*(1.0-smoothstep(.09,.45,lid.x)));
          outgoingLight = mix(outgoingLight, eyePaint, eyeMask);
          #include <opaque_fragment>`
        );
    };
    // Colour markings are part of the coat, including through head turns.
    faceCoat.customProgramCacheKey = () => 'cheeks:' + id;
    kittenHead(head, faceCoat, long, f);
    cheekFur(head, tones.fur, long, f);
    head.scale.set((long ? 1.14 : 1.225)*f.headWidth,
      (long ? 1.22 : 1.205)*f.headHeight, (long ? 1.16 : 1.20)*f.headDepth);
    const ears = [],
      whiskers = [],
      arms = [],
      hind = [];
    for (const side of [-1, 1]) {
      const ear = group(head);
      ear.position.set(side * ((long ? 0.505 : 0.487) + f.earSpace), 0.315 + f.earLift, -0.080);
      const pinna = skinSurface(
        ear,
        earCoat,
        [
          [-0.095, 0.30, 0.25, -0.035 * side, 0],
          [0.16, 0.365, 0.28, -0.018 * side, 0],
          [0.40, 0.31, 0.24, 0.025 * side, 0],
          [0.59, 0.225, 0.17, 0.034 * side, -0.004],
          [0.71, 0.15, 0.111, 0.038 * side, -0.008],
          [0.781, 0.085, 0.064, 0.038 * side, -0.010],
          [0.809, 0.034, 0.028, 0.037 * side, -0.010],
          [0.814, 0.003, 0.003, 0.037 * side, -0.010],
        ],
        48
      );
      // The inner pinna is a shallow bowl. Pull only the front surface back,
      // leaving the rolled outer ear and the back silhouette in place.
      const pinnaPos = pinna.geometry.attributes.position;
      for (let v = 0; v < pinnaPos.count; v++) {
        const y = pinnaPos.getY(v), x = pinnaPos.getX(v), z = pinnaPos.getZ(v);
        if (z <= 0 || y < .16) continue;
        const width = Math.max(.042,.285-.35*(y-.26));
        const across = (x-side*.026)/width;
        const hollow = Math.exp(-2.2*across*across-(((y-.46)/.23)**2));
        pinnaPos.setZ(v,z-.124*hollow*T.MathUtils.smoothstep(z,.028,.13));
      }
      pinna.geometry.computeVertexNormals();
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
      }
      ear.scale.set((long ? 1.01 : 1.03)*f.earWidth, (long ? 1.08 : 1.13)*f.earLength, .97*f.earDepth);
      ears.push(ear);
      // Each strand starts on its own whisker pad, clears the cheek, then fans out.
      const fan = group(head);
      const whiskY = f.whiskerLift + .64*f.noseLift;
      const hingeX = .244*f.muzzleWidth;
      const hinge = V(side * hingeX, -.242 + whiskY, depth(hingeX, -.242 + whiskY));
      fan.position.copy(hinge);
      whiskers.push(fan);
      fan.visible = f.whiskerLength > 0;
      for (const [rootX, rootY, tipX, tipY, tipZ] of [
        [0.20, -0.219, 1.20, -0.115, 0.65],
        [0.27, -0.253, 1.29, -0.245, 0.62],
        [0.23, -0.296, 1.14, -0.415, 0.65]
      ]) {
        const startX = rootX*f.muzzleWidth, startY = rootY + whiskY;
        const startZ = depth(startX, startY);
        const points = [
          V(side * startX, startY, startZ + .006),
          V(side * mix(startX,.47,f.whiskerLength), startY + .044*f.whiskerSpread, startZ + .045),
          V(side * mix(startX,.87,f.whiskerLength), startY + .58*(tipY-rootY)*f.whiskerSpread + .055, .80),
          V(side * mix(startX,tipX+(long?.075:0),f.whiskerLength), startY + (tipY-rootY)*f.whiskerSpread,
            mix(startZ,tipZ,Math.min(1,f.whiskerLength)))
        ];
        if (fan.visible) whisker(fan, mats.whisk, points.map((point) => point.sub(hinge).toArray()), .0085*f.whiskerWidth);
      }
      if (f.whiskerLength > 0) {
        const brow = V(side*.65,.30,depth(.65,.30));
        const browPoints = [brow.toArray(),[side*.72,.39,brow.z+.015],
          [side*.86,.50,brow.z-.044],[side*.93,.57,brow.z-.13]]
          .map((p) => brow.clone().lerp(V(...p),f.whiskerLength).toArray());
        whisker(head,mats.whisk,browPoints,.0046*f.whiskerWidth);
      }
      const sleeve = forelegCoat(mats.fur, paint, side);
      arms.push(new Foreleg(root, sleeve, armOutline, f));
      const heel = group(root);
      // The top of the folded hind leg disappears into the flank. The broad
      // base narrows into the desk, leaving a single rounded outside contour.
      skinSurface(heel, mats.fur, [
        [-.092,.09,.12,0,.16], [-.057,.19,.23,0,.145],
        [.075,.24,.285,.018*side,.105], [.28,.263,.31,.055*side,-.02],
        [.52,.30,.36,.065*side,-.18], [.73,.24,.30,-.045*side,-.30],
        [.88,.09,.14,-.12*side,-.30]
      ], 40);
      heel.scale.set(f.hips, 1, .65+.35*f.hips);
      hind.push(heel);
    }
    const tail = new Limb(
      root,
      mats.fur,
      (t) => (long ? 0.175 + 0.108 * Math.sin(t * Math.PI) : 0.174 - 0.042 * t),
      60
    );
    if (f.tailBands > 0 || f.pattern === 'point') {
      const colors = [],
        shade = tones.fur,
        tip = tones.light;
      const ring = tones.stripe,
        shadeAt = new T.Color();
      for (let j = 0; j <= tail.rows; j++) {
        const u = j / tail.rows;
        const wave = Math.cos(2*Math.PI*(u*4/f.patternScale + f.patternShift));
        const bands = T.MathUtils.smoothstep(wave, .40, .82) * T.MathUtils.smoothstep(u, .16, .31);
        shadeAt
          .copy(shade)
          .lerp(ring, bands * f.tailBands * .90)
          .lerp(f.pattern === 'point' ? ring : tip,
            T.MathUtils.smoothstep(u,.70,.93) * (f.pattern === 'point' ? f.patternAmount : f.tailBands*.55));
        for (let k = 0; k < tail.cols; k++)
          colors.push(shadeAt.r, shadeAt.g, shadeAt.b);
      }
      tail.mesh.geometry.setAttribute(
        'color',
        new T.Float32BufferAttribute(colors, 3)
      );
      tail.mesh.material = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
      tail.mesh.material.onBeforeCompile = lightCoat;
      tail.mesh.material.customProgramCacheKey = () => 'tail:' + id;
    }
    const smile = group(head);
    const smileInk = color(long ? '#8a5d4b' : '#211b22');
    for (const side of [-1, 1]) {
      const lip = [[0,-.273], [.077,-.307 + .23*f.mouthSmile], [.15,-.284 + f.mouthSmile]];
      stroke(smile, smileInk, lip.map(([x,y]) => {
        x *= f.mouthWidth;
        y += f.noseLift;
        return [side*x,y,depth(x,y)+.009];
      }), .011);
    }
    const mouth = group(head);
    mouth.position.set(0, -.34 + f.noseLift, depth(0,-.34 + f.noseLift) + .050);
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
    const nose = skinSurface(head, noseTint, [
      [-0.062, 0.008, 0.008, 0, 0.016],
      [-0.045, 0.037, 0.028, 0, 0.015],
      [-0.017, 0.070, 0.046, 0, 0.008],
      [0.010, 0.087, 0.047, 0, 0],
      [0.032, 0.073, 0.034, 0, -0.009],
      [0.043, 0.027, 0.017, 0, -0.017]
    ], 32);
    nose.scale.set(.88*f.noseWidth, .82*f.noseHeight, .74*f.noseDepth);
    nose.position.set(0, -.185 + f.noseLift, depth(0,-.185 + f.noseLift) + .021);
    const nostril = color(long ? '#663f39' : '#352b32');
    for (const side of [-1,1]) {
      const slit = egg(nose,nostril,side*.053,.005,.035,.018,.006,.008);
      slit.rotation.z = side*.32;
    }
    const philtrum = [-.185-.049*f.noseHeight, -.257, -.273].map((y,i) => {
      y += f.noseLift;
      return [0,y,i === 0 ? nose.position.z+.013 : depth(0,y)+.012];
    });
    stroke(smile, smileInk, philtrum, .011);
    return {
      root,
      trunk,
      body,
      ribs,
      contacts,
      head,
      ears,
      eyes,
      whiskers,
      arms,
      hind,
      tail,
      nose,
      smile,
      mouth,
      long,
      form: f,
      eyeSize,
      faceDepth: depth,
    };
  }
  function capBase(depth) {
    return keyCap.bottom - keyCap.travel * depth;
  }
  function keyboard(parent, keys, illustration) {
    const caps = new Map(),
      deck = group(parent),
      base = color(illustration ? '#58675a' : '#252521');
    const keysTone = illustration ? ['#cb876e', '#dad7bb', '#f6efd8'] : ['#eab05e', '#e0dece', '#f7f5e9'];
    const width = 4.54*(illustration ? paperDesk.scale : 1);
    mesh(deck, slab(width, 1.6, 0.12, 0.14), base, illustration ? paperDesk.center : .42, -.03, 1.93);
    // Preserve the rounded edges at each width and draw equal-width keys together.
    const byWidth = new Map();
    for (const key of keys.values()) {
      const width = key.width.toFixed(3);
      if (!byWidth.has(width)) byWidth.set(width, []);
      byWidth.get(width).push(key);
    }
    const plastic = new T.MeshBasicMaterial({ vertexColors: true });
    const matrix = new T.Matrix4();
    for (const keys of byWidth.values()) {
      const geometry = slab(keys[0].width - 0.008, 0.205, keyCap.height, 0.034);
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
        const base = new T.Color(keysTone[accent ? 0 : modifier ? 1 : 2]);
        batch.setMatrixAt(index, matrix.makeTranslation(key.x, capBase(0), key.z));
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
  class SilhouettePass {
    constructor(renderer) {
      this.renderer = renderer;
      this.buffer = new T.WebGLRenderTarget(1, 1, {
        colorSpace: T.LinearSRGBColorSpace,
        samples: renderer.capabilities.isWebGL2 ? Math.min(2, renderer.capabilities.maxSamples) : 0,
      });
      this.offset = new T.Vector2();
      const material = new T.ShaderMaterial({
        uniforms: {
          sceneColor: { value: this.buffer.texture },
          pixelOffset: { value: this.offset },
          rimColor: { value: new T.Color('#b8b3a4') },
          rimSize: { value: 1 },
          rimPower: { value: 1 },
        },
        vertexShader: `
          varying vec2 screenUV;
          void main() {
            screenUV = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D sceneColor;
          uniform vec2 pixelOffset;
          uniform vec3 rimColor;
          uniform float rimSize, rimPower;
          varying vec2 screenUV;
          void main() {
            vec4 center = texture2D(sceneColor, screenUV);
            vec2 stepUV = pixelOffset*rimSize;
            float top = texture2D(sceneColor, screenUV + vec2(0.0, stepUV.y)).a;
            float left = texture2D(sceneColor, screenUV - vec2(stepUV.x, 0.0)).a;
            float bottom = texture2D(sceneColor, screenUV - vec2(0.0, stepUV.y)).a;
            float right = texture2D(sceneColor, screenUV + vec2(stepUV.x, 0.0)).a;
            float coverage = clamp(max(center.a - min(top, left), 0.29 * (center.a - min(bottom, right))), 0.0, 1.0);
            // Normal blending in the offscreen buffer premultiplies soft alpha edges.
            // Convert back to a linear straight color before adding the inner rim.
            vec3 base = center.rgb / max(center.a, 0.0001);
            float dark = 1.0 - smoothstep(0.055, 0.215, dot(base, vec3(0.2126, 0.7152, 0.0722)));
            float edge = coverage * dark * smoothstep(0.60, 0.97, center.a);
            gl_FragColor = vec4(mix(base, rimColor, 0.25 * edge * rimPower), center.a);
            #include <colorspace_fragment>
            #include <premultiplied_alpha_fragment>
          }
        `,
        depthTest: false,
        depthWrite: false,
        blending: T.NoBlending,
        premultipliedAlpha: true,
        toneMapped: false,
      });
      this.scene = new T.Scene();
      this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 2);
      this.camera.position.z = 1;
      this.settings = material.uniforms;
      mesh(this.scene, new T.PlaneGeometry(2, 2), material).frustumCulled = false;
    }
    resize(width, height, pixelRatio) {
      this.buffer.setSize(width, height);
      this.offset.set(1.16 * pixelRatio / width, 1.16 * pixelRatio / height);
    }
    render(scene, camera, form) {
      const renderer = this.renderer;
      this.settings.rimSize.value = form.rimWidth;
      this.settings.rimPower.value = form.rimPower;
      renderer.setRenderTarget(this.buffer);
      try {
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(null);
      }
      renderer.render(this.scene, this.camera);
    }
  }
  class View {
    constructor(canvas, { illustration = false, id = 'ink', appearance } = {}) {
      this.illustration = illustration;
      this.layout = illustration ? paperLayout : layout;
      this.renderer = new T.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power',
      });
      this.renderer.setClearColor(0, 0);
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.silhouette = new SilhouettePass(this.renderer);
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
        if (x === -2.32) this.mouseShadow = sh;
      }
      this.camera = new T.PerspectiveCamera(illustration ? 19 : 26, 1, 0.1, 80);
      this.inspection = 'desk';
      const keys = keyboard(this.scene, this.layout, illustration);
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
      if (illustration) {
        this.sleepMark = icon(this.scene, spriteTexture((g) => {
          g.fillStyle = '#465e52';
          g.font = 'italic 600 46px Georgia, serif';
          g.fillText('z', 12, 74);
          g.font = 'italic 600 51px Georgia, serif';
          g.fillText('Z', 38, 56);
          g.font = 'italic 600 63px Georgia, serif';
          g.fillText('Z', 68, 43);
        }, 128, 88), .82, .57);
        this.sleepMark.visible = false;
      }
      this.mouseRestColor = new T.Color('#f7f3e8');
      this.mousePressColor = new T.Color('#e6ad61');
      this.pick = new T.Raycaster();
      this.targets = [...new Set([...this.caps.values()].map((k) => k.batch))];
      this.capMatrix = new T.Matrix4();
      this.capTint = new T.Color();
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
      this.select(id, appearance);
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
      this.silhouette.resize(this.renderer.domElement.width, this.renderer.domElement.height, scale);
      this.frameCamera();
    }
    inspect(pose) {
      this.inspection = pose;
      this.frameCamera();
    }
    frameCamera() {
      const w = this.logicalWidth, h = this.logicalHeight;
      if (!w || !h || !this.cat) return;
      const c = this.cat, f = c.form;
      const a = w / h;
      const perspective = Math.tan(this.camera.fov * Math.PI / 360);
      const posture = (f.bodyHeight-1)*1.82+f.headLift;
      this.camera.aspect = a;
      const inDesk = this.inspection === 'desk';
      if (inDesk) {
        const clearance = Math.max(0, posture + 1.1*(f.headHeight-1) + .8*(f.earLength-1) + f.earLift);
        const dist = (Math.max(3.08, 3.96 / a) + .53*clearance) / perspective;
        const center = 1.62 + .23*clearance;
        this.camera.position.set(-.14,center+dist*.407,.70+dist*.913);
        this.camera.lookAt(-.14,center,.70);
        this.camera.setViewOffset(w,h,0,-.044*h,w,h);
      } else {
        const angles = { face: 0, angle: .58, profile: 1.36 };
        const azimuth = angles[this.inspection] ?? 0;
        const tall = (1.00 + .49*f.earLength)*f.headHeight + Math.max(0,f.earLift);
        const wide = 1.20*f.headWidth + .55*f.whiskerLength;
        const dist = Math.max(tall,wide/a) / perspective;
        const center = (c.long ? 3.32 : 3.12) + posture;
        this.camera.position.set(-.12+dist*Math.sin(azimuth),center+.105*dist,.41+dist*Math.cos(azimuth));
        this.camera.lookAt(-.12,center,.41);
        this.camera.clearViewOffset();
      }
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
    select(id, options) {
      if (id !== this.id) this.skin(id, options);
    }
    skin(id, options) {
      const next = makeCat(this.scene, id, options, this.illustration);
      if (this.cat) {
        this.scene.remove(this.cat.root);
        const geos = new Set(), mats = new Set();
        this.cat.root.traverse((o) => {
          if (o.geometry && o.geometry !== globe) geos.add(o.geometry);
          if (o.material) mats.add(o.material);
        });
        geos.forEach((g) => g.dispose());
        mats.forEach((m) => m.dispose());
      }
      this.cat = next;
      this.id = id;
      this.frameCamera();
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
        f = c.form,
        sideways = m.mouseLean,
        d = m.drive,
        r = Math.max(m.rage, 0.72 * m.pique),
        n = m.sleep,
        h = m.hello;
      const covered = m.privacy ? 1 : 0;
      const mouseSide = this.illustration ? m.mouseSide : 0;
      const mouseDir = mouseSide ? 1 : -1;
      const mouseCenter = mouseX(mouseSide, this.illustration);
      const rub = m.nuzzle;
      const time = m.t;
      const active = clamp((time - m.lastStrike) / 0.75),
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
        (0.68 + 0.46 * heat) * f.mouthWidth,
        Math.max(0.001, heat * (0.75 + 0.5 * m.landing)),
        1
      );
      // Shear from the hips. Rump and hind feet stay on the same patch of desk.
      c.body.morphTargetInfluences[0] = mouseSide ? 0 : sideways;
      if (this.illustration) c.body.morphTargetInfluences[1] = mouseSide ? sideways : 0;
      c.trunk.matrixAutoUpdate = false;
      c.trunk.matrix.set(
        (c.long ? 1 : .967)*f.bodyWidth + 0.012 * breath,
        leanX * 0.42,
        0,
        0,
        0,
        (c.long ? 1 : .895)*f.bodyHeight - dip * 0.19,
        0,
        0.03,
        0,
        leanZ * 0.43,
        f.bodyDepth,
        0,
        0,
        0,
        0,
        1
      );
      c.trunk.matrixWorldNeedsUpdate = true;
      c.contacts.chestFromDesk.copy(c.trunk.matrix).invert();
      const hx =
          -0.12 +
          mouseDir * (0.91 + 0.18 * m.grab) * sideways +
          leanX * 1.03 +
          0.13 * rub * Math.sin(t * 6),
        hz = 0.25 + leanZ * 1.11;
      c.head.position.set(
        hx,
        (c.long ? 2.85 : 2.62) +
          0.30 * (1 - sideways) +
          0.025 * breath -
          dip +
          0.1 * h +
          0.03 * r * Math.sin(t * 23) -
          0.14 * covered + (f.bodyHeight-1)*1.82 + f.headLift,
        hz
      );
      const wakeAge = Math.max(0, time - m.lastInput);
      const shake = this.illustration && wakeAge < .40
        ? Math.sin(wakeAge*39)*n*(1 - wakeAge/.40)*.19 : 0;
      c.head.rotation.set(
        0.13 +
          0.16 * d +
          0.14 * n -
          0.095 * h -
          0.105 * m.cursorLook * m.head[1] -
          0.235 * m.lookup +
          0.075 * m.landing,
        mouseDir * .34 * sideways + .14 * m.head[0] * (1 - sideways) + .18 * covered + shake,
        0.11 * rub * Math.sin(t * 6 - 0.2) -
          0.15 * slowLook * m.head[0] -
          0.068 * m.balance * typing -
          0.04 * m.head[0] +
          -mouseDir * 0.040 * sideways + 0.019 * (1 - sideways) * (1 - typing) * (1 - heat) +
          r * 0.025 * Math.sin(t * 24)
      );
      if (this.sleepMark) {
        this.sleepMark.visible = n > .42;
        this.sleepMark.material.opacity = clamp((n - .42) * 1.9);
        this.sleepMark.position.set(hx + .87*f.headWidth, c.head.position.y + 1.14 + .08*breath, hz);
      }
      c.contacts.chin.set(hx, c.head.position.y - .84*f.headHeight, .58*f.headWidth);
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
          (1 - Math.max(0.89 * h, 0.96 * rub)) *
          (1 - 0.95 * n) *
          (1 - 0.96 * covered) * f.eyeOpen;
        eye.lid.x = Math.max(
          0.04,
          Math.min(blink, 1 - 0.94 * m.reliefBlink) * openness
        );
        eye.lid.y = s * (0.052 + 0.08 * d + 0.43 * heat + Math.tan(f.eyeTilt*Math.PI/180));
        eye.pupil.set(
          m.gaze[0] * (0.43 + 0.12 * sideways + 0.07 * slowLook) - s * 0.035,
          -0.025 - 0.04 * typing + 0.18 * m.gaze[1],
          (0.54 + 0.18 * m.hunt + 0.055 * slowLook + 0.075 * m.lookup - 0.065 * sideways) *
            (1 - 0.22 * d) *
            (1 - 0.26 * heat) * f.pupilWidth,
          (0.92 + 0.045 * m.hunt) * f.pupilHeight
        );
        const e = c.ears[i];
        e.rotation.z =
          -s *
            (0.125 +
              0.62 * heat +
              0.08 * d +
              0.19 * m.earBounce -
              0.11 * m.lookup + f.earAngle*Math.PI/180) +
          0.019 * Math.sin(t * 2.7 + i);
        e.rotation.x = -0.22 * heat + 0.06 * m.earBounce;
        const focus = clamp(d + 0.48 * sideways);
        c.whiskers[i].rotation.y = s * (0.060 * focus - 0.13 * heat - 0.18 * covered);
        c.whiskers[i].rotation.z = s * (0.022 * breath - 0.063 * n);
        const paw = m.paws[i], pp = paw.pos;
        const reach = i === mouseSide && !covered ? sideways : 0;
        // Follow the side of the moving rib cage. Reaching protracts the
        // shoulder blade; the other shoulder carries more of the seated weight.
        const spread = clamp((pp.x + 0.12) * s * 0.45);
        const shoulderY = (c.long ? 1.78 : 1.65)*f.bodyHeight - 0.38 * dip - 0.15 * reach +
          0.045 * sideways * (1 - reach);
        const rib = ribSlice(c.body, c.ribs, shoulderY);
        const shoulderX = rib.x + s * rib.width * (0.53 + 0.12 * spread + 0.09 * reach) * f.shoulders;
        const shoulder = V(shoulderX, shoulderY, ribFront(rib, shoulderX) - 0.18 + 0.09 * reach);
        const palm = covered
          ? c.head.localToWorld(V(s*c.eyeSize.z, c.eyeSize.w, c.faceDepth(c.eyeSize.z,c.eyeSize.w)+.19))
          : V(pp.x, pp.y, pp.z);
        const contact = m.keyContact(paw, time);
        const mouseContact = reach * (1-T.MathUtils.smoothstep(
          Math.hypot(pp.x - mouseCenter - m.mouseOffset[0], pp.z - 1.82 - m.mouseOffset[1]),.20,.46));
        palm.z -= .08 * mouseContact;
        palm.y += .018*(1 - T.MathUtils.smoothstep(pp.y,.125,.22))*(1-covered) +
          mouseContact*(.141 + .073*Math.max(...m.press));
        // The sole rides the top face through both the press and the rebound.
        const pressure = contact ? contact.depth * contact.weight : 0;
        if (contact) {
          const top = capBase(contact.depth) + keyCap.height;
          palm.y += (top + padHeight * (1 - padCompression * pressure) + .008 - keyPalmHeight) * contact.weight;
        }
        c.arms[i].place(shoulder, palm, s, reach, covered,
          Math.max(pressure, mouseContact*.72), c.body, c.ribs);
        const [, upper, elbow] = c.arms[i].curve.points;
        const clearance = elbow.z-frontOfRibs(c.body, c.ribs, elbow);
        c.contacts.arms[i].set(
          mix(upper.x, elbow.x, .65) - s*.13, mix(upper.y, elbow.y, .58), 0,
          .48*(1-T.MathUtils.smoothstep(clearance,.10,.59))*(1-.68*covered));
        c.hind[i].position.set(
          0.11 + s * (c.long ? 0.67 : .633)*f.bodyWidth - mouseDir * 0.045 * sideways,
          0.099,
          0.24 + (i ? -0.025 : 0.02) * sideways
        );
      }
      const [mx, mz] = m.mouseOffset;
      this.mouse.position.set(mouseCenter + mx, 0.14, 1.82 + mz);
      this.mouseShadow.position.set(mouseCenter + mx, -.043, 1.82 + mz);
      if (
        Math.abs(mx - this.cablePos[0]) + Math.abs(mz - this.cablePos[1]) >
          0.001 ||
        !Number.isFinite(this.cablePos[0]) || this.cableSide !== mouseSide
      ) {
        this.cordPath[0].set(mouseCenter + mx, 0.095, 2.19 + mz);
        this.cordPath[1].set(mouseCenter + mouseDir*.08 + mx*.8, 0.027, 2.41 + mz*.73);
        this.cordPath[2].set(mouseCenter + mouseDir*.20 + mx*.32, 0.018, 2.6 + mz*.33);
        this.cordPath[3].x = mouseCenter + mouseDir*.45;
        this.cordPath[4].x = mouseCenter + mouseDir*.75;
        this.cable.pose(this.cordPath);
        this.cablePos[0] = mx;
        this.cablePos[1] = mz;
        this.cableSide = mouseSide;
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
      const direction = time < m.scrollUntil ? m.scrollSign : 0;
      this.inputBadge.visible = Boolean(badgeMask || direction);
      if (this.inputBadge.visible) {
        const pattern = badgeMask + ',' + direction;
        if (!this.badgeMaps.has(pattern))
          this.badgeMaps.set(pattern, pointerStamp(badgeMask, direction));
        this.inputBadge.material.map = this.badgeMaps.get(pattern);
        this.inputBadge.position.set(mouseCenter + mouseDir*.41 + mx, 0.63, 1.8 + mz);
      }
      const slam = m.tailBeat,
        wave = Math.sin(t * 2.6),
        whip = Math.sin(t * 8.4),
        up = 0.1 * wave + 0.14 * d * whip;
      const tailBaseX = 0.68*f.bodyWidth + 0.26 * sideways;
      const tx = tailBaseX + (1.34 + .08*sideways + .33*slam)*f.tailLength;
      const tip = V(
        tx,
        Math.max(.16, 0.99 +
          0.09 * wave * (1 - slam) +
          up * (1 - slam) -
          0.79 * slam -
          0.61 * n + f.tailLift*(1-slam) + .22*(f.tailCurl-1)*(1-slam)),
        -0.32 + 1.86 * slam + .41*(f.tailCurl-1)*(1-slam)
      );
      c.tail.pose(
        [
          V(tailBaseX, 0.43, -0.55),
          V(tailBaseX + 0.38*f.tailLength, 0.4, -0.65),
          V(tx - 0.54*f.tailLength, 0.59 + 0.15 * up - 0.24 * slam, -0.57 + 0.22 * slam),
          V(tx - 0.26*f.tailLength,
            Math.max(.065,1.06 + up - 1.01 * slam - 0.69 * n + .74*f.tailLift*(1-slam)),
            -0.42 + 1.22 * slam + .30*(f.tailCurl-1)*(1-slam)),
          tip,
        ],
        (c.long ? 1.1 : 1)*f.tailWidth
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
        const depth = m.keyDepth(code, time);
        if (depth === cap.depth) continue;
        cap.depth = depth;
        this.capMatrix.makeTranslation(
          cap.key.x,
          capBase(depth),
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
      this.updateLabels(m, time);
      if (f.rimPower === 0) this.renderer.render(this.scene, this.camera);
      else this.silhouette.render(this.scene, this.camera, f);
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
        const k = this.layout.get(hit.code),
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
