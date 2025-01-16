# riscv

An online 64-bit RISCV interpreter with support for 70+ instructions, syntax highlighting, and error handling.
This interpreter is used by students in Cornell CS 3410 (starting Fall 2024) to test and develop RISCV assembly.

# setup

Setup node.js, corepack, and yarn _berry_ (not yarn classic) (see https://yarnpkg.com/getting-started/install).
Clone this repo and simply type

```
yarn install
```

Depending on your editor follow these instructions: https://yarnpkg.com/getting-started/editor-sdks. \\
You're done! YAY!

# project structure

There are three packages and the main src folder. The src folder is the front-facing UI, and descriptions for the three packages are available in their respective packages/\* folder. This project is a giant RISCV related mono-repo.

# making changes

Make sure to always use the project's yarn version / local packages.
In other words, NEVER use npx, npm, or the global typescript, vitest commands.
Instead if you want to test something always use the `yarn run` prefix.
For testing use:

```
yarn test
```

# licenses / acknowledgements

Inspired (and originally based on) Peter Engel's RISCV interpreter.

IMPORTANT: The syntax highlighter is the only part of this project not public-domain.
All other packages / parts of my code (minus some yarn stuff) is fully dedicated to the public-domain.
If you contribute to this project you agree to release your code to the public domain under CC0.
https://github.com/codewars/codemirror-riscv/blob/main/LICENSE
