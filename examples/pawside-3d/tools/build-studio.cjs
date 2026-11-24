'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../web');
const file = process.argv[2] || 'Pawside-3D-Studio.html';
const html = fs
  .readFileSync(path.join(dir, 'index.html'), 'utf8')
  .replace(/<script src="([^"]+)"><\/script>/g, (_tag, source) => {
    let script = fs.readFileSync(path.join(dir, source), 'utf8');
    if (source === 'vendor/three.min.js')
      script =
        '/*\n' +
        fs.readFileSync(path.join(dir, 'vendor/THREE-LICENSE'), 'utf8') +
        '\n*/\n' +
        script;
    for (const pet of ['ink', 'chestnut']) {
      const image = fs
        .readFileSync(path.join(dir, 'thumb-' + pet + '.png'))
        .toString('base64');
      script = script.replace(
        '@@' + pet.toUpperCase() + '@@',
        'data:image/png;base64,' + image
      );
    }
    return (
      '<script>\n' + script.replace(/<\/script/gi, '<\\/script') + '\n</script>'
    );
  });
fs.writeFileSync(file, html);
