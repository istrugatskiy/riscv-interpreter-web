import {
    def_macro,
    expand_code,
    imm_register,
    immediate,
    immediate_or_label,
    register,
    valid_list,
} from './lib_macro';
import { parse_file } from './parser';

const R_TYPE = (
    [
        'and',
        'add',
        'sub',
        'or',
        'xor',
        'slt',
        'sltu',
        'sll',
        'sra',
        'srl',
        'addw',
        'sllw',
        'srlw',
        'subw',
        'sraw',
    ] as const
).map((name) =>
    def_macro(
        name,
        3,
        ([rd, rs1, rs2]) =>
            valid_list([register(rd), register(rs1), register(rs2)] as const),
        ([rd, rs1, rs2]) => [
            {
                name,
                rd,
                rs1,
                rs2,
            },
        ]
    )
);

const I_TYPE = (
    [
        'addi',
        'andi',
        'ori',
        'xori',
        'slti',
        'sltiu',
        'addiw',
        'slli',
        'slliw',
        'srli',
        'srliw',
        'srai',
        'sraiw',
    ] as const
).map((name) =>
    def_macro(
        name,
        3,
        ([rd, rs1, imm]) =>
            valid_list([
                register(rd),
                register(rs1),
                immediate(imm, -2048n, 2047n),
            ] as const),
        ([rd, rs1, imm]) => [{ name, rd, rs1, imm }]
    )
);

const MEM_TYPE = (
    ['lb', 'lh', 'lw', 'ld', 'sb', 'sh', 'sw', 'sd'] as const
).map((name) =>
    def_macro(
        name,
        2,
        ([rd, imm_reg]) =>
            valid_list([
                register(rd),
                imm_register(imm_reg, -2048n, 2047n),
            ] as const),
        ([rd, [imm, rs1]]) => [{ name, rd, rs1, imm }]
    )
);

const U_TYPE = (['lui', 'auipc'] as const).map((name) =>
    def_macro(
        name,
        2,
        ([rd, imm]) =>
            valid_list([register(rd), immediate(imm, 0n, 0xfffffn)] as const),
        ([rd, imm]) => [{ name, rd, imm }]
    )
);

const B_TYPE = (['beq', 'bne', 'blt', 'bltu', 'bge', 'bgeu'] as const).map(
    (name) =>
        def_macro(
            name,
            3,
            ([rs1, rs2, imm], labels) =>
                valid_list([
                    register(rs1),
                    register(rs2),
                    immediate_or_label(imm, 0n, 2n ** 64n, labels),
                ] as const),
            ([rs1, rs2, imm]) => [{ name, rs1, rs2, imm }]
        )
);

const J_TYPE = [
    def_macro(
        'jal',
        2,
        ([rd, imm], labels) =>
            valid_list([
                register(rd),
                immediate_or_label(imm, 0n, 2n ** 64n, labels),
            ] as const),
        ([rd, imm]) => [{ name: 'jal', rd, imm }]
    ),
    def_macro(
        'jalr',
        3,
        ([rd, rs1, imm], label_context) =>
            valid_list([
                register(rd),
                register(rs1),
                immediate_or_label(imm, 0n, 2n ** 64n, label_context),
            ] as const),
        ([rd, rs1, imm]) => [{ name: 'jalr', rd, rs1, imm }]
    ),
];

export const CORE_MACROS = [
    R_TYPE,
    I_TYPE,
    MEM_TYPE,
    U_TYPE,
    B_TYPE,
    J_TYPE,
].flat();

export const core = (code: string) => {
    const parsed = parse_file(code);
    if (Array.isArray(parsed)) {
        return parsed;
    }
    return expand_code(parsed, CORE_MACROS);
};
