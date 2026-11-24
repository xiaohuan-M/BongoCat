/* Original silhouette study. Coordinates are desk units; +Z points towards the viewer. */
(function () {
  'use strict';
  const T = THREE;
  const { layout, clamp, mix } = PawMotion;
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const globe = new T.SphereGeometry(1, 42, 28);
  const palettes = {
    ink: {
      fur: '#242329',
      shade: '#131216',
      light: '#26242b',
      stripe: '#29272e',
      eye: '#d8a959',
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
  function cheekFur(head, tint, long) {
    const points = [], colors = [], indices = [];
    let seed = 73;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (const side of [-1, 1]) {
      for (let i = 0; i < 560; i++) {
        const y = -.64 + 1.16*random();
        const angle = -.97 + 1.75*random();
        const [rx,rz,cz] = headSection(y,long);
        const x = side*rx*Math.cos(angle);
        const z = cz+rz*Math.sin(angle);
        const root = V(x*.996,y,z);
        const normal = V(side*Math.cos(angle),y*.95,Math.sin(angle)*1.32).normalize();
        const direction = V(side*.50,-.88,-.20);
        direction.addScaledVector(normal,-direction.dot(normal)).normalize();
        const width = V(0,0,0).crossVectors(normal,direction).normalize();
        const atCheek = 1-T.MathUtils.smoothstep(y,-.15,.49);
        const length = (.035+.047*random())*(.55+.65*atCheek)*(long?1.58:1);
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
  function headSection(y, long) {
    const v = clamp((y - 0.015) / 0.805, -1, 1);
    const circle = Math.sqrt(Math.max(0, 1 - v * v));
    const lower = Math.exp(-(((v + 0.30) / 0.54) ** 2));
    const temple = 0.074 * Math.exp(-(((v - 0.56) / 0.35) ** 2));
    const cheek = 1.0 - 0.075 * v + (long ? 0.087 : 0.043) * lower + temple;
    return [
      circle * cheek * (1.0 + 0.027*lower),
      circle * (0.753 - 0.040 * v),
      -0.060 + 0.055 * (1 - v)
    ];
  }
  function muzzleRelief(x, y) {
    const padX = (Math.abs(x) - 0.17) / 0.225;
    const padY = (y + 0.255) / 0.178;
    const bridge = Math.exp(-((x / 0.13) ** 2) - ((y + 0.055) / 0.28) ** 2);
    return 0.166 * Math.exp(-padX * padX - padY * padY) + 0.064 * bridge;
  }
  function faceDepth(x, y, long) {
    const [rx, rz, z] = headSection(y, long);
    const front = Math.sqrt(Math.max(0, 1 - (x / Math.max(0.001, rx)) ** 2));
    return z + rz * front + muzzleRelief(x, y) * front * front;
  }
  function kittenHead(head, mat, long) {
    const geo = new T.SphereGeometry(1, 72, 48);
    const pos = geo.attributes.position;
    const normal = geo.attributes.normal;
    const surface = (u, v) => {
      const y = 0.015 + 0.805 * Math.sin(v);
      const [rx, rz, z] = headSection(y, long);
      const x = rx * Math.cos(u), front = Math.sin(u);
      return V(x, y, z + rz * front + muzzleRelief(x, y) * Math.max(0, front) ** 2);
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
  // Cross sections come from the same two meshes that animate the seated torso.
  // The elbow can fold behind the wrist, but must stay on the visible side of the ribs.
  function ribSections(body, bent, sides) {
    const straight = body.geometry.attributes.position;
    const leaning = bent.geometry.attributes.position;
    const rings = [];
    for (let i = 0; i + sides <= straight.count; i += sides) {
      const section = (p) => {
        const right = p.getX(i), left = p.getX(i + sides/2);
        const front = p.getZ(i + sides/4), back = p.getZ(i + sides*3/4);
        return [(right+left)/2, (front+back)/2, (right-left)/2, (front-back)/2];
      };
      rings.push({ y: straight.getY(i), rest: section(straight), bent: section(leaning) });
    }
    return rings;
  }
  function ribSlice(body, rings, height) {
    const m = body.parent.matrix.elements;
    const y = (height - m[13]) / m[5];
    const bend = body.morphTargetInfluences[0];
    let index = 1;
    while (index + 1 < rings.length && rings[index].y < y) index++;
    const lo = rings[index - 1], hi = rings[index];
    const t = clamp((y - lo.y) / (hi.y - lo.y));
    const at = (i) => mix(mix(lo.rest[i], lo.bent[i], bend), mix(hi.rest[i], hi.bent[i], bend), t);
    return { x: m[0] * at(0) + m[4] * y, z: at(1) + m[6] * y,
      width: m[0] * at(2), depth: at(3) };
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
  // Shoulder, elbow, carpus and toes form one surface. The last fifth of the
  // curve runs along the paw instead of down the leg, so the foot can plant flat.
  class Foreleg extends Sweep {
    constructor(parent, mat) {
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
          radii.set(.208 * dome, .133 * dome);
        }
        this.crossSection.push(radii);
        for (const [x, y] of this.circle) coatCoords.push(t, x, y);
      }
      this.mesh.geometry.setAttribute('pawPoint', new T.Float32BufferAttribute(coatCoords, 3));
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
      elbow.x += side * (0.075 + 0.19 * lift) + 0.23 * reach;
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
        const height = shape.y * (1 - .085 * pressure);
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
  // Keep one broad shadow mass across the coat. A grazing light only catches
  // the upturned outline; a front-facing patch should retain the local fur colour.
  function coatLight(shader) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `vec3 coatNormal = normalize(normal);
       float sky = smoothstep(-0.35, 0.86, dot(coatNormal, normalize(vec3(-0.43, 0.84, 0.34))));
       float grazing = 1.0 - smoothstep(0.03, 0.38, abs(dot(coatNormal, normalize(vViewPosition))));
       outgoingLight = diffuseColor.rgb * mix(0.66, 1.40, sky)
         + vec3(0.0058, 0.0063, 0.0077) * sky
         + vec3(0.021, 0.019, 0.021) * grazing * sky;
       #include <opaque_fragment>`
    );
  }
  function innerEar(fur, tint, dark) {
    const mat = fur.clone();
    mat.onBeforeCompile = (shader) => {
      coatLight(shader);
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
         float inside = (1.0-smoothstep(0.69,1.06,length(shape)))*smoothstep(0.015,0.075,earPoint.z);
         float bowl = 0.54 + 0.37 * smoothstep(-0.43,0.85,shape.y) + 0.13 * smoothstep(0.50,0.93,length(shape));
         float fold = exp(-9.0*dot(shape-vec2(0.0,-0.26),shape-vec2(0.0,-0.26)));
         diffuseColor.rgb = mix(diffuseColor.rgb,earTint*bowl*(1.0-.54*fold),inside*.79);
         float fringe = 0.5+0.5*sin(28.0*shape.x+4.0*sin(3.0*shape.y)+5.0*shape.y);
         float lowerEdge = (1.0-smoothstep(.30,.82,abs(shape.y+.39)))*smoothstep(.32,.82,abs(shape.x));
         diffuseColor.rgb += vec3(.055,.042,.033)*inside*lowerEdge*pow(fringe,5.0);`
      );
    };
    mat.customProgramCacheKey = () => 'ear:' + dark;
    return mat;
  }
  function forelegCoat(fur, shoulderTint, toeTint, side, dark) {
    const mat = fur.clone();
    mat.onBeforeCompile = (shader) => {
      coatLight(shader);
      shader.uniforms.shoulderTint = { value: shoulderTint };
      shader.uniforms.toeTint = { value: toeTint };
      shader.uniforms.sideSign = { value: side };
      shader.vertexShader = 'attribute vec3 pawPoint; varying vec3 coatPoint;\n' +
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\ncoatPoint=pawPoint;');
      shader.fragmentShader =
        'varying vec3 coatPoint; uniform vec3 shoulderTint, toeTint; uniform float sideSign;\n' +
        shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float u = coatPoint.x, across = coatPoint.y, up = coatPoint.z;
          diffuseColor.rgb = mix(shoulderTint,diffuseColor.rgb,smoothstep(.07,.38,u));
          float sock = smoothstep(.83,.95,u-.028*up-.013*across);
          diffuseColor.rgb = mix(diffuseColor.rgb,toeTint,sock*.65);
          float crease = (1.-smoothstep(.024,.11,abs(abs(across)-.34))) *
             smoothstep(.82,.90,u) * (1.-smoothstep(.94,.985,u)) * smoothstep(.32,.81,up);
          diffuseColor.rgb *= 1.-.23*crease;
          float bean = length(vec2((u-.794)/.071,across/.49));
          float digit = length(vec2((u-.906)/.035,(abs(across)-.52)/.21));
          float middle = length(vec2((u-.927)/.034,across/.20));
          float pad = (1.-smoothstep(.79,1.05,min(bean,min(digit,middle))))*(1.-smoothstep(-.80,-.53,up));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.45,.225,.216), .85*pad);`);
      if (dark) shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float facing = abs(dot(normalize(normal),normalize(vViewPosition)));
          float inside = smoothstep(-.5,.75,-normal.x*sideSign);
          float glint = (1.-smoothstep(.05,.44,facing))*(.032+.150*inside);
          float along = smoothstep(.18,.41,coatPoint.x)*(1.-smoothstep(.84,1.,coatPoint.x));
          float darkFur = 1.-smoothstep(.07,.25,dot(diffuseColor.rgb,vec3(.213,.715,.072)));
          outgoingLight += vec3(.54,.45,.40)*glint*along*darkFur;
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'foreleg:' + dark;
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
    mats.fur.onBeforeCompile = coatLight;
    mats.shade.onBeforeCompile = coatLight;
    const earCoat = innerEar(mats.fur, long ? '#ad7c68' : '#58434a', !long);
    mats.whisk = color(long ? '#dbc0a5' : '#b2a69e');
    const noseTint = new T.MeshLambertMaterial({color: long ? '#925e53' : '#60494c'});
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
    const ribs = ribSections(body, sideShape, 48);
    trunk.remove(sideShape);
    sideShape.geometry.dispose();
    if (!long) {
      body.material = mats.fur.clone();
      body.material.onBeforeCompile = (shader) => {
        coatLight(shader);
        shader.vertexShader = 'varying vec3 chestPoint;\n' + shader.vertexShader.replace(
          '#include <begin_vertex>','#include <begin_vertex>\nchestPoint=position;'
        );
        shader.fragmentShader = 'varying vec3 chestPoint;\n' + shader.fragmentShader.replace(
          '#include <color_fragment>',`#include <color_fragment>
           float x = chestPoint.x+.045;
           float y = (chestPoint.y-1.85)/.67;
           float breast = exp(-x*x*2.9-y*y)*smoothstep(.25,.76,chestPoint.z);
           float fur = 19.0*atan(x,chestPoint.y+0.2) + 8.0*x + 2.0*sin(6.0*x+2.0*chestPoint.y);
           diffuseColor.rgb += vec3(.013,.012,.014)*breast*(1.0+.14*sin(fur));`
        );
      };
      body.material.customProgramCacheKey = () => 'ink-chest';
    }
    if (long) {
      // Use the resting body coordinates so the three tufts of the bib follow the same morph as the shoulders.
      body.material = mats.fur.clone();
      body.material.onBeforeCompile = (shader) => {
        coatLight(shader);
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
    // Each eye lives on the curved face. The gaze stays in head coordinates
    // when the kitten turns, and blinking closes the upper lid over the iris.
    const eyes = [-1, 1].map(() => ({
      pupil: new T.Vector4(0, 0, 0.47, 0.89),
      lid: new T.Vector2(1, 0),
    }));
    faceCoat.onBeforeCompile = (shader) => {
      coatLight(shader);
      shader.uniforms.tabbyStripe = { value: mats.stripe.color };
      shader.uniforms.muzzleTint = { value: long ? mats.light.color : mats.fur.color.clone().lerp(new T.Color('#695b58'), 0.28) };
      shader.uniforms.cheekTint = { value: new T.Color(long ? '#cc8a76' : '#493d42') };
      shader.vertexShader = 'varying vec3 facePoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nfacePoint=position;'
      );
      shader.fragmentShader = 'varying vec3 facePoint; uniform vec3 cheekTint; uniform vec3 muzzleTint, tabbyStripe;\n' + shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // Fine directional variations follow the cheeks rather than screen-space pixels.
         vec2 nap = vec2(abs(facePoint.x),facePoint.y);
         float along = nap.x * 0.48 + nap.y + 0.30*nap.x*nap.x;
         float phase = 168.0*along + 2.1*sin(nap.x*21.0+along*11.0) + sin(nap.x*41.0);
         float grain = sin(phase)*(1.0-smoothstep(.55,2.6,fwidth(phase)));
         float sidePlane = smoothstep(.25,.74,nap.x) * smoothstep(-.79,-.57,nap.y);
         diffuseColor.rgb *= 1.0 + .12*grain*sidePlane;
         vec2 cheek = (vec2(abs(facePoint.x),facePoint.y)-vec2(.69,-.22))/vec2(.29,.14);
         float warmth = (1.0-smoothstep(0.05,1.0,dot(cheek,cheek)))*smoothstep(.32,.68,facePoint.z);
         diffuseColor.rgb=mix(diffuseColor.rgb,cheekTint,0.24*warmth);
         vec2 pad = (vec2(abs(facePoint.x),facePoint.y) - vec2(.158,-.255)) / vec2(.217,.142);
         float mask = (1.-smoothstep(.51,1.21,length(pad))) * smoothstep(.63,.80,facePoint.z);
         diffuseColor.rgb=mix(diffuseColor.rgb,muzzleTint,mask*.92);
         vec2 browPoint = (vec2(abs(facePoint.x),facePoint.y)-vec2(.442,.367))/vec2(.226,.075);
         vec2 chinPoint = (facePoint.xy-vec2(0.0,-.46))/vec2(.26,.112);
         float browPlane = exp(-dot(browPoint,browPoint))*smoothstep(.40,.62,facePoint.z);
         vec2 bridgePoint = (facePoint.xy-vec2(0.0,-.028))/vec2(.096,.220);
         float bridge = exp(-dot(bridgePoint,bridgePoint))*smoothstep(.66,.78,facePoint.z);
         diffuseColor.rgb += vec3(.013,.011,.010)*bridge;
         float chin = exp(-dot(chinPoint,chinPoint))*smoothstep(.48,.68,facePoint.z);
         diffuseColor.rgb = mix(diffuseColor.rgb,muzzleTint,.42*browPlane+.51*chin);
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
      shader.uniforms.eyeTint = { value: mats.eye.color };
      shader.uniforms.leftPupil = { value: eyes[0].pupil };
      shader.uniforms.rightPupil = { value: eyes[1].pupil };
      shader.uniforms.leftLid = { value: eyes[0].lid };
      shader.uniforms.rightLid = { value: eyes[1].lid };
      shader.fragmentShader = 'uniform vec3 eyeTint; uniform vec4 leftPupil, rightPupil; uniform vec2 leftLid, rightLid;\n' +
        shader.fragmentShader.replace('#include <opaque_fragment>', `
          vec4 pupil = facePoint.x < 0.0 ? leftPupil : rightPupil;
          vec2 lid = facePoint.x < 0.0 ? leftLid : rightLid;
          vec2 eye = (facePoint.xy - vec2(sign(facePoint.x)*0.392, 0.116)) / vec2(0.281, 0.229);
          eye.y -= eye.x * lid.y;
          float boundary = length(eye * vec2(1.0, 1.0+0.10*eye.x*eye.x)) - 1.0;
          float lower = -0.96 + 0.57 * min(eye.x*eye.x, 1.0);
          float upper = mix(lower, 1.22, smoothstep(0.04, 1.03, lid.x));
          float eyeEdge = max(boundary, eye.y - upper);
          float aa = clamp(fwidth(eyeEdge), 0.012, 0.16);
          float eyeMask = (1.0-smoothstep(-aa, aa, eyeEdge)) * smoothstep(0.36,0.58,facePoint.z)
            * smoothstep(0.055,0.20,lid.x);
          vec2 q = eye - pupil.xy;
          float pupilEdge = length(q / pupil.zw) - 1.0;
          float pupilAA = clamp(fwidth(pupilEdge), 0.02, 0.21);
          float rimDist = abs(boundary-.018);
          float socketRim = (1.0-smoothstep(.016,.069+aa,rimDist))*smoothstep(-.02,.64,-eye.y);
          outgoingLight += vec3(.024,.018,.017)*socketRim*smoothstep(.35,.62,facePoint.z)*smoothstep(.30,.88,lid.x);
          float irisRadius = length(q);
          float angle = atan(q.y,q.x);
          float fibers = sin(31.0*angle+3.0*irisRadius) * cos(9.0*angle-4.0*irisRadius);
          float detail = 1.0-smoothstep(.63,2.65,31.0*length(fwidth(q))/max(.3,irisRadius));
          float eyelidShadow = smoothstep(-.48,.89,eye.y);
          vec3 iris = eyeTint * (1.18 - .64*eyelidShadow + .085*fibers*detail);
          iris = mix(iris*.41,iris,1.0-smoothstep(.83,1.02,length(eye)));
          iris = mix(iris,iris*vec3(1.07,.76,.57),.55*(1.0-smoothstep(.50,.83,irisRadius)));
          vec3 eyePaint = mix(mix(vec3(.006,.005,.007),vec3(.022,.021,.022),.68*(1.0-smoothstep(-.78,.47,eye.y))), iris, smoothstep(-pupilAA,pupilAA,pupilEdge));
          // A single small window reflection, shared by both eyes.
          float reflection = length((q-vec2(-0.19,0.43))*vec2(1.0,0.89)) - 0.112;
          float lightAA = clamp(fwidth(reflection), 0.012, 0.10);
          eyePaint = mix(eyePaint,vec3(0.98,0.94,0.80),1.0-smoothstep(-lightAA,lightAA,reflection));
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
    kittenHead(head, faceCoat, long);
    cheekFur(head, mats.fur.color, long);
    head.scale.set(long ? 1.14 : 1.115, long ? 1.22 : 1.25, 1.16);
    const ears = [],
      whiskers = [],
      arms = [],
      hind = [];
    for (const side of [-1, 1]) {
      const ear = group(head);
      ear.position.set(side * (long ? 0.505 : 0.462), 0.315, -0.080);
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
      ear.scale.set(long ? 1.01 : 1.03, long ? 1.08 : 1.13, 0.97);
      ears.push(ear);
      // Each strand starts on its own whisker pad, clears the cheek, then fans out.
      const fan = group(head);
      const hinge = V(side * 0.244, -0.242, faceDepth(0.244, -0.242, long));
      fan.position.copy(hinge);
      whiskers.push(fan);
      for (const [rootX, rootY, tipX, tipY, tipZ] of [
        [0.20, -0.219, 1.20, -0.115, 0.65],
        [0.27, -0.253, 1.29, -0.245, 0.62],
        [0.23, -0.296, 1.14, -0.415, 0.65]
      ]) {
        const points = [
          V(side * rootX, rootY, faceDepth(rootX, rootY, long) + 0.006),
          V(side * 0.47, rootY + 0.044, faceDepth(rootX, rootY, long) + 0.045),
          V(side * 0.87, mix(rootY, tipY, 0.58) + 0.055, 0.80),
          V(side * (tipX + (long ? 0.075 : 0)), tipY, tipZ)
        ];
        whisker(fan, mats.whisk, points.map((point) => point.sub(hinge).toArray()));
      }
      const browRoot = V(side*.65,.30,faceDepth(.65,.30,long));
      whisker(head,mats.whisk,[
        browRoot.toArray(),[side*.72,.39,browRoot.z+.015],
        [side*.86,.50,browRoot.z-.044],[side*.93,.57,browRoot.z-.13]
      ], .0046);
      const sleeve = forelegCoat(mats.fur,
        long ? mats.light.color : mats.fur.color,
        long ? mats.light.color : new T.Color('#cebbba'), side, !long);
      arms.push(new Foreleg(root, sleeve));
      const heel = group(root);
      // The top of the folded hind leg disappears into the flank. The broad
      // base narrows into the desk, leaving a single rounded outside contour.
      skinSurface(heel, mats.fur, [
        [-.092,.09,.12,0,.16], [-.057,.19,.23,0,.145],
        [.075,.24,.285,.018*side,.105], [.28,.263,.31,.055*side,-.02],
        [.52,.30,.36,.065*side,-.18], [.73,.24,.30,-.045*side,-.30],
        [.88,.09,.14,-.12*side,-.30]
      ], 40);
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
      tail.mesh.material = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
      tail.mesh.material.onBeforeCompile = coatLight;
    }
    const smile = group(head);
    const smileInk = color(long ? '#8a5d4b' : '#211b22');
    for (const side of [-1, 1]) {
      const lip = [[0, -0.273], [0.077, -0.307], [0.15, -0.284]];
      stroke(smile, smileInk, lip.map(([x, y]) => [side*x, y, faceDepth(x, y, long) + 0.009]), 0.011);
    }
    const mouth = group(head);
    mouth.position.set(0, -0.34, faceDepth(0, -0.34, long) + 0.050);
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
    nose.scale.set(0.88, 0.82, 0.74);
    nose.position.set(0, -0.185, faceDepth(0, -0.185, long) + 0.021);
    const nostril = color(long ? '#663f39' : '#352b32');
    for (const side of [-1,1]) {
      const slit = egg(nose,nostril,side*.053,.005,.035,.018,.006,.008);
      slit.rotation.z = side*.32;
    }
    stroke(smile, smileInk, [[0, -0.234, nose.position.z + 0.013],
      [0, -0.257, faceDepth(0, -0.257, long) + 0.014],
      [0, -0.273, faceDepth(0, -0.273, long) + 0.010]], 0.011);
    return {
      root,
      trunk,
      body,
      ribs,
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
      mats,
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
      // Leave room for the upright ears, while keeping the keyboard in frame.
      this.camera.setViewOffset(w, h, 0, -.044*h, w, h);
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
        2.85 +
          0.30 * (1 - sideways) +
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
          0.040 * sideways + 0.019 * (1 - sideways) * (1 - typing) * (1 - heat) +
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
        eye.lid.x = Math.max(
          0.04,
          Math.min(blink, 1 - 0.94 * m.reliefBlink) * openness
        );
        eye.lid.y = s * (0.052 + 0.08 * d + 0.43 * heat);
        eye.pupil.set(
          m.gaze[0] * (0.43 + 0.12 * sideways + 0.07 * slowLook) - s * 0.035,
          -0.025 - 0.04 * typing + 0.18 * m.gaze[1],
          (0.54 + 0.18 * m.hunt + 0.055 * slowLook + 0.075 * m.lookup - 0.065 * sideways) *
            (1 - 0.22 * d) *
            (1 - 0.26 * heat),
          0.92 + 0.045 * m.hunt
        );
        const e = c.ears[i];
        e.rotation.z =
          -s *
            (0.125 +
              0.62 * heat +
              0.08 * d +
              0.19 * m.earBounce -
              0.11 * m.lookup) +
          0.019 * Math.sin(t * 2.7 + i);
        e.rotation.x = -0.22 * heat + 0.06 * m.earBounce;
        const focus = clamp(d + 0.48 * sideways);
        c.whiskers[i].rotation.y = s * (0.060 * focus - 0.13 * heat - 0.18 * covered);
        c.whiskers[i].rotation.z = s * (0.022 * breath - 0.063 * n);
        const paw = m.paws[i], pp = paw.pos;
        const reach = i === 0 && !covered ? sideways : 0;
        // Follow the side of the moving rib cage. Reaching protracts the
        // shoulder blade; the other shoulder carries more of the seated weight.
        const spread = clamp((pp.x + 0.12) * s * 0.45);
        const shoulderY = 1.78 - 0.38 * dip - 0.15 * reach + 0.045 * sideways * (1 - reach);
        const rib = ribSlice(c.body, c.ribs, shoulderY);
        const shoulderX = rib.x + s * rib.width * (0.53 + 0.12 * spread + 0.09 * reach);
        const shoulder = V(shoulderX, shoulderY, ribFront(rib, shoulderX) - 0.18 + 0.09 * reach);
        const palm = covered
          ? c.head.localToWorld(V(s * 0.425, 0.130, 0.92))
          : V(pp.x, pp.y, pp.z);
        const key = layout.get(paw.code);
        // Only the active paw follows its cap. A previous keystroke cannot pull
        // a tucked paw down when the mouse or privacy gesture takes over.
        const keyContact = !covered && key && Math.abs(pp.x-key.x)<.15 &&
          Math.abs(pp.z-key.z)<.13 ? m.keyDepth(key.code,t) : 0;
        const mouseContact = reach * (1-T.MathUtils.smoothstep(
          Math.hypot(pp.x + 2.32 - m.mouseOffset[0], pp.z - 1.82 - m.mouseOffset[1]),.20,.46));
        palm.z -= .08 * mouseContact;
        palm.y += .018*(1 - T.MathUtils.smoothstep(pp.y,.125,.22))*(1-covered) +
          mouseContact*(.141 + .073*Math.max(...m.press)) +
          keyContact*(.073 - .046*keyContact);
        c.arms[i].place(shoulder, palm, s, reach, covered, Math.max(keyContact, mouseContact*.72), c.body, c.ribs);
        c.hind[i].position.set(
          0.11 + s * 0.67 + 0.045 * sideways,
          0.099,
          0.24 + (i ? -0.025 : 0.02) * sideways
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
          V(tx - 0.54, 0.59 + 0.15 * up - 0.24 * slam, -0.57 + 0.22 * slam),
          V(tx - 0.26, 1.06 + up - 1.01 * slam - 0.69 * n, -0.42 + 1.22 * slam),
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
