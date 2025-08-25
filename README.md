# riscv

An online 64-bit RISCV interpreter with support for 70+ instructions, syntax highlighting, and error handling.
This interpreter is used by students in Cornell CS 3410 (starting Fall 2024) to test and develop RISCV assembly.

# TODOs

- ~~Add suppport for whitespace in the middle of arguments.~~
- ~~Add support for + in arguments, so that label offsets work.~~
- Forward and backward support in labels.
- ~~Add mul extension support.~~
- Better error-handling system for code (we have a lot of debug info generated but we never give it to the user).
- Replace syntax & add error handling.
- e2e test cases.
- Fix up dev environment (i.e. add eslint, prettier, etc into CI/CD)
- Memory view

# setup

Setup node.js, corepack, and yarn _berry_ (not yarn classic) (see https://yarnpkg.com/getting-started/install).
Clone this repo and simply type

```
yarn install
```

Depending on your editor follow these instructions: https://yarnpkg.com/getting-started/editor-sdks. \
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

IMPORTANT: All parts of my code (minus some yarn stuff / third-party packages) is fully dedicated to the public-domain.
If you contribute to this project you agree to release your code to the public domain under CC0.
