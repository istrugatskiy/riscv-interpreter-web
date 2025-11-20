/**
 * Idea for parsing (old):
 *  - Start by splitting into lines that contain some code and removing others.
 *    We store a normalized version of that line (i.e. no spaces, or comments)
 *    as well as the original with its line number (for the log).
 *  - For each such line, determine whether it is an instruction or label.
 *  - For each instruction parse it as an ❤️‍🔥elixir❤️‍🔥 function. So take for example:
 *    lw x1, 0(x2) => lw/2 [x1, 0(x2)]. No type checking or what-not is done. No pre-processing,
 *    beyond stripping spaces or splitting on commas should be done.
 *  - Collapse all labels from top to bottom into a map of label => next line
 *  - Now, recursively match (name, arg number, guard clause) and expand macros until we are left with a 2d array of instructions in:
 *    types.d.ts. Note, how each code line may or may not expand to multiple instructions, these
 *    should be part of the same sub-array, this is so each step in the interpreter <=> one code line step.
 */

import { core_macros } from './core_macros';
import {
    bytecode_of_string,
    type DefMacroExpr,
    type InterpreterError,
    mk_error_string,
    string_of_def_macro,
} from './lib_macro';
import { pseudo_instructions } from './pseudo_macros';
import { parser } from './ast/riscv';

export const compile_riscv = bytecode_of_string.bind(undefined, [
    ...core_macros,
    ...pseudo_instructions,
]);

export const is_r_type = (inst: Instruction) => inst.inst_type == 0;
export const is_i_type = (inst: Instruction) => inst.inst_type == 1;
export const is_mem_type = (inst: Instruction) => inst.inst_type == 2;
export const is_u_type = (inst: Instruction) => inst.inst_type == 3;
export const is_b_type = (inst: Instruction) => inst.inst_type == 4;
export const is_j_type = (inst: Instruction) => inst.inst_type == 5;
export const is_m_type = (inst: Instruction) => inst.inst_type == 6;

export {
    InterpreterError,
    DefMacroExpr,
    pseudo_instructions,
    core_macros,
    mk_error_string,
    string_of_def_macro,
    parser as riscv_parser,
};
