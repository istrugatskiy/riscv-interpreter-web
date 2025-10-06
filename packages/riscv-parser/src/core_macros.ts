import {
    bytecode_of_string,
    def_macro,
    imm_reg_type,
    imm_type,
    label_type,
    reg_type,
} from './lib_macro';

export const r_names = [
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
] as const;
const r_type = r_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, reg_type] as const,
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

// TODO: fix bad shift types (you can't shift by more than 63!!!)
export const i_names = [
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
] as const;
const i_type = i_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, imm_type(-2048n, 2047n)] as const,
        ([rd, rs1, imm]) => [{ name, rd, rs1, imm }]
    )
);

export const mem_names = [
    'lb',
    'lh',
    'lw',
    'ld',
    'sb',
    'sh',
    'sw',
    'sd',
] as const;
const mem_type = mem_names.map((name) =>
    def_macro(
        name,
        [reg_type, imm_reg_type(-2048n, 2047n)] as const,
        ([rd, [imm, rs1]]) => [{ name, rd, rs1, imm }]
    )
);

export const u_names = ['lui', 'auipc'] as const;
const u_type = u_names.map((name) =>
    def_macro(
        name,
        [reg_type, imm_type(0n, 0xfffffn)] as const,
        ([rd, imm]) => [{ name, rd, imm }]
    )
);

export const b_names = ['beq', 'bne', 'blt', 'bltu', 'bge', 'bgeu'] as const;
const b_type = b_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => [{ name, rs1, rs2, imm }]
    )
);

const j_type = [
    def_macro('jal', [reg_type, label_type] as const, ([rd, imm]) => [
        { name: 'jal', rd, imm },
    ]),
    def_macro(
        'jalr',
        [reg_type, reg_type, imm_type(-2048n, 2047n)] as const,
        ([rd, rs1, imm]) => [{ name: 'jalr', rd, rs1, imm }]
    ),
];

export const m_names = [
    'mul',
    'mulh',
    'mulhu',
    'mulhsu',
    'mulw',
    'div',
    'divu',
    'rem',
    'remu',
    'divw',
    'divuw',
    'remw',
    'remuw',
] as const;
const m_type = m_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, reg_type] as const,
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

export const core_macros = [
    r_type,
    i_type,
    mem_type,
    u_type,
    b_type,
    j_type,
    m_type,
].flat();

export const core = bytecode_of_string.bind(undefined, core_macros);

// Oh wow, its template tag literal o'clock. :)))))))))
// Thx stackoverflow: https://stackoverflow.com/questions/68152638/what-is-the-default-tag-function-for-template-literals
export const coret = (
    parts: TemplateStringsArray,
    ...values: (number | string | bigint)[]
): Instruction[] => {
    const prog = core(
        parts
            .flatMap((part, i) =>
                i < values.length
                    ? [
                          part,
                          String(
                              Number.isInteger(values[i])
                                  ? `x${(values[i] as number).toString()}`
                                  : values[i]
                          ),
                      ]
                    : [part]
            )
            .join('')
    );

    if (prog.every((el) => 'instructions' in el)) {
        return prog.flatMap(({ instructions }) => instructions);
    }
    throw new Error(
        `Failed to expand macro code segment!
The following errors occurred:
${JSON.stringify(prog, null, 4)}`
    );
};
