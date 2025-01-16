# riscv-parser

A RISC-V-esque parser written entirely in TypeScript.
The final output is the bytecode format described in @types (i.e: program | compile_error[])
Under the hood the parser treats (almost everything) as a macro which gets expanded into bytecode.
This bytecode can then be piped for execution on the virtual machine (@istrugatskiy/riscv-vm).
This package also contains a bunch of random utilities for working with RISCV bytecode and IR.
IR = parsed code where macros haven't been expanded yet.
