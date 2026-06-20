# riscv

An online 64-bit RISCV interpreter with support for 84 instructions (RV64I + M extension + pseudoinstructions), syntax highlighting, autocomplete, and error handling.
This interpreter is used by students in Cornell CS 3410 (starting Fall 2024) to test and develop RISCV assembly.

# setup
Install git-lfs and then run git lfs fetch --all

Setup node.js, corepack, and yarn _berry_ (not yarn classic) (see https://yarnpkg.com/getting-started/install).
Clone this repo and simply type

```
yarn install
```

Depending on your editor follow these instructions: https://yarnpkg.com/getting-started/editor-sdks. \
You're done! YAY!

# project structure

There are two packages (the compiler and the VM) and the main src folder. The src folder is the front-facing UI, and descriptions for the two packages are available in their respective packages/\* folder.

# licenses / acknowledgements

Inspired (and originally based on) Peter Engel's RISCV interpreter.

IMPORTANT: All parts of my code (minus some yarn stuff / third-party packages) is fully dedicated to the public-domain.
If you contribute to this project you agree to release your code to the public domain under CC0.
