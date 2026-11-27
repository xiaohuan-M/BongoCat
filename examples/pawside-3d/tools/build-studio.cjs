'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../web');
const file = process.argv[2] || 'Pawside-Studio.html';
const html = fs
  .readFileSync(path.join(dir, 'index.html'), 'utf8')
  .replace('<link rel="stylesheet" href="workshop.css">', () =>
    '<style>\n' + fs.readFileSync(path.join(dir,'workshop.css'),'utf8') + '\n</style>')
  .replace(/<script src="([^"]+)"><\/script>/g, (_tag, source) => {
    let script = fs.readFileSync(path.join(dir, source), 'utf8');
    if (source === 'vendor/three.min.js')
      script =
        '/*\n' +
        fs.readFileSync(path.join(dir, 'vendor/THREE-LICENSE'), 'utf8') +
        '\n*/\n' +
        script;
    return (
      '<script>\n' + script.replace(/<\/script/gi, '<\\/script') + '\n</script>'
    );
  });
fs.writeFileSync(file, html);
