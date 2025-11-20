import { def_macro } from './lib_macro';
import { core_compiler } from './core_macros';
import { imm_reg_type, imm_type, label_type, reg_type } from './arguments';

export const pseudo_macros = [
    def_macro(
        'bgt',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => core_compiler`blt ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'bgtu',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => core_compiler`bltu ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'ble',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => core_compiler`bge ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'bleu',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => core_compiler`bgeu ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'beqz',
        [reg_type, label_type] as const,
        ([rd, imm]) => core_compiler`beq ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bnez',
        [reg_type, label_type] as const,
        ([rd, imm]) => core_compiler`bne ${rd}, zero, ${imm}`
    ),
    def_macro(
        'blez',
        [reg_type, label_type] as const,
        ([rd, imm]) => core_compiler`bge zero, ${rd}, ${imm}`
    ),
    def_macro(
        'bgez',
        [reg_type, label_type] as const,
        ([rd, imm]) => core_compiler`bge ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bltz',
        [reg_type, label_type] as const,
        ([rd, imm]) => core_compiler`blt ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bgtz',
        [reg_type, label_type] as const,
        ([rd, imm]) => core_compiler`blt zero, ${rd}, ${imm}`
    ),
    def_macro(
        'mv',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`addi ${rd}, ${rs}, 0`
    ),
    def_macro(
        'not',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`xori ${rd}, ${rs}, -1`
    ),
    def_macro(
        'neg',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`sub ${rd}, zero, ${rs}`
    ),
    def_macro(
        'negw',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`subw ${rd}, zero, ${rs}`
    ),
    def_macro(
        'sext.w',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`subw ${rd}, ${rs}, zero`
    ),
    def_macro(
        'seqz',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`sltiu ${rd}, ${rs}, 1`
    ),
    def_macro(
        'snez',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`sltu ${rd}, zero, ${rs}`
    ),
    def_macro(
        'sltz',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`slt ${rd}, ${rs}, zero`
    ),
    def_macro(
        'sgtz',
        [reg_type, reg_type] as const,
        ([rd, rs]) => core_compiler`slt ${rd}, zero, ${rs}`
    ),
    def_macro(
        'call',
        [label_type] as const,
        ([offset]) => core_compiler`jal ra, ${offset}`
    ),
    def_macro(
        'jalr',
        [reg_type, imm_reg_type(-2048n, 2047n)] as const,
        ([rd, [imm, rs1]]) => core_compiler`jalr ${rd}, ${rs1}, ${imm}`
    ),
    def_macro(
        'j',
        [label_type] as const,
        ([imm]) => core_compiler`jal zero, ${imm}`
    ),
    def_macro(
        'jr',
        [reg_type] as const,
        ([rs]) => core_compiler`jalr zero, ${rs}, 0`
    ),
    def_macro('ret', [], () => core_compiler`jalr zero, ra, 0`),
    // Additional jal/jalr variants:
    def_macro(
        'jal',
        [label_type] as const,
        ([imm]) => core_compiler`jal ra, ${imm}`
    ),
    def_macro(
        'jalr',
        [reg_type] as const,
        ([rs]) => core_compiler`jalr ra, ${rs}, 0`
    ),
    def_macro('nop', [], () => core_compiler`addi x0, x0, 0`),
    def_macro(
        'li',
        [reg_type, imm_type(-(2n ** 63n), 2n ** 63n - 1n)] as const,
        // Kinda cheating the system...
        ([rd, imm]) => [
            { name: 'addi', rd, rs1: 0 as Register, imm, inst_type: 1 },
        ]
    ),
];
