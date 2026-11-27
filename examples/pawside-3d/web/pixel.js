/* A pixel scene drawn on one integer grid. All character and desk clusters share its pixel size. */
(function () {
  'use strict';
  const { mix } = PawArt;
  const { clamp, ease, layout } = PawMotion;
  const WIDTH = 176, HEIGHT = 144;
  const ink = '#30263d', shadeInk = '#59415d';
  const pale = '#fff2dd', deskInk = '#362944';
  const keyText = '#6d4760';
  const neutral = { open: 1, gaze: 0, gazeY: 0, tilt: 0, anger: 0 };
  const round = Math.round;
  const colorsFor = new WeakMap();

  function box(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(round(x), round(y), Math.max(1, round(w)), Math.max(1, round(h)));
  }

  function polygon(g, points, color) {
    const ys = points.map(p => p[1]);
    const top = Math.floor(Math.min(...ys)), bottom = Math.ceil(Math.max(...ys));
    g.fillStyle = color;
    for (let y=top; y<bottom; y++) {
      const crossings = [], row = y + .5;
      for (let a=0, b=points.length-1; a<points.length; b=a++) {
        const [x1, y1] = points[a], [x2, y2] = points[b];
        if ((y1 <= row && row < y2) || (y2 <= row && row < y1))
          crossings.push(x1 + (row-y1) * (x2-x1) / (y2-y1));
      }
      crossings.sort((a,b) => a-b);
      for (let i=0; i<crossings.length; i+=2) {
        const left = Math.ceil(crossings[i] - .5), right = Math.ceil(crossings[i+1] - .5);
        if (right > left) g.fillRect(left, y, right-left, 1);
      }
    }
  }

  function ellipse(g, x, y, rx, ry, color) {
    const rows = Math.max(1, round(ry));
    g.fillStyle = color;
    for (let j=-rows; j<rows; j++) {
      const offset = (j+.5) / rows;
      const span = Math.max(1, round(rx * Math.sqrt(1 - offset*offset)));
      g.fillRect(round(x)-span, round(y)+j, span*2, 1);
    }
  }

  function line(g, x0, y0, x1, y1, color) {
    const length = Math.max(1, Math.ceil(Math.max(Math.abs(x1-x0), Math.abs(y1-y0))));
    g.fillStyle = color;
    for (let i=0; i<=length; i++) {
      const t = i/length;
      g.fillRect(round(x0+(x1-x0)*t), round(y0+(y1-y0)*t), 1, 1);
    }
  }

  function points(g, pairs, color) {
    g.fillStyle = color;
    for (const [x, y] of pairs) g.fillRect(round(x), round(y), 1, 1);
  }

  function colors(look) {
    let result = colorsFor.get(look);
    if (result) return result;
    const c = look.coat, f = look.form;
    const lightness = (parseInt(c.fur.slice(1,3),16) * .2126 + parseInt(c.fur.slice(3,5),16) * .7152 +
      parseInt(c.fur.slice(5,7),16) * .0722) / 255;
    const fur = lightness < .27 ? mix(c.fur, '#695884', .43) : mix(c.fur, '#9f90ca', .22);
    const softShadow = mix(fur, mix(c.shade, '#644c79', .52), .62);
    const light = mix(fur, '#ffe8df', .38);
    const chest = mix(c.light, pale, .30);
    result = {
      fur, shadow: softShadow, light, chest, chestShadow: mix(chest, '#a988a1', .23),
      contour: mix(ink, c.shade, .24), ear: mix(c.ear, '#eaa6a7', .39),
      earBright: mix(c.ear, '#ffcdc0', .58), nose: mix(c.nose, '#e28ea3', .56),
      pattern: mix(fur, mix(c.stripe, '#644879', .22), Math.min(.88, f.patternAmount * .80)),
      muzzle: mix(fur, mix(c.muzzle, pale, .32), clamp(.4 + f.muzzleMark * .47)),
    };
    colorsFor.set(look, result);
    return result;
  }

  function ear(g, side, look, long, mood) {
    const f = look.form, c = colors(look);
    const x = round(12 + f.earSpace * 17);
    const foot = -8 - round(f.earLift * 12);
    const top = foot - round((long ? 23 : 18)*f.earLength) + round(mood.anger * 9 + mood.tilt * side);
    const tip = x + round(3 + f.earAngle*.18 + mood.anger*5);
    const width = round(6 * f.earWidth);
    g.save();
    g.scale(side, 1);
    polygon(g, [[x-width-3,foot],[x-width-2,foot-6],[tip-5,top+7],[tip-3,top+3],
      [tip-1,top+3],[tip,top],[tip+2,top],[tip+3,top+5],[tip+5,top+8],
      [tip+5,top+14],[x+width+4,foot],[x+width+1,foot+3],[x-1,foot+3]], c.contour);
    polygon(g, [[x-width-1,foot],[x-width+1,foot-7],[tip-4,top+8],[tip,top+4],[tip+2,top+4],
      [tip+3,top+9],[tip+3,top+15],[x+width+1,foot],[x+width-1,foot+2]], c.fur);
    polygon(g, [[x-width+1,foot],[tip-4,top+12],[tip+1,top+7],[tip+2,top+11],
      [tip+1,top+16],[x+width-1,foot],[x+1,foot+1]], c.ear);
    polygon(g, [[x-width+1,foot],[tip-4,top+12],[tip-1,top+9],
      [tip-2,top+15],[x+1,foot],[x-1,foot+1]], c.earBright);
    if (long) {
      box(g, tip-1, top-2, 2, 3, c.contour);
      box(g, tip+1, top+1, 2, 2, c.contour);
      points(g, [[x+2,foot-3],[x+3,foot-3],[x+2,foot-2]], c.light);
    }
    g.restore();
  }

  const headOuter = [[-25,-2],[-23,-7],[-22,-11],[-17,-15],[-11,-17],[-5,-18],[8,-18],[15,-16],[21,-13],
    [24,-9],[25,-5],[25,0],[28,3],[26,4],[28,6],[26,7],[27,10],[24,10],
    [23,13],[20,13],[18,16],[13,18],[7,19],[-7,19],[-13,18],[-18,16],[-20,14],[-23,14],[-23,12],
    [-26,12],[-25,9],[-28,8],[-26,5],[-27,3],[-25,1]];
  const headFill = [[-23,-2],[-22,-8],[-20,-11],[-16,-14],[-10,-16],[-5,-17],[8,-17],[14,-15],[20,-12],
    [22,-9],[24,-4],[24,1],[26,4],[24,5],[26,8],[23,8],[23,11],[20,12],[18,14],[12,17],[7,18],
    [-7,18],[-11,17],[-16,15],[-18,13],[-21,13],[-22,11],[-24,10],[-23,8],[-26,7],[-24,5],[-25,3],[-23,1]];

  function eye(g, side, look, mood) {
    const { coat, form: f } = look, c = colors(look);
    const x = round(side * (9+f.eyeSpace*23) + 1);
    const y = round(-.5 - f.eyeLift*14 - side * f.eyeTilt*.095);
    const width = Math.max(3, round(4.7 * f.eyeWidth));
    const open = clamp(mood.open * f.eyeOpen);
    const h = Math.max(1, round(4.75 * open * f.eyeHeight));
    const tilt = round(f.eyeTilt / 15) * side;
    if (h < 2) {
      line(g, x-width+1, y, x+width-1, y+tilt, c.contour);
      return;
    }
    const iris = mix(side < 0 ? coat.eye : coat.eyeRight, '#edbf69', .23);
    polygon(g, [[x-width-1,y-1],[x-width+1,y-h],[x+width-1,y-h+tilt],
      [x+width+1,y-1+tilt],[x+width,y+h-1],[x+width-2,y+h],[x-width+2,y+h],
      [x-width,y+h-1]], c.contour);
    ellipse(g,x,y+.2,width-.4,h-.6,iris);
    box(g, x-2, y+h-2, 4, 1, mix(iris, '#fff2ae', .50));
    const px = x + round(mood.gaze * (width >= 5 ? 1.8 : 1));
    const py = y - (h >= 4 ? round(mood.gazeY) : 0);
    const pupilH = py === y ? h-.30 : h-1.25;
    ellipse(g, px, py, 1.4 + f.pupilWidth*.74, pupilH, ink);
    if (f.glintSize > .25) box(g, px-1, py-round(pupilH)+1, f.glintSize > .74 ? 2 : 1, 1, pale);
    if (h > 3) box(g, px+1, py+1, 1, 1, mix(iris,pale,.43));
  }

  function head(g, look, long, mood) {
    const f = look.form, c = colors(look);
    ear(g,-1,look,long,mood);
    ear(g,1,look,long,mood);
    polygon(g, headOuter, c.contour);
    polygon(g, headFill, c.fur);
    polygon(g, [[-22,7],[-17,11],[-10,13],[-7,16],[4,17],[12,15],[18,12],
      [24,7],[23,11],[19,14],[12,17],[7,18],[-8,18],[-15,15],[-20,13],[-21,11]], c.shadow);
    polygon(g, [[-20,-10],[-15,-14],[-8,-16],[8,-16],[14,-14],[9,-13],[1,-14],[-9,-13],[-15,-10]], c.light);

    const shift = round(f.patternShift * 8);
    if (f.pattern==='tabby') {
      g.save();
      g.translate(shift, 0);
      for (const side of [-1,1]) {
        g.save();
        g.scale(side, 1);
        const spread = round(f.patternScale * 6);
        polygon(g, [[1,-16],[4,-16],[7,-14],[6,-11],[4,-8],[4,-13]], c.pattern);
        polygon(g, [[spread+5,-15],[spread+8,-14],[spread+9,-12],[spread+4,-10],[spread+2,-8],[spread+4,-13]], c.pattern);
        polygon(g, [[22,-4],[24,-3],[24,-1],[18,-2],[15,-1]], c.pattern);
        polygon(g, [[24,2],[25,4],[22,5],[18,4],[16,5],[19,3]], c.pattern);
        g.restore();
      }
      g.restore();
    } else if (f.pattern==='patch' || f.pattern==='calico') {
      polygon(g,[[-20,-10],[-16,-13],[-10,-15],[-3,-15],[1,-11],[-3,-6],[-11,-5],[-15,0],[-22,1]],
        f.pattern==='calico'?c.chest:c.pattern);
      polygon(g,[[10,-15],[16,-13],[21,-10],[23,-4],[19,-3],[14,-4],[11,-8]],c.pattern);
    } else if (f.pattern==='point') {
      ellipse(g,0,6,18,8,c.pattern);
    }
    if (f.blaze>.02 || f.pattern==='tuxedo') {
      const w=1 + f.blaze*4;
      polygon(g,[[-w,-8],[w,-6],[w,3],[w+3,7],[-w-2,7],[-w,3]], c.chest);
    }

    for (const side of [-1,1]) {
      g.save();
      g.scale(side, 1);
      points(g, [[7,-7],[8,-8],[9,-8],[10,-8],[11,-7],[18,6],[19,6],[20,5],[19,7],
        ...(long ? [[21,8],[20,9],[17,9]] : [])], c.light);
      g.restore();
      eye(g, side, look, mood);
    }
    const noseY = round(5 - f.noseLift*14);
    const muzzle = 4.9 * f.muzzleWidth;
    ellipse(g,-3,noseY+3,muzzle,3.6,c.muzzle);
    ellipse(g,3,noseY+3,muzzle,3.6,c.muzzle);
    box(g, -Math.max(1,round(2*f.noseWidth)),noseY,Math.max(3,round(4*f.noseWidth)),Math.max(1,round(2*f.noseHeight)),c.nose);
    box(g,-1,noseY+2,2,1,c.contour);
    line(g,0,noseY+2,0,noseY+4,c.contour);
    points(g,[[-2,noseY+4],[-1,noseY+5],[1,noseY+5],[2,noseY+4]],c.contour);
    if (mood.anger>.39) {
      box(g,-3,noseY+4,7,4,ink);
      box(g,-2,noseY+4,1,2,pale);
      box(g,2,noseY+4,1,2,pale);
      box(g,-1,noseY+7,3,1,c.nose);
    }
    if (f.whiskerLength>.08) for (const side of [-1,1]) {
      g.save();g.scale(side,1);
      const whisker = mix(look.coat.whisk,c.fur,.30);
      const end = 14+f.whiskerLength*8;
      line(g,13,noseY+4,end,noseY+3-f.whiskerSpread,whisker);
      if (f.whiskerLength>.35) line(g,14,noseY+6,end-2,noseY+6+f.whiskerSpread,whisker);
      g.restore();
    }
  }

  const face = document.createElement('canvas');
  face.width=86;
  face.height=70;
  const faceContext=face.getContext('2d');
  function paintHead(g, look, long, mood) {
    faceContext.setTransform(1,0,0,1,0,0);
    faceContext.clearRect(0,0,face.width,face.height);
    faceContext.translate(43,45);
    head(faceContext,look,long,mood);
    const w=round(face.width * look.form.headWidth), h=round(face.height * look.form.headHeight);
    g.imageSmoothingEnabled=false;
    g.drawImage(face,-round(w/2),-round(45*look.form.headHeight),w,h);
  }

  function body(g, look, long, motion) {
    const f = look.form, c = colors(look);
    const top = -round(42*f.bodyHeight);
    const w = round(20*f.bodyWidth*f.hips**.38);
    const lean=round(motion.mouseLean*3);
    g.save();g.translate(-lean,0);
    polygon(g, [[-12,top],[12,top],[15,top+9],[w-1,-28],[w,-18],[w+2,-11],[w+2,-6],
      [w,-2],[w-5,1],[12,2],[-12,2],[-w+5,1],[-w,-2],[-w-2,-7],[-w-1,-13],[-w,-18],[-w+2,-28],[-15,top+10]],c.contour);
    polygon(g, [[-11,top+1],[11,top+1],[14,top+10],[w-2,-28],[w-1,-18],[w+1,-11],[w+1,-6],
      [w-2,-2],[w-6,0],[12,1],[-12,1],[-w+6,0],[-w+2,-2],[-w-1,-7],[-w,-13],[-w+1,-18],[-w+3,-28],[-14,top+11]],c.fur);
    polygon(g, [[w-3,-29],[w-2,-21],[w-1,-17],[w,-11],[w,-7],[w-3,-2],[w-8,0],[11,0],
      [13,-6],[14,-10],[14,-17],[16,-21]],c.shadow);
    polygon(g, [[-w+1,-17],[-w+4,-15],[-w+7,-8],[-w+7,-5],[-w+4,-4],
      [-w+6,-1],[-w+3,-2],[-w,-8]],c.shadow);
    points(g,[[-w+2,-13],[-w+3,-11],[-w+4,-10],[w-6,-8],[w-7,-6]],c.light);
    if (f.pattern==='tabby') for (const side of [-1,1]) {
      g.save();g.scale(side,1);
      polygon(g,[[w-2,-24],[w,-20],[w-3,-18],[w-8,-18],[w-6,-21]],c.pattern);
      polygon(g,[[w,-15],[w+1,-12],[w-2,-11],[w-7,-11],[w-5,-13]],c.pattern);
      g.restore();
    }
    if (f.bibAmount>.02 || long) {
      const y=top+5, width=round(11*f.bibWidth), d=round(18*f.bibHeight);
      const wash=mix(c.fur,c.chest,long ? .55 + f.bibAmount*.44 : f.bibAmount);
      polygon(g,[[-width,y],[width,y],[width+2,y+7],[width,y+8],[width+1,y+12],
        [width-2,y+10],[width-4,y+d],[width-6,y+d-2],[1,y+d+4],[-3,y+d-1],[-7,y+d+1],[-8,y+d-3],[-width+1,y+10],[-width-2,y+11]],wash);
      if (f.bibAmount>.45 && long) {
        points(g,[[-6,y+6],[-5,y+7],[-4,y+7],[1,y+11],[2,y+12],[2,y+13],[7,y+8],[6,y+9]],c.chestShadow);
      }
    }
    for (const side of [-1,1]) {
      const x=side*(w-6);
      ellipse(g,x,0,5.5,3,c.contour);
      ellipse(g,x,-1,4.5,2,c.fur);
      box(g,x-1,0,1,1,c.shadow);
      box(g,x+2,0,1,1,c.shadow);
    }
    g.restore();
  }

  function tail(g, look, long, motion, t) {
    const f=look.form, c=colors(look);
    const lift=round(motion.tailBeat*6+Math.sin(t*1.9)*1.3+f.tailLift*12);
    const tip=round((long?35:29)*f.tailLength);
    const thickness=round((long?10:7)*f.tailWidth);
    const y=-16-lift;
    polygon(g,[[-2,-5],[5,-6],[10,-10],[15,y+1],[tip-9,y-4],[tip-3,y-4],[tip,y],
      [tip+2,y+3],[tip+2,y+thickness-1],[tip-1,y+thickness+1],[tip-5,y+thickness+1],
      [tip-10,y+thickness+3],[13,0],[8,3],[-2,2]],c.contour);
    polygon(g,[[-1,-4],[6,-5],[11,-9],[16,y+2],[tip-8,y-3],[tip-3,y-3],[tip-1,y],
      [tip+1,y+4],[tip,y+thickness-1],[tip-5,y+thickness],[tip-10,y+thickness+2],
      [13,-1],[8,2],[-1,1]],c.fur);
    polygon(g,[[4,-2],[11,-3],[16,-4],[tip-10,y+thickness-1],
      [tip-5,y+thickness-3],[tip,y+thickness-3],[tip-4,y+thickness],[13,-1],[8,2],[3,2]],c.shadow);
    if (f.tailBands>.03 || f.pattern==='tabby') {
      for (const x of [15,Math.max(19,tip-9)]) {
        polygon(g,[[x-3,y],[x,y-1],[x+3,y+2],[x+6,y+thickness],[x+3,y+thickness+1],[x+1,y+5]],c.pattern);
      }
    }
    points(g,[[tip-6,y],[tip-5,y],[tip-4,y+1],[tip-3,y+1]],c.light);
  }

  function arm(g, start, end, look, side, tucked) {
    const { coat, form: f } = look, c=colors(look);
    const dx=end.x-start.x, dy=end.y-start.y, distance=Math.hypot(dx,dy);
    const steps=Math.max(1,Math.ceil(distance));
    const width = f.pawWidth;
    for (const [radius, color, offset] of [[3.40*width,c.contour,tucked?.34:.08],[2.65*width,c.fur,0]]) {
      for (let i=Math.floor(offset*steps); i<=steps; i++) {
        const t=i/steps, curve=Math.sin(t*Math.PI)*side*(tucked?2:3);
        ellipse(g,start.x+dx*t+curve,start.y+dy*t,radius,radius,color);
      }
    }
    const sock=side<0?f.sockLeft:f.sockRight;
    ellipse(g,end.x,end.y,4.55*width,3.66*f.pawRound,c.contour);
    const tint=f.pattern==='point'?c.pattern:mix(c.fur,coat.paw,.18+sock*.46);
    ellipse(g,end.x,end.y-.7,3.6*width,2.67*f.pawRound,tint);
    points(g,[[end.x-1,end.y+1],[end.x+1,end.y+1]],c.shadow);
    points(g,[[end.x-1,end.y-2],[end.x,end.y-2]],c.light);
  }

  function project(x, y, z) {
    return { x: 91+(x-.42)*(24+(z-1.2)*1.25), y: 119+(z-.91)*13-y*23 };
  }

  function keyboard(g,m,t) {
    polygon(g,[[40,116],[142,116],[149,135],[148,139],[146,140],[32,140],[30,138],[31,133],[36,118]],deskInk);
    polygon(g,[[39,117],[142,117],[147,134],[34,134]],'#6b546e');
    box(g,34,136,112,2,'#73516e');
    box(g,127,136,12,1,'#ba7f91');
    box(g,139,136,3,1,'#fac085');
    for (const key of layout.values()) {
      const pos=project(key.x,.24,key.z), pitch=24+(key.z-1.2)*1.25;
      const width=Math.max(3,round(key.width*pitch-.15));
      const x=round(pos.x-width/2), down=m.privacy?0:m.keyDepth(key.code,t), y=round(pos.y-1)+(down>.15?1:0);
      const accent=['Escape','Backspace','Enter'].includes(key.code);
      const top=down>.15?'#fa7890':accent?'#f3aa8e':key.code==='Space'?'#d4a8cc':'#fff0d7';
      box(g,x,y+2,width,2,down>.15?'#9f5372':'#ae8794');
      box(g,x,y,width,2,top);
      if (width>3 && !m.privacy) box(g,x+1,y,1,1,accent?'#a86f81':'#cbb0b0');
    }
  }

  function mouse(g,m) {
    const x=round(20+m.mouseOffset[0]*12), y=round(127+m.mouseOffset[1]*11);
    ellipse(g,x,y+1,7.2,8,deskInk);
    ellipse(g,x,y,6,7,'#b7829a');
    ellipse(g,x,y-1,5,5,'#fae4cf');
    if (m.press[0]>.02) box(g,x-4,y-4,3,4,'#f5a996');
    if (m.press[2]>.02) box(g,x+1,y-4,3,4,'#f5a996');
    box(g,x,y-5,1,4,keyText);
    box(g,x,y-4,1,2,'#e6918a');
    if (m.scrollSign) {
      const dir=m.scrollSign>0?1:-1;
      points(g,[[x-10,y],[x-10,y+dir],[x-11,y],[x-9,y]],'#f8ce9f');
    }
    return {x,y};
  }

  class View {
    constructor(surface) {
      this.surface=surface;
      this.ctx=surface.getContext('2d');
      this.art=document.createElement('canvas');
      this.art.width=WIDTH;
      this.art.height=HEIGHT;
      this.g=this.art.getContext('2d');
      this.g.imageSmoothingEnabled=false;
      this.appearance=new Map();
      this.inspect('desk');
      this.privateKeys=false;
    }
    select(id) { this.id=id; }
    skin(id,value) { this.appearance.set(id,PawLooks.normalize(id,value)); }
    inspect(pose) { this.pose=pose; }
    resize(w,h,ratio=devicePixelRatio||1) {
      this.width=w;this.height=h;
      this.ratio=Math.min(ratio,2,Math.sqrt(2000000/(w*h)));
      const dw=Math.max(1,round(w*this.ratio)), dh=Math.max(1,round(h*this.ratio));
      if(this.surface.width!==dw||this.surface.height!==dh){
        this.surface.width=dw;this.surface.height=dh;
      }
    }
    frame() {
      const crop=this.pose==='face'?[47,12,84,75]:[4,9,163,135];
      const zoom=Math.min(this.width/crop[2],this.height/crop[3]);
      return { crop, zoom, left:(this.width-crop[2]*zoom)/2, top:(this.height-crop[3]*zoom)/2 };
    }
    hit(x,y) {
      const {crop,zoom,left,top}=this.frame();
      const px=crop[0]+((x+1)*this.width/2-left)/zoom;
      const py=crop[1]+((1-y)*this.height/2-top)/zoom;
      if(this.pose!=='face'){
        for(const key of layout.values()){
          const spot=project(key.x,.24,key.z);
          if(Math.abs(px-spot.x)<key.width*13 && Math.abs(py-spot.y)<2.1) return key.code;
        }
        if(this.mouse&&Math.abs(px-this.mouse.x)<8&&Math.abs(py-this.mouse.y)<9) return 'mouse';
      }
      return px>55&&px<118&&py>16&&py<85?'head':null;
    }
    render(m,t) {
      const look=this.appearance.get(this.id);
      if(!this.width || !look) return;
      const g=this.g, f=look.form, long=this.id==='chestnut', profile=this.pose==='face';
      const wave=(t+1.65)%4.6, blink=wave<.15?Math.sin(wave/.15*Math.PI):0;
      const mood={open:clamp(1-Math.max(blink,m.sleep,m.hello*.50,m.nuzzle*.92,m.rage*.56,m.drive*.26)),
        tilt:m.earBounce*3,gaze:m.gaze[0],gazeY:m.gaze[1]*m.cursorLook,anger:Math.max(m.rage,m.pique*.76)};
      const skinY=round(58-(f.bodyHeight-1)*26-f.headLift*22+m.sleep*2+m.landing*1.7-m.hello);
      const skinX=round(86+m.head[0]*2.4-m.mouseLean*5+m.balance*1.8);
      g.clearRect(0,0,WIDTH,HEIGHT);
      if (!profile) {
        ellipse(g,91,140,60,3,'#251f3648');
        ellipse(g,90,113,43,2,'#251f363a');
        g.save();
        g.translate(99,112);
        tail(g,look,long,m,t);
        g.restore();
        g.save();
        g.translate(86,110);
        body(g,look,long,m);
        g.restore();
      }
      g.save();
      g.translate(skinX,skinY);
      paintHead(g,look,long,mood);
      g.restore();
      if (!profile) {
        keyboard(g,m,t);
        this.mouse=mouse(g,m);
      }
      if (!profile || m.privacy) for (const [i, paw] of m.paws.entries()) {
        const side=i?1:-1;
        const tucked = !m.privacy && 1-ease((paw.pos.z-.94)/.53);
        const x=86+side*12*f.shoulders - round(m.mouseLean*2);
        const y=round(80-(f.bodyHeight-1)*16);
        const target=m.privacy?{x:skinX+side*10,y:skinY-1}:project(paw.pos.x,paw.pos.y,paw.pos.z);
        if (!m.privacy) {
          target.x+=(x-side*1.5-target.x)*tucked;
          target.y+=(103-(f.bodyHeight-1)*15-target.y)*tucked;
          const atMouse=i===m.mouseSide?m.mouseLean*clamp((-paw.pos.x-1.30)/.74):0;
          target.x+=(this.mouse.x-target.x)*atMouse;
          target.y+=(this.mouse.y-1-target.y)*atMouse;
        }
        arm(g,{x,y},target,look,side,tucked>.7);
      }
      if (!profile && !m.privacy && !this.privateKeys) {
        for (const hit of m.hits.slice(-4)) {
          const age=t-hit.at, key=layout.get(hit.code);
          if (age<0||age>.42||!key) continue;
          const point=project(key.x,.32,key.z), n=round(age*15);
          points(g,[[point.x,point.y-8-n],[point.x-2,point.y-9-n],[point.x+2,point.y-9-n],
            [point.x,point.y-11-n]],age<.19?'#ffbd80':'#e39bb1');
        }
      }
      if(m.hello>.46||m.nuzzle>.48) {
        const y=skinY-20-round(Math.sin(t*3)*2), x=skinX+28;
        polygon(g,[[x-5,y-2],[x-3,y-4],[x-1,y-4],[x,y-2],[x+1,y-4],
          [x+3,y-4],[x+5,y-2],[x+5,y],[x,y+5],[x-5,y]],'#ee839c');
        points(g,[[x-3,y-1],[x-2,y-2],[x-3,y-2]],'#ffcabb');
      }
      const ctx=this.ctx, {crop,zoom,left,top}=this.frame(), r=this.ratio;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,this.surface.width,this.surface.height);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(this.art,...crop,round(left*r),round(top*r),
        round(crop[2]*zoom*r),round(crop[3]*zoom*r));
    }
    snapshot() { return this.surface.toDataURL('image/png'); }
  }

  function portrait(canvas,look,long) {
    canvas.width=70;
    canvas.height=57;
    const g=canvas.getContext('2d');
    g.translate(35,34);
    paintHead(g,look,long,neutral);
  }
  window.PawPixels = {View,portrait};
})();
