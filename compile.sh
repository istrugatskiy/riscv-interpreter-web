cd rv-interpreter-main
emcc -O2 src/interpreter.c src/hash_table.c src/label_table.c -o index.html  -s MODULARIZE=1 -s EXPORT_NAME="MyModule" -s EXPORTED_FUNCTIONS='["_set_register", "_set_memory", "_prepare_code", "_run_code", "_free_code"]' -s "EXTRA_EXPORTED_RUNTIME_METHODS=['FS', 'ccall', 'cwrap']" -s FILESYSTEM=1 -s WASM_BIGINT=1
mv index.js output.js
rm ../src/output.js