// Canonical fields for the studio, skin files, and desktop preview.
(function (root) {
  'use strict';
  const range = (key, label, min, max, value = 1, unit = '%', step = .01) =>
    ({ key, label, min, max, value, unit, step, kind: 'range' });
  const offset = (key, label, min, max) => range(key, label, min, max, 0, 'offset');
  const degrees = (key, label, min, max) => range(key, label, min, max, 0, '°', 1);
  const color = (key, label) => ({ key, label, kind: 'color' });
  const patterns = [
    ['solid', '纯色'], ['tuxedo', '白胸'], ['tabby', '虎斑'],
    ['calico', '三花'], ['point', '重点色'], ['patch', '奶牛斑'],
  ];
  const groups = [
    { key: 'head', label: '头脸', fields: [
      range('headWidth', '头宽', .82, 1.22),
      range('headHeight', '脸长', .84, 1.18),
      range('headDepth', '头部厚度', .77, 1.23),
      offset('headLift', '头部高低', -.18, .18),
      range('forehead', '额头饱满度', .66, 1.41),
      range('cheeks', '脸颊饱满度', .55, 1.54),
      range('jaw', '下巴宽度', .65, 1.38),
    ]},
    { key: 'eye', label: '眼睛', fields: [
      range('eyeWidth', '眼宽', .65, 1.28),
      range('eyeHeight', '眼高', .66, 1.24),
      offset('eyeSpace', '眼距', -.08, .09),
      offset('eyeLift', '眼睛位置', -.12, .12),
      degrees('eyeTilt', '眼角倾斜', -24, 24),
      range('eyeTaper', '眼角收尖', 0, 1, .28),
      range('eyeOpen', '睁眼幅度', .52, 1.16),
      range('pupilWidth', '瞳孔宽度', .20, 1.50),
      range('pupilHeight', '瞳孔高度', .52, 1.17),
      range('irisDetail', '虹膜纹理', 0, 1.7),
      range('glintSize', '眼神光大小', .15, 1.9),
      range('glintStrength', '眼神光亮度', 0, 1.35),
      range('lidShade', '上眼睑阴影', 0, 1.6),
      color('eye', '画面左眼'), color('eyeRight', '画面右眼'),
    ]},
    { key: 'ears', label: '耳朵', fields: [
      range('earLength', '耳尖高度', .58, 1.28),
      range('earWidth', '耳根宽度', .70, 1.24),
      range('earDepth', '耳朵厚度', .55, 1.25),
      offset('earSpace', '耳朵间距', -.12, .10),
      offset('earLift', '耳根位置', -.12, .08),
      degrees('earAngle', '耳朵外张', -15, 28),
      range('earInside', '耳窝颜色面积', .45, 1.42),
      color('ear', '耳窝颜色'),
    ]},
    { key: 'muzzle', label: '口鼻', fields: [
      range('muzzleWidth', '口鼻宽度', .66, 1.38),
      range('muzzleDepth', '口鼻突出', .46, 1.58),
      range('noseWidth', '鼻头宽度', .52, 1.53),
      range('noseHeight', '鼻头高度', .53, 1.50),
      range('noseDepth', '鼻头厚度', .50, 1.36),
      offset('noseLift', '鼻头位置', -.12, .11),
      range('mouthWidth', '嘴宽', .57, 1.42),
      offset('mouthSmile', '嘴角弧度', -.07, .07),
      range('whiskerLength', '胡须长度', 0, 1.50),
      range('whiskerSpread', '胡须扇开', .46, 1.52),
      range('whiskerWidth', '胡须粗细', .38, 1.65),
      offset('whiskerLift', '胡须高度', -.11, .10),
      color('nose', '鼻头颜色'), color('whisk', '胡须颜色'),
    ]},
    { key: 'body', label: '体态', fields: [
      range('bodyWidth', '身体宽度', .83, 1.21),
      range('bodyHeight', '坐姿高度', .85, 1.14),
      range('bodyDepth', '身躯厚度', .79, 1.24),
      range('shoulders', '前肩间距', .83, 1.16),
      range('hips', '后腿饱满度', .72, 1.26),
      range('pawWidth', '爪掌宽度', .83, 1.26),
      range('pawRound', '爪尖圆度', .72, 1.20),
      range('tailLength', '尾巴长度', .61, 1.30),
      range('tailWidth', '尾巴粗细', .62, 1.43),
      offset('tailLift', '尾尖高度', -.32, .36),
      range('tailCurl', '尾巴弯曲', .40, 1.60),
      color('paw', '白趾颜色'), color('pad', '肉垫颜色'),
    ]},
    { key: 'coat', label: '花纹', fields: [
      { key: 'pattern', label: '毛色花型', kind: 'select', value: 'solid', options: patterns },
      range('patternAmount', '花纹浓度', 0, 1, .85),
      range('patternScale', '花纹大小', .63, 1.60),
      offset('patternShift', '花纹位移', -.35, .35),
      range('bibAmount', '胸口白斑', 0, 1, 0),
      range('bibWidth', '胸斑宽度', .48, 1.55),
      range('bibHeight', '胸斑长度', .43, 1.56),
      range('blaze', '额鼻白线', 0, 1, 0),
      range('muzzleMark', '口鼻浅色', 0, 1.5, .92),
      range('sockLeft', '画面左爪白趾', 0, 1, .64),
      range('sockRight', '画面右爪白趾', 0, 1, .53),
      range('tailBands', '尾巴环纹', 0, 1, 0),
    ]},
    { key: 'colors', label: '毛色', fields: [
      color('fur', '主毛色'), color('shade', '暗部毛色'), color('light', '胸口与浅斑'),
      color('stripe', '条纹与深斑'), color('muzzle', '口鼻浅毛'), color('cheek', '脸颊色'),
    ]},
    { key: 'light', label: '材质', fields: [
      range('furFuzz', '脸颊绒毛长度', 0, 1.85),
      range('furGrain', '表面毛纹', 0, 1.8),
      range('lightPower', '光照起伏', .3, 1.7),
      range('chinShade', '下巴阴影', 0, 1.7),
      range('rimPower', '外轮廓高光', 0, 1.6),
      range('rimWidth', '外轮廓宽度', .55, 1.7),
      range('armLine', '前爪边缘', 0, 1.6),
      range('padAmount', '肉垫显色', 0, 1.3),
    ]},
  ];
  const palettes = {
    ink: {
      fur: '#242631', shade: '#181923', light: '#eee4d7', stripe: '#11141e',
      eye: '#e8b962', eyeRight: '#e8b962', nose: '#906773', ear: '#58434a',
      paw: '#eee4d7', pad: '#a5737d', whisk: '#a29b98', muzzle: '#463c40', cheek: '#493d42',
    },
    chestnut: {
      fur: '#cb8f67', shade: '#ad7254', light: '#f2cda7', stripe: '#945d43',
      eye: '#aac17a', eyeRight: '#aac17a', nose: '#925e53', ear: '#ad7c68',
      paw: '#f2cda7', pad: '#ab777f', whisk: '#dbc0a5', muzzle: '#f2cda7', cheek: '#cc8a76',
    },
  };
  const renderStyles = { paper: '2D', volume: 'Pawside 3D', pixel: '像素风' };
  const temperaments = {
    calm: { label: '温和', sleepAfter: 25, greeting: 1.65, nuzzle: .85 },
    curious: { label: '好奇', sleepAfter: 45, greeting: 2.25, nuzzle: 1.3 },
    sleepy: { label: '贪睡', sleepAfter: 12, greeting: 1.2, nuzzle: .68 },
  };
  const preset = [
    { key: 'silvercoon', pet: 'chestnut', name: '银杏', breed: '银灰缅因', english: 'Ginkgo', paper: '#d9e3df',
      coat: { fur: '#a0a6ae', shade: '#737988', light: '#efece2', stripe: '#525662', eye: '#b2bd7a', ear: '#c49a9d', muzzle: '#e8e3da', cheek: '#b1a5a4', nose: '#ae797c', whisk: '#f3eee1', paw: '#edebe5' },
      form: { pattern: 'tabby', headWidth: 1.03, headHeight: .94, jaw: 1.26, cheeks: 1.19, earLength: 1.17, earWidth: .95, earAngle: -2, eyeWidth: .96, eyeHeight: .88, eyeTilt: 7, bibAmount: .94, tailWidth: 1.26, tailBands: .85, muzzleWidth: 1.19 } },
    { key: 'creamcoon', pet: 'chestnut', name: '栗酥', breed: '奶油缅因', english: 'Chestnut', paper: '#f1ddc4',
      coat: { fur: '#d5a477', shade: '#ae805e', light: '#f8eaca', stripe: '#a87651', eye: '#9ea579', ear: '#d8a49a', nose: '#b37a75', whisk: '#fff0d8', muzzle: '#f4dfbf', cheek: '#dbac92', paw: '#f6e4c7' },
      form: { pattern: 'tabby', patternAmount: .58, earLength: 1.09, headWidth: 1.07, cheeks: 1.19, jaw: 1.14, eyeHeight: .96, tailWidth: 1.26, bibAmount: .90, tailBands: .66 } },
    { key: 'mackerel', pet: 'ink', name: '山椒', breed: '棕纹狸花', english: 'Pepper', paper: '#ded9bf',
      coat: { fur: '#a28a6d', shade: '#75634f', light: '#e0c8a0', stripe: '#514d43', eye: '#b5c578', ear: '#b58e81', nose: '#9c7068', whisk: '#f3e4c9', muzzle: '#dbc8a8', cheek: '#ba9e87', paw: '#c9b291' },
      form: { pattern: 'tabby', patternAmount: .98, eyeTilt: 12, eyeHeight: .80, earLength: .95, bodyWidth: .92, headWidth: .96, tailBands: 1, tailWidth: .85, blaze: .12, bibAmount: .22, sockLeft: .12, sockRight: .13 } },
    { key: 'ink', name: '白趾墨爪', coat: {}, form: {} },
    { key: 'blue', name: '雾蓝异瞳', coat: {
      fur: '#576073', shade: '#343b4b', light: '#dfe4e1', eye: '#a6c7dd', eyeRight: '#d3b671',
      stripe: '#343e50', ear: '#887480', nose: '#8c7481', muzzle: '#828a97', cheek: '#6e7589', whisk: '#bfc5cb', paw: '#e4e2dd',
    }, form: { headWidth: .97, bodyWidth: .95, noseWidth: .8, eyeTilt: 12, earLength: 1.11,
      bibAmount: .25, muzzleMark: .74, sockLeft: .34, sockRight: .44, tailWidth: 1.13 } },
    { key: 'orange', name: '奶橘虎斑', coat: {
      fur: '#d6a674', shade: '#ad7d5e', light: '#f1dfc8', stripe: '#ab764e', eye: '#cbb36b',
      ear: '#bb897e', muzzle: '#f0ddc4', cheek: '#d7a18c', nose: '#a3696b', whisk: '#eee2d0', paw: '#f1dfc8',
    }, form: { pattern: 'tabby', tailBands: .69, cheeks: 1.16, headWidth: 1.05, headHeight: .98,
      bibAmount: .77, bibWidth: 1.2, eyeWidth: .90, eyeHeight: .92, earLength: .86,
      whiskerWidth: .72, whiskerLength: .90, furFuzz: .52, irisDetail: .40 } },
    { key: 'silver', name: '银渐层', coat: {
      fur: '#acb0b6', shade: '#717784', light: '#f4efdf', stripe: '#6a7180', eye: '#91ad85',
      ear: '#af8a93', muzzle: '#e5ded4', cheek: '#c2b0b3', nose: '#8a636d', whisk: '#ebe8e1', paw: '#f2ede5',
    }, form: { pattern: 'tabby', patternAmount: .47, patternScale: 1.40, tailBands: .45,
      bibAmount: .55, blaze: .12, bodyWidth: 1.11, headWidth: 1.08, eyeWidth: .91, eyeHeight: 1.01,
      earLength: .76, tailWidth: 1.30, whiskerWidth: .72, furFuzz: .55, irisDetail: .36 } },
    { key: 'calico', name: '蜜桃三花', coat: {
      fur: '#eadac0', shade: '#af977d', light: '#d99062', stripe: '#59444a', eye: '#b49e62',
      ear: '#bc877f', muzzle: '#fbe9d4', cheek: '#e1a699', nose: '#a9636c', whisk: '#f5ebd7', paw: '#f8ede0',
    }, form: { pattern: 'calico', patternAmount: .95, patternScale: 1.12, bodyWidth: 1.08,
      eyeHeight: 1.06, eyeTilt: -5, tailCurl: 1.24, sockLeft: .76, sockRight: .56, blaze: .28, muzzleMark: 1.2 } },
    { key: 'tux', name: '燕尾服', coat: {
      fur: '#323039', shade: '#24202b', light: '#f0e6d2', stripe: '#252530', eye: '#aaad6a', eyeRight: '#a9ba7e',
      ear: '#775564', nose: '#8d5967', muzzle: '#efe1d6', whisk: '#d5c7ba', paw: '#f4ead8',
    }, form: { pattern: 'tuxedo', bibAmount: .89, bibHeight: 1.21, blaze: .58, muzzleMark: 1.2,
      earAngle: -8, headHeight: .99, sockLeft: .91, sockRight: .81 } },
    { key: 'siam', name: '焦糖重点色', coat: {
      fur: '#d8b593', shade: '#9e785d', light: '#e8cbb0', stripe: '#5f4951', eye: '#87b4d0',
      ear: '#785960', muzzle: '#796367', cheek: '#a78684', nose: '#71545d', paw: '#755c59', whisk: '#dcc7be',
    }, form: { pattern: 'point', patternAmount: .92, muzzleMark: 1.1, headWidth: .94, headDepth: 1.11,
      headHeight: 1.05, earLength: 1.17, earAngle: -8, tailWidth: .78, tailLength: 1.17, eyeTilt: 8 } },
  ];
  const presetDetails = {
    ink: ['墨爪', '金眼黑猫', 'Ink', '#d9d5e1'], calico: ['杏仁', '蜜桃三花', 'Almond', '#edd9ca'],
    siam: ['摩卡', '焦糖重点色', 'Mocha', '#d4dbde'], blue: ['雾灯', '雾蓝异瞳', 'Mist', '#d5dde2'],
    silver: ['雪饼', '银渐层', 'Snow', '#dedfd5'], orange: ['糖橘', '奶橘虎斑', 'Citrus', '#efdac2'],
    tux: ['燕尾', '黑白燕尾服', 'Tux', '#d8d9cd'],
  };
  for (const p of preset) {
    if (!presetDetails[p.key]) continue;
    [p.name, p.breed, p.english, p.paper] = presetDetails[p.key];
    p.pet = 'ink';
  }
  for (const p of preset) p.temperament =
    ['mackerel','blue','orange'].includes(p.key) ? 'curious' :
    ['creamcoon','silver','siam'].includes(p.key) ? 'sleepy' : 'calm';
  const formFields = groups.flatMap(g => g.fields).filter(f => f.kind !== 'color');
  const standardForm = Object.fromEntries(formFields.map(f => [f.key, f.value]));
  const coatDefaults = (id) => ({ ...(id === 'chestnut' ? palettes.chestnut : palettes.ink) });
  // Mix sRGB pigments so pale coats get a warm wash and dark coats stay dark.
  function paletteFromFur(fur) {
    const base = [1, 3, 5].map(i => parseInt(fur.slice(i, i + 2), 16));
    const tone = (base[0]*.213 + base[1]*.715 + base[2]*.072) / 255;
    const hex = (rgb) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    const wash = (pigment, amount) => hex(base.map((v, i) => v + (pigment[i] - v) * amount));
    const deepen = (factors) => hex(base.map((v, i) => v * factors[i]));
    return {
      fur,
      shade: deepen([.83, .78, .79]),
      stripe: deepen([.76, .69, .71]),
      muzzle: wash([255, 241, 225], .12 + .48 * tone),
      cheek: wash([222, 154, 139], .10 + .20 * tone),
    };
  }
  function cleanCoat(input) {
    const coat = {};
    for (const key of Object.keys(palettes.ink))
      if (typeof input?.[key] === 'string' && /^#[\da-f]{6}$/i.test(input[key]))
        coat[key] = input[key].toLowerCase();
    return coat;
  }
  function cleanForm(input) {
    const form = {};
    for (const f of formFields) {
      const x = input?.[f.key];
      if (f.kind === 'select') {
        if (f.options.some(([id]) => id === x)) form[f.key] = x;
      } else if (Number.isFinite(x)) {
        const clipped = Math.min(f.max, Math.max(f.min, x));
        form[f.key] = Number((f.min + Math.round((clipped - f.min) / f.step) * f.step).toFixed(3));
      }
    }
    return form;
  }
  function normalize(pet, style = {}) {
    const coat = cleanCoat(style.coat);
    if (coat.eye && !coat.eyeRight) coat.eyeRight = coat.eye;
    return {
      coat: { ...coatDefaults(pet), ...coat },
      form: {
        ...standardForm,
        ...(pet === 'chestnut' ? {
          bibAmount: .83, sockLeft: .38, sockRight: .38, tailBands: .60, rimPower: 0, armLine: 0,
        } : {}),
        ...cleanForm(style.form),
      },
    };
  }
  function cleanStyle(style) {
    return { coat: cleanCoat(style?.coat), form: cleanForm(style?.form) };
  }
  function readFile(value) {
    if (value?.format !== 'pawside-three' ||
        ![1, 2, 3].includes(value.version) ||
        typeof value.pet !== 'string' || !Object.hasOwn(palettes, value.pet) ||
        !value.coat || Array.isArray(value.coat) || typeof value.coat !== 'object' ||
        (value.version >= 2 && (!value.form || Array.isArray(value.form) || typeof value.form !== 'object')))
      throw Error('请选择工作室导出的皮肤 JSON。');
    const style = cleanStyle(value);
    if (Object.keys(style.coat).length !== Object.keys(value.coat).length ||
        (value.version >= 2 && Object.keys(style.form).length !== Object.keys(value.form).length))
      throw Error('皮肤文件里有无法识别的字段。');
    if (value.version === 3 && !Object.hasOwn(renderStyles, value.renderStyle))
      throw Error('皮肤文件中的画风无效。');
    return { pet: value.pet, name: skinName(value.name), renderStyle: value.version === 3 ? value.renderStyle : undefined,
      temperament: Object.hasOwn(temperaments,value.temperament) ? value.temperament : 'calm',
      preset: preset.some(p => p.key === value.preset && p.pet === value.pet) ? value.preset : '', ...style };
  }
  function skinName(value) {
    return typeof value === 'string' ? value.trim().slice(0, 36) : '';
  }
  const api = { renderStyles, temperaments, groups, palettes, patterns, preset, normalize, cleanStyle, readFile, skinName, paletteFromFur };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PawLooks = api;
})(globalThis);
