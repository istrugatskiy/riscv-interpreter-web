import { bytecode_of_string } from './lib_macro';
import { core_macros } from './core_macros';
import { pseudo_macros } from './pseudo_macros';

export const compile_riscv = bytecode_of_string.bind(undefined, [
    ...core_macros,
    ...pseudo_macros,
]);

console.log(core_macros.toSorted(({ name }, b) => name.localeCompare(b.name)));
console.log(pseudo_macros);
export * from './ast/ast_utils';
export { parser as riscv_parser } from './ast/riscv';
export * from './arguments';
export * from './compiler_errors';
export * from './core_macros';
export * from './lib_macro';
export * from './pseudo_macros';
export * from './reg_name_to_id';
