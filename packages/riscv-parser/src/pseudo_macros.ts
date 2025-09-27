import { def_macro, imm_type, label_type, reg_type } from './lib_macro';
import { coret } from './core_macros';

export const pseudo_instructions = [
    def_macro(
        'bgt',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => coret`blt ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'bgtu',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => coret`bltu ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'ble',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => coret`bge ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'bleu',
        [reg_type, reg_type, label_type] as const,
        ([rs1, rs2, imm]) => coret`bgeu ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'beqz',
        [reg_type, label_type] as const,
        ([rd, imm]) => coret`beq ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bnez',
        [reg_type, label_type] as const,
        ([rd, imm]) => coret`bne ${rd}, zero, ${imm}`
    ),
    def_macro(
        'blez',
        [reg_type, label_type] as const,
        ([rd, imm]) => coret`bge zero, ${rd}, ${imm}`
    ),
    def_macro(
        'bgez',
        [reg_type, label_type] as const,
        ([rd, imm]) => coret`bge ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bltz',
        [reg_type, label_type] as const,
        ([rd, imm]) => coret`blt ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bgtz',
        [reg_type, label_type] as const,
        ([rd, imm]) => coret`blt zero, ${rd}, ${imm}`
    ),
    def_macro(
        'mv',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`addi ${rd}, ${rs}, 0`
    ),
    def_macro(
        'not',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`xori ${rd}, ${rs}, -1`
    ),
    def_macro(
        'neg',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`sub ${rd}, zero, ${rs}`
    ),
    def_macro(
        'negw',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`subw ${rd}, zero, ${rs}`
    ),
    def_macro(
        'sext.w',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`subw ${rd}, ${rs}, zero`
    ),
    def_macro(
        'seqz',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`sltiu ${rd}, ${rs}, 1`
    ),
    def_macro(
        'snez',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`sltu ${rd}, zero, ${rs}`
    ),
    def_macro(
        'sltz',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`slt ${rd}, ${rs}, zero`
    ),
    def_macro(
        'sgtz',
        [reg_type, reg_type] as const,
        ([rd, rs]) => coret`slt ${rd}, zero, ${rs}`
    ),
    def_macro('j', [label_type] as const, ([imm]) => coret`jal zero, ${imm}`),
    def_macro('jr', [reg_type] as const, ([rs]) => coret`jalr zero, ${rs}, 0`),
    def_macro('ret', [], () => coret`jalr zero, ra, 0`),
    // Additional jal/jalr variants:
    def_macro('jal', [label_type] as const, ([imm]) => coret`jal ra, ${imm}`),
    def_macro('jalr', [reg_type] as const, ([rs]) => coret`jalr ra, ${rs}, 0`),
    def_macro('nop', [], () => coret`addi x0, x0, 0`),
    def_macro(
        'li',
        [reg_type, imm_type(-(2n ** 63n), 2n ** 63n - 1n)] as const,
        // Kinda cheating the system...
        ([rd, imm]) => [{ name: 'addi', rd, rs1: 0 as Register, imm }]
    ),
];
