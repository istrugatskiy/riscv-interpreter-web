# riscv-compiler

## Introduction

This package provides tooling for compiling a RISC-V-esque language into bytecode which can be run by `@istrugatskiy/riscv-vm`.

A typical invocation of the compiler via `compile_riscv` works like this:

- Add a trailing newline to your assembly if it lacks one and strip trailing newlines and whitespace.
- Use the grammar specified in `./ast/riscv.grammmar` to make an AST out of your string.
- Use `./lib_macro.ts` to expand the AST using macros into bytecode that is accepted by `@istrugatskiy/riscv-vm`.
- In the event of an error, a detailed `CompilerError` array will be returned.

In addition, the compiler offers a number of utilities for working with our RISC-V-esque language and its macro system.

## The Macro System

The macro system is what makes the RISC-V compiler extremely versatile and easy to modify. The macro system is also what enables high-quality error handling and type checking. Below is an example of using the macro system to define the `bgt` (branch greater than) pseudo-instruction.

```ts
const bgt_macro = def_macro(
    'bgt',
    // This line specifies the type of the macro. In this case, the macro is two registers followed by a label.
    [reg_type, reg_type, label_type] as const,
    // core_compiler is a variant of bytecode_of_string that only works for the RISC-V base instruction set
    // alongside the RISC-V M extension. Note that core_compiler does not, as of now, support instructions like ECALL.
    ([rs1, rs2, imm]) => core_compiler`blt ${rs2}, ${rs1}, ${imm}`
);

// bytecode_of_string uses the macros you provide to it to create bytecode.
// As a result, the below call to bytecode_of_string would error out if you passed any instruction that wasn't bgt.
const prog = bytecode_of_string([bgt_macro], `label: bgt x1, x2, label`);
```

Each macro has a name, argument type information, and an `expander` function. The `expander` function receives as input pre-processed arguments. For example, if the first argument to a macro has `reg_type`, the first argument to the expander function will be an integer in the range 0 to 31. The full mappings from argument type to argument representations are specified in `ValidArgumentShapes` in `arguments.ts`.

## Regarding Lezer Versions

This compiler uses Lezer for generating an AST. For your own sanity, you must use the **same exact Lezer package versions** as we do.
