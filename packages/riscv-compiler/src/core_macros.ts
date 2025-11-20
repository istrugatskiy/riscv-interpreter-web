import { imm_reg_type, imm_type, label_type, reg_type } from './arguments';
import { bytecode_of_string, def_macro } from './lib_macro';

const r_names = [
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
export const r_type = r_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, reg_type] as const,
        ([rd, rs1, rs2]) => [
            {
                name,
                rd,
                rs1,
                rs2,
                inst_type: 0,
            },
        ]
    )
);

// TODO: fix bad shift types (you can't shift by more than 63!!!)
const i_names = [
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
export const i_type = i_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, imm_type(-2048n, 2047n)] as const,
        ([rd, rs1, imm]) => [{ name, rd, rs1, imm, inst_type: 1 }]
    )
);

const mem_names = ['lb', 'lh', 'lw', 'ld', 'sb', 'sh', 'sw', 'sd'] as const;
export const mem_type = mem_names.map((name) =>
    def_macro(
        name,
        [reg_type, imm_reg_type(-2048n, 2047n)] as const,
        ([rd, [imm, rs1]]) => [{ name, rd, rs1, imm, inst_type: 2 }]
    )
);

const u_names = ['lui', 'auipc'] as const;
export const u_type = u_names.map((name) =>
    def_macro(
        name,
        [reg_type, imm_type(0n, 0xfffffn)] as const,
        ([rd, imm]) => [{ name, rd, imm, inst_type: 3 }]
    )
);

const b_names = ['beq', 'bne', 'blt', 'bltu', 'bge', 'bgeu'] as const;
export const b_type = b_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => [{ name, rs1, rs2, imm, inst_type: 4 }]
    )
);

export const j_type = [
    def_macro('jal', [reg_type, label_type] as const, ([rd, imm]) => [
        { name: 'jal', rd, imm, inst_type: 5 },
    ]),
    def_macro(
        'jalr',
        [reg_type, reg_type, imm_type(-2048n, 2047n)] as const,
        ([rd, rs1, imm]) => [{ name: 'jalr', rd, rs1, imm, inst_type: 5 }]
    ),
];

const m_names = [
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
export const mul_type = m_names.map((name) =>
    def_macro(
        name,
        [reg_type, reg_type, reg_type] as const,
        ([rd, rs1, rs2]) => [
            {
                name,
                rd,
                rs1,
                rs2,
                inst_type: 6,
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
    mul_type,
].flat();

// Oh wow, its template tag literal o'clock. :)))))))))
// Thx stackoverflow: https://stackoverflow.com/questions/68152638/what-is-the-default-tag-function-for-template-literals
export const core_compiler = (
    parts: TemplateStringsArray,
    ...values: (number | string | bigint)[]
): Instruction[] => {
    const prog = bytecode_of_string(
        core_macros,
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
