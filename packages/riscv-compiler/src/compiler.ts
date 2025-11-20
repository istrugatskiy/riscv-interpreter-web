import { core_macros } from './core_macros';
import {
    bytecode_of_string,
    type DefMacroExpr,
    string_of_def_macro,
} from './lib_macro';
import { pseudo_instructions } from './pseudo_macros';
import { parser } from './ast/riscv';
import {
    type CompilerError,
    string_of_compiler_error,
} from './compiler_errors';
import { reg_name_to_id } from './reg_name_to_id';

export const compile_riscv = bytecode_of_string.bind(undefined, [
    ...core_macros,
    ...pseudo_instructions,
]);

export {
    CompilerError,
    DefMacroExpr,
    pseudo_instructions,
    core_macros,
    string_of_compiler_error,
    string_of_def_macro,
    reg_name_to_id,
    parser as riscv_parser,
};
