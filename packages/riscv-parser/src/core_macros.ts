import { reg_label, reg_reg_imm, reg_reg_label, reg_reg_reg } from './guards';
import {
    bytecode_of_string,
    def_macro,
    imm_register,
    immediate,
    register,
    valid_list,
} from './lib_macro';

export const R_NAMES = [
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
const R_TYPE = R_NAMES.map((name) =>
    def_macro(name, 3, reg_reg_reg, ([rd, rs1, rs2]) => [
        {
            name,
            rd,
            rs1,
            rs2,
        },
    ])
);

export const I_NAMES = [
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
const I_TYPE = I_NAMES.map((name) =>
    def_macro(name, 3, reg_reg_imm, ([rd, rs1, imm]) => [
        { name, rd, rs1, imm },
    ])
);

export const MEM_NAMES = [
    'lb',
    'lh',
    'lw',
    'ld',
    'sb',
    'sh',
    'sw',
    'sd',
] as const;
const MEM_TYPE = MEM_NAMES.map((name) =>
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

export const U_NAMES = ['lui', 'auipc'] as const;
const U_TYPE = U_NAMES.map((name) =>
    def_macro(
        name,
        2,
        ([rd, imm]) =>
            valid_list([register(rd), immediate(imm, 0n, 0xfffffn)] as const),
        ([rd, imm]) => [{ name, rd, imm }]
    )
);

export const B_NAMES = ['beq', 'bne', 'blt', 'bltu', 'bge', 'bgeu'] as const;
const B_TYPE = B_NAMES.map((name) =>
    def_macro(name, 3, reg_reg_label, ([rs1, rs2, imm]) => [
        { name, rs1, rs2, imm },
    ])
);

const J_TYPE = [
    def_macro('jal', 2, reg_label, ([rd, imm]) => [{ name: 'jal', rd, imm }]),
    def_macro('jalr', 3, reg_reg_label, ([rd, rs1, imm]) => [
        { name: 'jalr', rd, rs1, imm },
    ]),
];

export const CORE_MACROS = [
    R_TYPE,
    I_TYPE,
    MEM_TYPE,
    U_TYPE,
    B_TYPE,
    J_TYPE,
].flat();

export const core = bytecode_of_string.bind(null, CORE_MACROS);

// Oh wow, its template tag literal o'clock. :)))))))))
// Thx stackoverflow: https://stackoverflow.com/questions/68152638/what-is-the-default-tag-function-for-template-literals
export const coret = <TValues extends unknown[]>(
    parts: TemplateStringsArray,
    ...values: TValues
): instruction[] => {
    const prog = core(
        parts
            .flatMap((part, i) =>
                i < values.length
                    ? [
                          part,
                          String(
                              Number.isInteger(values[i])
                                  ? `x${values[i]}`
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
