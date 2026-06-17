const fs = require('fs');
const html = fs.readFileSync('ar.html', 'utf8');

const styleRegex = /<style>([\s\S]*?)<\/style>/;
const scriptRegex = /<script>\s*'use strict';\s*\/\*\*([\s\S]*?)<\/script>/;

const cssContent = html.match(styleRegex)[1].trim();
const jsContent = '\'use strict\';\n\n/**' + html.match(scriptRegex)[1].trim();

fs.writeFileSync('css/ar.css', cssContent);
fs.writeFileSync('js/ar.js', jsContent);

let newHtml = html.replace(styleRegex, '<link rel="stylesheet" href="css/ar.css" />');
newHtml = newHtml.replace(scriptRegex, '<script src="js/ar.js"></script>');

fs.writeFileSync('ar.html', newHtml);
console.log('Extraction complete');
