/**
 * Idea for parsing:
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

import { CORE_MACROS } from './core_macros';
import { bytecode_of_string } from './lib_macro';
import { PSEUDO } from './pseudo_macros';

export * from './core_macros';
export * from './pseudo_macros';
export * from './lib_macro';
export * from './guards';
export * from './parser';

export const compile_riscv = bytecode_of_string.bind(null, [
    ...CORE_MACROS,
    ...PSEUDO,
]);
