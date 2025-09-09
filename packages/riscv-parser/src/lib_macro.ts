import { parse_file, RiscvIR, string_of_macro } from './parser';
import { abi_map } from './register_abis';

type ArgumentType =
    | { name: 'imm_register'; min: bigint; max: bigint }
    | { name: 'label' }
    | { name: 'imm'; min: bigint; max: bigint }
    | { name: 'reg' };

// These serve as quickhand ways of defining the type of an argument for a macro.
// They simply feel much nicer than the alternative.
export const reg_type = { name: 'reg' } as const;
export const label_type = { name: 'label' } as const;
export const imm_type = (min: bigint, max: bigint) =>
    ({
        name: 'imm',
        min,
        max,
    }) as { name: 'imm'; min: bigint; max: bigint };
export const imm_reg_type = (min: bigint, max: bigint) =>
    ({
        name: 'imm_register',
        min,
        max,
    }) as { name: 'imm_register'; min: bigint; max: bigint };

type ValidArgumentShapes = {
    imm_register: [bigint, Register];
    label: bigint;
    imm: bigint;
    reg: Register;
};
type ValidArgumentsOf<Arg extends ArgumentType[]> = {
    [Index in keyof Arg]: ValidArgumentShapes[Arg[Index]['name']];
};

export type InterpreterError = {
    error_type:
        | 'UnboundMacro'
        | 'Parser'
        | 'UnexpectedArgumentCount'
        | 'UnexpectedArgument'
        | 'AmbiguousMacroExpr';
    detailed_error_msg: string;
    line: number;
    hint: string;
};

export const mk_error_string = ({
    error_type,
    detailed_error_msg,
    line,
    hint,
}: InterpreterError) =>
    `** (${error_type}Error) **
${detailed_error_msg} @ line ${line.toString()}!
Hint: ${hint}`;

const string_of_argument_type = (argument: ArgumentType) =>
    'min' in argument
        ? `${argument.name}(${argument.min.toString(16)}, ${argument.max.toString(16)})`
        : argument.name;
const string_of_def_macro = ({
    name,
    arglist_type,
}: {
    name: string;
    arglist_type: ArgumentType[];
}) =>
    `${name}/${arglist_type.length.toString()} [${arglist_type.map(string_of_argument_type).join(', ')}]`;

/**
 * Note that multi-line macros (with several bytecode instructions) will set the pc
 * to the pc of the last instruction only. So if there was a beq followed by addi's,
 * the beq would be meaningless. If there were multipl adds, pc would only go up by 4.
 */
export const def_macro = <ArgumentList extends ArgumentType[]>(
    name: string,
    arglist_type: ArgumentList,
    expand: (args: ValidArgumentsOf<ArgumentList>) => Instruction[]
) => {
    return {
        name,
        arglist_type,
        try_expand: (
            argument_list: string[],
            label_context: Map<string, number>,
            line: number
        ): Instruction[] | InterpreterError => {
            if (argument_list.length !== arglist_type.length) {
                return {
                    error_type: 'UnexpectedArgumentCount',
                    detailed_error_msg: `${string_of_def_macro({ name, arglist_type })} expects ${arglist_type.length.toString()} arguments but got ${argument_list.length.toString()}`,
                    line,
                    hint: `Make sure you have ${arglist_type.length.toString()} arguments.`,
                };
            }
            const mapped_args = argument_list.map((arg, arg_type_idx) => {
                // clearly non-null value...
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const arg_type = arglist_type[arg_type_idx]!;
                if (arg_type.name === 'imm') {
                    return immediate(arg, arg_type.min, arg_type.max);
                } else if (arg_type.name === 'imm_register') {
                    return imm_register(arg, arg_type.min, arg_type.max);
                } else if (arg_type.name === 'label') {
                    return immediate_or_label(
                        arg,
                        0n,
                        2n ** 63n - 1n,
                        label_context
                    );
                } else {
                    return register(arg);
                }
            });

            if (mapped_args.every((arg) => arg !== undefined)) {
                return expand(mapped_args as ValidArgumentsOf<ArgumentList>);
            }

            const first_bad_arg = mapped_args.findIndex(
                (arg) => arg === undefined
            );
            const bad_arg_type = string_of_argument_type(
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                arglist_type[first_bad_arg]!
            );
            return {
                error_type: 'UnexpectedArgument',
                detailed_error_msg: `${string_of_def_macro({ name, arglist_type })} expects the argument at position ${first_bad_arg.toString()} to satisfy ${bad_arg_type}`,
                line,
                hint: `Your argument is currently "${argument_list[first_bad_arg] ?? ''}," however the interpreter expects ${bad_arg_type}.
Note: the interpreter may refuse to parse ambiguous immediates you may think are in range.`,
            };
        },
    };
};

export const expand_code = (
    { labels, code_lines }: RiscvIR,
    macros: ReturnType<typeof def_macro>[]
): Program | InterpreterError[] => {
    const instructions_with_errors = code_lines.map(
        (expr): InterpreterError | Program[0] => {
            const { args, code_line, string_rep } = expr;

            const candidate_macros = macros.filter(
                ({ name }) => expr.name === name
            );
            if (candidate_macros.length === 0) {
                // Find similar macros using fuzzy searching:
                // See: https://en.wikipedia.org/wiki/Levenshtein_distance#Iterative_with_two_matrix_rows
                const str_distance = (s: string, t: string) => {
                    const m = s.length,
                        n = t.length;
                    let v0: number[] = [],
                        v1: number[] = [];

                    for (let i = 0; i <= n; i++) {
                        v0[i] = i;
                    }

                    for (let i = 0; i < m; i++) {
                        v1[0] = i + 1;
                        for (let j = 0; j < n; j++) {
                            const deletion_cost = (v0[j + 1] ?? 0) + 1;
                            const insertion_cost = (v1[j] ?? 0) + 1;
                            const substition_cost =
                                s[i] === t[j] ? (v0[j] ?? 0) : (v0[j] ?? 0) + 1;
                            v1[j + 1] = Math.min(
                                deletion_cost,
                                insertion_cost,
                                substition_cost
                            );
                        }

                        const temp_v0 = v0;
                        v0 = v1;
                        v1 = temp_v0;
                    }

                    return v0[n] ?? 0;
                };

                const nearest_macros = macros
                    .toSorted(
                        (macro1, macro2) =>
                            str_distance(macro1.name, expr.name) -
                            str_distance(macro2.name, expr.name)
                    )
                    .slice(0, 3)
                    .map(string_of_def_macro)
                    .join('\n * ');
                return {
                    error_type: 'UnboundMacro',
                    detailed_error_msg: `No macro named ${expr.name}`,
                    line: code_line,
                    hint: `Did you mean one of the following:\n * ${nearest_macros}`,
                };
            }

            const expandable_macros = candidate_macros.filter(
                (macro) =>
                    !('error_type' in macro.try_expand(args, labels, code_line))
            );

            if (expandable_macros.length > 1) {
                return {
                    error_type: 'AmbiguousMacroExpr',
                    detailed_error_msg: `${string_of_macro(expr)} can be interpreted multiple ways`,
                    line: code_line,
                    hint: `This is likely a bug in the interpreter. The following macro definitions accept your expresion:\n${expandable_macros.map(string_of_def_macro).join('\n * ')}`,
                };
            }

            const macro = expandable_macros[0];
            if (macro === undefined) {
                return candidate_macros[0]?.try_expand(
                    args,
                    labels,
                    code_line
                ) as InterpreterError;
            }

            return {
                instructions: macro.try_expand(
                    args,
                    labels,
                    code_line
                ) as Instruction[],
                string_rep,
                line_no: code_line,
            };
        }
    );

    const errors = instructions_with_errors.filter(
        (inst): inst is InterpreterError => 'error_type' in inst
    );
    if (errors.length !== 0) return errors;
    return instructions_with_errors as Program;
};

export const bytecode_of_string = (
    macros: ReturnType<typeof def_macro>[],
    code: string
) => {
    const ir = parse_file(code);
    // This check is a bit scuffed...
    if (Array.isArray(ir)) {
        return ir;
    }
    return expand_code(ir, macros);
};
/** Returns the list if it is valid, otherwise returns undefined if any element of list is undefined. */
const valid_list = <T extends unknown[]>(list: T) =>
    list.includes(undefined)
        ? undefined
        : (list as { [P in keyof T]: T[P] & {} });

const register = (reg: string | undefined): IntRange<0, 32> | undefined =>
    reg === undefined ? undefined : abi_map.get(reg.toLowerCase());

// This is only exported for internal testing
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
    } catch {
        void 0;
    }
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

const immediate_or_label = (
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

const imm_register = (
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
