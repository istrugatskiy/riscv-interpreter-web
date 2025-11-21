/**
 * This module includes utilities for parsing string arguments
 */
import { SyntaxNode } from '@lezer/common';
import { reg_name_to_id } from './reg_name_to_id';
import { string_of_def_macro } from './lib_macro';
import { get_node_text } from './ast/ast_utils';
import { CompilerError } from './compiler_errors';

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
        return BigInt(label) * 4n + added_offset;
    }
    const imm = immediate(imm_label, min, max);
    if ((imm ?? 0n) % 4n !== 0n) {
        return undefined;
    }
    return imm;
};

export const register = (
    reg: string | undefined
): IntRange<0, 32> | undefined =>
    reg === undefined ? undefined : reg_name_to_id.get(reg.toLowerCase());

/**
 * Parse an argument into the representation used by expanders.
 */
export const parse_arg = ({
    type,
    source,
    argument,
    label_context,
    macro_expr,
}: {
    type: ArgumentType;
    source: string;
    argument: SyntaxNode;
    label_context: Map<string, number>;
    macro_expr: {
        name: string;
        arglist_type: ArgumentType[];
    };
}): ValidArgumentShapes[keyof ValidArgumentShapes] | CompilerError => {
    const arg_text = get_node_text(source, argument);

    const partial_error_msg = {
        error_type: 'UnexpectedArgument',
        detailed_error_msg: `${string_of_def_macro(macro_expr)} expects "${arg_text}" to satisfy ${type.name}`,
        from: argument.from,
        to: argument.to,
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
            2n ** 63n - 1n,
            label_context
        );
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (type.name === 'Register') {
        argument_val = register(arg_text);
    }

    if (argument_val === undefined) {
        if (argument.type.name === 'LabelName') {
            return {
                ...partial_error_msg,
                hint: `The label "${arg_text}" does not exist.`,
            };
        }
        return {
            ...partial_error_msg,
            hint: `The interpreter may refuse to parse ambiguous immediates you may think are in range.`,
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
