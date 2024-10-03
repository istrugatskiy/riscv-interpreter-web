# This is probably a good example of where a Makefile would be useful...
cd rv-interpreter-main
# Suspicious line of code hacked together at 2 AM which works, but produces an error you can ignore:
emcc -O2 src/interpreter.c src/hash_table.c src/label_table.c -s MODULARIZE=1 -s EXPORT_NAME="MyModule" -s EXPORTED_FUNCTIONS='["_set_register", "_set_memory", "_prepare_code", "_run_code", "_free_code"]' -s "EXTRA_EXPORTED_RUNTIME_METHODS=['FS', 'ccall', 'cwrap']" -s FILESYSTEM=1 -s WASM_BIGINT=1 -s INCOMING_MODULE_JS_API=print,printErr --emit-tsd output.d.ts
rm ../src/output.js
rm ../src/index.wasm
rm ../src/output.d.ts
mv a.out.js ../src/output.js
mv a.out.wasm ../src/a.out.wasm
mv output.d.ts ../src/output.d.ts
rm -r dist/
rm -r .parcel-cache