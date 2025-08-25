import { def_macro, register } from './lib_macro';
import { coret } from './core_macros';
import { label, reg_imm, reg_label, reg_reg, reg_reg_label } from './guards';

export const pseudo_instructions = [
    def_macro(
        'bgt',
        3,
        reg_reg_label,
        ([rs1, rs2, imm]) => coret`blt ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'bgtu',
        3,
        reg_reg_label,
        ([rs1, rs2, imm]) => coret`bltu ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'ble',
        3,
        reg_reg_label,
        ([rs1, rs2, imm]) => coret`bge ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'bleu',
        3,
        reg_reg_label,
        ([rs1, rs2, imm]) => coret`bgeu ${rs2}, ${rs1}, ${imm}`
    ),
    def_macro(
        'beqz',
        2,
        reg_label,
        ([rd, imm]) => coret`beq ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bnez',
        2,
        reg_label,
        ([rd, imm]) => coret`bne ${rd}, zero, ${imm}`
    ),
    def_macro(
        'blez',
        2,
        reg_label,
        ([rd, imm]) => coret`bge zero, ${rd}, ${imm}`
    ),
    def_macro(
        'bgez',
        2,
        reg_label,
        ([rd, imm]) => coret`bge ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bltz',
        2,
        reg_label,
        ([rd, imm]) => coret`blt ${rd}, zero, ${imm}`
    ),
    def_macro(
        'bgtz',
        2,
        reg_label,
        ([rd, imm]) => coret`blt zero, ${rd}, ${imm}`
    ),
    def_macro('mv', 2, reg_reg, ([rd, rs]) => coret`addi ${rd}, ${rs}, 0`),
    def_macro('not', 2, reg_reg, ([rd, rs]) => coret`xori ${rd}, ${rs}, -1`),
    def_macro('neg', 2, reg_reg, ([rd, rs]) => coret`sub ${rd}, zero, ${rs}`),
    def_macro('negw', 2, reg_reg, ([rd, rs]) => coret`subw ${rd}, zero, ${rs}`),
    def_macro(
        'sext.w',
        2,
        reg_reg,
        ([rd, rs]) => coret`subw ${rd}, ${rs}, zero`
    ),
    def_macro('seqz', 2, reg_reg, ([rd, rs]) => coret`sltiu ${rd}, ${rs}, 1`),
    def_macro('snez', 2, reg_reg, ([rd, rs]) => coret`sltu ${rd}, zero, ${rs}`),
    def_macro('sltz', 2, reg_reg, ([rd, rs]) => coret`slt ${rd}, ${rs}, zero`),
    def_macro('sgtz', 2, reg_reg, ([rd, rs]) => coret`slt ${rd}, zero, ${rs}`),
    def_macro(
        'j',
        1,
        ([imm], label_table) => label(imm, label_table),
        (imm) => coret`jal zero, ${imm}`
    ),
    def_macro(
        'jr',
        1,
        ([rs]) => register(rs),
        (rs) => coret`jalr zero, ${rs}, 0`
    ),
    def_macro(
        'ret',
        0,
        () => true,
        () => coret`jalr zero, ra, 0`
    ),
    // Additional jal/jalr variants:
    def_macro(
        'jal',
        1,
        ([imm], labels) => label(imm, labels),
        (imm) => coret`jal ra, ${imm}`
    ),
    def_macro(
        'jalr',
        1,
        ([rs]) => register(rs),
        (rs) => coret`jalr ra, ${rs}, 0`
    ),
    def_macro(
        'nop',
        0,
        () => true,
        () => coret`addi x0, x0, 0`
    ),
    def_macro('li', 2, reg_imm, ([rd, imm]) => coret`addi ${rd}, zero, ${imm}`),
];
