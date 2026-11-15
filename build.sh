set -e
npx esbuild src/main.js --bundle --minify --format=iife --outfile=dist/bundle.js --log-level=warning
node -e '
const fs=require("fs");const b=fs.readFileSync("dist/bundle.js","utf8").replace(/<\/script/g,"<\\/script");
fs.writeFileSync("dist/index.html",fs.readFileSync("src/template.html","utf8").replace("/*BUNDLE*/",()=>b));'
