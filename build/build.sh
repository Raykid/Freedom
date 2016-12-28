tsc ../src/ares/Ares.ts --outFile ../dist/ares.js --sourceMap --target es5
uglifyjs ../dist/ares.js -o ../dist/ares.min.js
tsc ../src/ares/html/HTMLCompiler.ts --outFile ../dist/ares_html.js --sourceMap --target es5
uglifyjs ../dist/ares_html.js -o ../dist/ares_html.min.js
tsc ../src/ares/pixijs/PIXICompiler.ts --outFile ../dist/ares_pixi.js --sourceMap --target es5
uglifyjs ../dist/ares_pixi.js -o ../dist/ares_pixi.min.js
