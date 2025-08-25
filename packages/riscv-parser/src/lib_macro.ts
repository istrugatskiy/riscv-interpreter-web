import {
    CompileError,
    MacroExpr,
    parse_file,
    RiscvIR,
    string_of_macro,
} from './parser';
import { abi_map } from './register_abis';

/**
 * Note that multi-line macros (with several bytecode instructions) will set the pc
 * to the pc of the last instruction only. So if there was a beq followed by addi's,
 * the beq would be meaningless. If there were multipl adds, pc would only go up by 4.
 */
export const def_macro = <T>(
    name: string,
    args: number,
    guard: (
        args: string[],
        label_context: Map<string, number>
    ) => T | undefined,
    expander: (args: T, label_context: Map<string, number>) => Instruction[]
) => {
    return {
        name,
        args,
        guard,
        expander: (args: string[], label_context: Map<string, number>) => {
            const expander_args = guard(args, label_context);
            if (expander_args === undefined)
                throw new Error('Unsatisfied guard clause');
            return expander(expander_args, label_context);
        },
    };
};

export const expand_code = (
    { labels, code_lines }: RiscvIR,
    macros: ReturnType<typeof def_macro>[]
): Program | CompileError[] => {
    const first_valid_macro = (expr: MacroExpr) =>
        macros.find(
            ({ name, args, guard }) =>
                expr.name === name &&
                expr.args.length == args &&
                guard(expr.args, labels) !== undefined
        )?.expander;
    const instructions_with_errors = code_lines.map(
        (expr): CompileError | Program[0] => {
            const { args, code_line, string_rep } = expr;
            const macro = first_valid_macro(expr);
            if (macro === undefined) {
                return {
                    message: `** (UnboundMacroError) **
Unbound expression @ line ${code_line.toString()}!
Macro expression: ${string_rep}
Interpreted as: ${string_of_macro(expr)}
Hint: You probably used an unsupported (or misspelled) instruction.`,
                    line: code_line,
                };
            }
            return {
                instructions: macro(args, labels),
                string_rep,
                line_no: code_line,
            };
        }
    );
    const errors = instructions_with_errors.filter(
        (inst): inst is CompileError => 'message' in inst
    );
    if (errors.length !== 0) return errors;
    return instructions_with_errors.filter(
        (inst): inst is Program[0] => !('message' in inst)
    );
};

export const bytecode_of_string = (
    macros: ReturnType<typeof def_macro>[],
    code: string
) => {
    const ir = parse_file(code);
    // Return compile errors separately.
    // I know this check is a bit scuffed...
    if (Array.isArray(ir)) {
        return ir;
    }
    return expand_code(ir, macros);
};
/** Returns the list if it is valid, otherwise returns undefined if any element of list is undefined. */
export const valid_list = <T extends unknown[]>(
    list: T
): undefined | { [P in keyof T]: T[P] & {} } =>
    list.includes(undefined) ? undefined : (list as any);

export const register = (
    reg: string | undefined
): IntRange<0, 32> | undefined =>
    reg === undefined ? undefined : abi_map.get(reg.toLowerCase());

export const immediate = (
    imm: string | undefined,
    min: bigint,
    max: bigint
): bigint | undefined => {
    if (imm === undefined) return undefined;
    // This function is going to be fun to mess up (:
    imm = imm.toLowerCase();
    if (imm === '') return undefined;
    let value: bigint | undefined;
    try {
        if (imm.startsWith('-0b') || imm.startsWith('-0x')) {
            value = -BigInt(imm.substring(1));
        } else if (/^(-?0[0-9])/.test(imm)) {
            if (imm.startsWith('-0')) {
                value = -BigInt(`0o${imm.substring(2)}`);
            } else {
                value = BigInt(`0o${imm.substring(1)}`);
            }
        } else {
            value = BigInt(imm);
        }
    } catch {}
    if (value !== undefined) {
        // Technically not complete... but who cares.
        // We can go as high as an unsigned 64 bit int, or as low as an unsigned one.
        // I think...
        if (value > 2n ** 64n - 1n || value < -(2n ** 63n)) {
            return undefined;
        }
        value = BigInt.asIntN(64, value);
    }
    if (value !== undefined && (value < min || value > max)) {
        return undefined;
    }
    return value;
};

export const immediate_or_label = (
    imm_label: string | undefined,
    min: bigint,
    max: bigint,
    label_table: Map<string, number>
): bigint | undefined => {
    // TODO: https://michaeljclark.github.io/asm.html
    // implement relative addressing, ie [number]b, [number]f,
    // for example: 10b, 10 instructions back (pc = pc - 10 * 4),
    // 12f, 12 instructions forward (pc = pc + 12 * 4)
    // Also add +, - offsets, so label + 12, or label - 10...
    if (imm_label === undefined) return undefined;
    imm_label = imm_label.replaceAll(' ', '');
    let added_offset = 0n;
    const [label_str, sign, offset] = imm_label.split(/(\+|-)/);
    if (label_str !== undefined && sign !== undefined && offset !== undefined) {
        added_offset = immediate(offset, 0n, 2n ** 64n - 1n) ?? 0n;
        if (sign === '-') {
            added_offset *= -1n;
        }
        imm_label = label_str;
    }
    if (added_offset % 4n !== 0n) {
        return undefined;
    }
    const label = label_table.get(imm_label);
    if (label !== undefined) {
        return (BigInt(label) - 1n) * 4n + added_offset;
    }
    const imm = immediate(imm_label, min, max);
    if ((imm ?? 0n) % 4n !== 0n) {
        return undefined;
    }
    return imm;
};

export const imm_register = (
    imm_register: string | undefined,
    min: bigint,
    max: bigint
): [bigint, Register] | undefined => {
    if (imm_register === undefined) return undefined;
    const [left, ...right] = imm_register.replaceAll(' ', '').split('(');
    if (left === undefined || right.length !== 1) {
        return undefined;
    }
    const [reg] = right;
    if (!reg?.endsWith(')')) {
        return undefined;
    }

    return valid_list([
        immediate(left, min, max),
        register(reg.replace(')', '')),
    ]);
};
