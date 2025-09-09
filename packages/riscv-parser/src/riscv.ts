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

import {
    b_names,
    core_macros,
    i_names,
    m_names,
    mem_names,
    r_names,
    u_names,
} from './core_macros';
import { bytecode_of_string } from './lib_macro';
import { pseudo_instructions } from './pseudo_macros';

export * from './core_macros';
export * from './pseudo_macros';
export * from './lib_macro';
export * from './parser';

export const compile_riscv = bytecode_of_string.bind(undefined, [
    ...core_macros,
    ...pseudo_instructions,
]);

const belongs_to_array = <TValue>(
    value: unknown,
    allowed: readonly TValue[]
): value is TValue => (allowed as readonly unknown[]).includes(value);

export const is_r_type = (inst: Instruction): inst is RegisterType =>
    belongs_to_array(inst.name, r_names);
export const is_i_type = (inst: Instruction): inst is ImmediateType =>
    belongs_to_array(inst.name, i_names);
export const is_mem_type = (inst: Instruction): inst is MemoryType =>
    belongs_to_array(inst.name, mem_names);
export const is_u_type = (inst: Instruction): inst is UpperImmediateType =>
    belongs_to_array(inst.name, u_names);
export const is_b_type = (inst: Instruction): inst is BranchType =>
    belongs_to_array(inst.name, b_names);
export const is_j_type = (inst: Instruction): inst is JumpType =>
    belongs_to_array(inst.name, ['jal', 'jalr']);
export const is_m_type = (inst: Instruction): inst is MultiplicationType =>
    belongs_to_array(inst.name, m_names);
