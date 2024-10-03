# riscv

## dependencies

This project uses a modified version of Peter Engel's interpreter.
Furthermore, syntax highlighting is a modified version of 'codewars/codemirror-riscv'.

## note

Project is experimental and the code quality / UI / features / may be subpar, I welcome any feedback.

## setup

yarn install (note that this project uses yarn berry not yarn classic)
setup the emscripten compiler and ensure that emcc is in your path.

## compiling

Use compile.sh to compile the contents of rv-interpreter-main to output.d.ts, output.js, a.out.wasm
These three files are auto-generated and should not be touched.
Run `yarn parcel src/index.html`, this will create a dev server for working with code.
Note that periodically parcel will get confused and output a nonsensical error or out of date code.
Deleting the dist and .parcel-cache folders should resolve the issue. Whenever you call compile.sh
you must stop and re-run parcel. This project uses tailwind for styling.

## production builds

Clear the dist folder.
`yarn parcel build src/index.html`. When running the code you will encounter a weird error.
Move 'a.out.wasm' to a folder in dist called 'src/a.out.wasm' (this is due to parcel getting confused).
Now you should be able to serve the code.

## licenses

https://github.com/codewars/codemirror-riscv/blob/main/LICENSE
