/**
 * This module includes utilities for parsing string arguments
 */
import { SyntaxNode } from '@lezer/common';
import { reg_name_to_id } from './reg_name_to_id';
import { string_of_def_macro } from './lib_macro';
import { get_node_text } from './ast/ast_utils';
import { CompilerError, coords_of_index } from './compiler_errors';
import { str_distance } from './string_distance';

export type ValidArgumentShapes = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ImmRegister: [bigint, Register];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    LabelName: bigint;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Immediate: bigint;
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Register: Register;
};

export type ArgumentType =
    | { name: 'ImmRegister'; min: bigint; max: bigint }
    | { name: 'LabelName' }
    | { name: 'Immediate'; min: bigint; max: bigint }
    | { name: 'Register' };

// These serve as quickhand ways of defining the type of an argument for a macro.
// These functions are nicer than writing out the full value and type every time.
export const reg_type = { name: 'Register' } as const;

export const label_type = { name: 'LabelName' } as const;

export const imm_type = (min: bigint, max: bigint) =>
    ({
        name: 'Immediate',
        min,
        max,
    }) as { name: 'Immediate'; min: bigint; max: bigint };

export const imm_reg_type = (min: bigint, max: bigint) =>
    ({
        name: 'ImmRegister',
        min,
        max,
    }) as { name: 'ImmRegister'; min: bigint; max: bigint };

const num_of_string = (imm: string) => {
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
    return value;
};

export const immediate = (
    imm: string,
    min: bigint,
    max: bigint
): bigint | undefined => {
    let value = num_of_string(imm);
    // This function is going to be fun to mess up (:
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
    imm_label: string,
    min: bigint,
    max: bigint,
    label_context: readonly [
        Map<string, number>,
        Map<IntRange<0, 10>, number[]>,
    ],
    macro_idx: number
): bigint | undefined => {
    // TODO: Implement faithful location counter for labels.
    const [label_table, local_labels] = label_context;
    imm_label = imm_label.replaceAll(' ', '');
    if (/^[0-9](f|b)$/.test(imm_label)) {
        const label_value = Number(imm_label.charAt(0)) as IntRange<0, 10>;
        const is_forward = (imm_label.charAt(1) as 'f' | 'b') === 'f';

        const candidate_jumps = local_labels.get(label_value);
        if (candidate_jumps === undefined) return undefined;

        // Probably could simplify the ternary somehow and make this a find expression but that would require let expressions as opposed to const...
        const where_to_jump = candidate_jumps.filter((candidate_offset) =>
            is_forward
                ? // Filter out all preceeding labels if this is a forward jump.
                  candidate_offset > macro_idx
                : candidate_offset <= macro_idx
        );

        // Since where_to_jump is sorted, we just need to check the first and last element
        const jump_location = where_to_jump.at(is_forward ? 0 : -1);
        return jump_location !== undefined
            ? BigInt(jump_location) * 4n
            : undefined;
    }
    const label = label_table.get(imm_label);
    if (label !== undefined) {
        return BigInt(label) * 4n;
    }

    // This is the correct behaviour of jump instructions in RISC-V assembly... I think
    // They are converted to absolute jumps
    const imm = immediate(imm_label, min, max);
    if ((imm ?? 0n) % 4n !== 0n) {
        return undefined;
    }
    return imm;
};

export const register = (reg: string): IntRange<0, 32> | undefined =>
    reg_name_to_id.get(reg.toLowerCase());

/**
 * Parse an argument into the representation used by expanders.
 */
export const parse_arg = ({
    type,
    source,
    argument,
    label_context,
    macro_expr,
    macro_idx,
}: {
    type: ArgumentType;
    source: string;
    argument: SyntaxNode;
    label_context: readonly [
        Map<string, number>,
        Map<IntRange<0, 10>, number[]>,
    ];
    macro_expr: {
        name: string;
        arglist_type: ArgumentType[];
    };
    macro_idx: number;
}): ValidArgumentShapes[keyof ValidArgumentShapes] | CompilerError => {
    const arg_text = get_node_text(source, argument);

    const [line, col] = coords_of_index(source, argument.from);
    const partial_error_msg = {
        error_type: 'UnexpectedArgument',
        detailed_error_msg: `${string_of_def_macro(macro_expr)} expects "${arg_text}" to satisfy ${type.name}`,
        from: argument.from,
        to: argument.to,
        line,
        col,
    } as const;

    if (
        type.name !== argument.type.name &&
        !(type.name === 'LabelName' && argument.type.name === 'Immediate')
    ) {
        return {
            ...partial_error_msg,
            hint: `Your argument is currently of type ${argument.type.name} however the interpreter expects ${type.name}.`,
        };
    }

    let argument_val:
        | ValidArgumentShapes[keyof ValidArgumentShapes]
        | undefined = undefined;

    if (type.name === 'Immediate') {
        argument_val = immediate(arg_text, type.min, type.max);
    } else if (type.name === 'ImmRegister') {
        const imm = immediate(
            get_node_text(source, argument.getChild('Immediate')),
            type.min,
            type.max
        );
        const reg = register(
            get_node_text(source, argument.getChild('Register'))
        );
        argument_val =
            imm !== undefined && reg != undefined ? [imm, reg] : undefined;
    } else if (type.name === 'LabelName') {
        argument_val = immediate_or_label(
            arg_text,
            0n,
            2n ** 12n - 1n,
            label_context,
            macro_idx
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (type.name === 'Register') {
        argument_val = register(arg_text);
    }

    if (argument_val === undefined) {
        if (argument.type.name === 'LabelName') {
            const nearest_labels = Array.from(label_context[0].keys())
                .toSorted(
                    (label1, label2) =>
                        str_distance(label1, arg_text) -
                        str_distance(label2, arg_text)
                )
                .slice(0, 3)
                .join('\n * ');
            return {
                ...partial_error_msg,
                hint: `The label "${arg_text}" does not exist. Did you mean one of the following?\n * ${nearest_labels}`,
            };
        }
        const raw_num_value = num_of_string(
            argument.type.name === 'ImmRegister'
                ? get_node_text(source, argument.getChild('Immediate'))
                : arg_text
        );
        if (raw_num_value === undefined) {
            return {
                ...partial_error_msg,
                hint: `A syntax error occurred while parsing the immediate.`,
            };
        }

        return {
            ...partial_error_msg,
            hint: `The immediate was converted to ${raw_num_value.toString()} which is out of range.`,
        };
    }

    return argument_val;
};

/**
 * Stringify an argument type.
 */
export const string_of_argument_type = (argument: ArgumentType) =>
    'min' in argument
        ? `${argument.name}(${argument.min.toString(16)}, ${argument.max.toString(16)})`
        : argument.name;
