/**
 * A program consists of instructions.
 * Comments become part of the nearest instruction and are added to it's string representation.
 * Instructions are newline separated.
 */
type program = {
    lines: { instructions: instruction[]; string_rep: string }[];
};

// TODO: figure out mul and div extension.
// These pseudo instructions are also supported:
// BGT, BGTU, BLE, BLEU, BEQZ, BNEZ,
// BLEZ, BGEZ, BLTZ, BGTZ, MV, NOT, NEG, NEGW,
// SEXT.W, SEQZ, SNEZ, SLTZ, SGTZ
// J, JR, RET
type r_names =
    | 'add'
    | 'sub'
    | 'and'
    | 'or'
    | 'xor'
    | 'slt'
    | 'sltu'
    | 'sll'
    | 'sra'
    | 'srl'
    | 'addw'
    | 'sllw'
    | 'srlw'
    | 'subw'
    | 'sraw';
/**
 * Represented as: [name: r_names] [rd: register], [rs1: register], [rs2: register];
 *
 * For example:
 *  - add a0, zero, a1 # a0 = 0 + a1
 *  - and x0, x1, x2 # This is a no-op, since x0 = 0.
 */
type r_type = { name: r_names; rd: number; rs1: number; rs2: number };

type i_names =
    | 'addi'
    | 'andi'
    | 'ori'
    | 'xori'
    | 'slti'
    | 'sltiu'
    | 'addiw'
    | 'slli'
    | 'slliw'
    | 'srli'
    | 'srliw'
    | 'srai'
    | 'sraiw';
/**
 * Represented as: [name: i_names] [rd: register], [rs1: register], [imm: -2048 <= imm <= 2047];
 *
 * For example:
 *  - addi a0, a1, 10 # a0 = a1 + 10
 *  - andi x12, x25, 0xFF # x12 = x25 & 0xFF
 */
type i_type = { name: i_names; rd: number; rs1: number; imm: bigint };

type mem_names = 'lb' | 'lh' | 'lw' | 'ld' | 'sb' | 'sh' | 'sw' | 'sd';
/**
 * Represented as: [name: mem_names] [rd: register], [imm: -2048 <= imm <= 2047]([rs1: register])
 *
 * For example:
 *  - lw x1, 0(x2) # Load word at memory address x2 with 0 byte offset.
 *  - sb a1, 7(a3) # Store byte at memory address a3 with 7 byte offset.
 */
type mem_type = {
    name: mem_names;
    rd: number;
    rs1: number;
    imm: bigint;
};

/**
 * Represented as: [name: 'lui' | 'auipc'] [rd: register], [imm: imm <= 0xFFFFF]
 *
 * For example:
 *  - lui x1, 0x3410 # Loads 0x3410 into the upper 20 bits of x1.
 */
type u_type = { name: 'lui' | 'auipc'; rd: number; imm: bigint };

type b_name = 'beq' | 'bne' | 'blt' | 'bltu' | 'bge' | 'bgeu';
/**
 * Represented as: [name: b_name] [rs1: register], [rs2: register], [imm: (int64_t)imm > 0 & imm is divisible by 4]
 *
 * I believe that the RISC-V assembler is supposed to under the hood support any arbitrary branch.
 * See: https://github.com/riscv-non-isa/riscv-asm-manual/blob/main/src/asm-manual.adoc.
 *
 * For example:
 *  - beq x1, x2, label_name
 */
type b_type = { name: b_name; rs1: number; rs2: number; imm: bigint };

/**
 * Represented as: jal rd, imm (or) jalr rd, rs1, imm
 *
 * For example:
 *  - jal x1, label
 *  - jalr x2, x3, label
 */
type j_type =
    | { name: 'jal'; rd: number; imm: bigint }
    | { name: 'jalr'; rd: number; rs1: number; imm: bigint };

type instruction = r_type | i_type | mem_type | u_type | b_type;
