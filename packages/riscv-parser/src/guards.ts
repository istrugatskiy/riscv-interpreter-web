import {
    valid_list,
    register,
    immediate_or_label,
    immediate,
} from './lib_macro';

export type guard<T> = (
    args: string[],
    labels: Map<string, number>
) => T | undefined;
export const label = (
    imm: string | undefined,
    label_table: Map<string, number>
) => immediate_or_label(imm, 0n, 2n ** 63n - 1n, label_table);

export const reg_label: guard<[number, bigint]> = ([rs, lab], label_table) =>
    valid_list([register(rs), label(lab, label_table)] as const);

export const reg_reg_label: guard<[number, number, bigint]> = (
    [rd, rs1, lab],
    label_table
) =>
    valid_list([register(rd), register(rs1), label(lab, label_table)] as const);

export const reg_imm: guard<[number, bigint]> = ([rd, imm]) =>
    valid_list([register(rd), immediate(imm, -2048n, 2047n)] as const);

export const reg_reg_imm: guard<[number, number, bigint]> = ([rd, rs1, imm]) =>
    valid_list([
        register(rd),
        register(rs1),
        immediate(imm, -2048n, 2047n),
    ] as const);

export const reg_reg: guard<[number, number]> = ([rd, rs1]) =>
    valid_list([register(rd), register(rs1)]);

export const reg_reg_reg: guard<[number, number, number]> = ([rd, rs1, rs2]) =>
    valid_list([register(rd), register(rs1), register(rs2)] as const);
