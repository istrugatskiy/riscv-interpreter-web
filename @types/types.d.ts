/**
 * The hope is to deprecate this file and global types as whole, except for fixed length arrays,
 * and other global useful utilities.
 */
type Tuple<T, N extends number> = N extends N
    ? number extends N
        ? T[]
        : TupleOf<T, N, []>
    : never;
type TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
    ? R
    : TupleOf<T, N, [T, ...R]>;

type Enumerate<
    N extends number,
    Acc extends number[] = []
> = Acc['length'] extends N
    ? Acc[number]
    : Enumerate<N, [...Acc, Acc['length']]>;

type IntRange<F extends number, T extends number> = Exclude<
    Enumerate<T>,
    Enumerate<F>
>;

/**
 * A program consists of instructions.
 * Comments become part of the nearest instruction and are added to it's string representation.
 * Instructions are newline separated.
 */
type Program = {
    instructions: Instruction[];
    string_rep: string;
    line_no: number;
}[];

type Register = IntRange<0, 32>;

// These pseudo instructions are also supported:
// BGT, BGTU, BLE, BLEU, BEQZ, BNEZ,
// BLEZ, BGEZ, BLTZ, BGTZ, MV, NOT, NEG, NEGW,
// SEXT.W, SEQZ, SNEZ, SLTZ, SGTZ
// J, JR, RET, LI, NOP
type RegisterName =
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
type RegisterType = {
    name: RegisterName;
    rd: Register;
    rs1: Register;
    rs2: Register;
};

type ImmediateName =
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
type ImmediateType = {
    name: ImmediateName;
    rd: Register;
    rs1: Register;
    imm: bigint;
};

type MemoryName = 'lb' | 'lh' | 'lw' | 'ld' | 'sb' | 'sh' | 'sw' | 'sd';
/**
 * Represented as: [name: mem_names] [rd: register], [imm: -2048 <= imm <= 2047]([rs1: register])
 *
 * For example:
 *  - lw x1, 0(x2) # Load word at memory address x2 with 0 byte offset.
 *  - sb a1, 7(a3) # Store byte at memory address a3 with 7 byte offset.
 */
type MemoryType = {
    name: MemoryName;
    rd: Register;
    rs1: Register;
    imm: bigint;
};

/**
 * Represented as: [name: 'lui' | 'auipc'] [rd: register], [imm: imm <= 0xFFFFF]
 *
 * For example:
 *  - lui x1, 0x3410 # Loads 0x3410 into the upper 20 bits of x1.
 */
type UpperImmediateType = {
    name: 'lui' | 'auipc';
    rd: Register;
    imm: bigint;
};

type BranchName = 'beq' | 'bne' | 'blt' | 'bltu' | 'bge' | 'bgeu';
/**
 * Represented as: [name: b_name] [rs1: register], [rs2: register], [imm: (int64_t)imm > 0 & imm is divisible by 4]
 *
 * I believe that the RISC-V assembler is supposed to under the hood support any arbitrary branch.
 * See: https://github.com/riscv-non-isa/riscv-asm-manual/blob/main/src/asm-manual.adoc.
 *
 * For example:
 *  - beq x1, x2, label_name
 */
type BranchType = {
    name: BranchName;
    rs1: Register;
    rs2: Register;
    imm: bigint;
};

/**
 * Represented as: jal rd, imm (or) jalr rd, rs1, imm
 *
 * For example:
 *  - jal x1, label
 *  - jalr x2, x3, label
 */
type JumpType =
    | { name: 'jal'; rd: Register; imm: bigint }
    | { name: 'jalr'; rd: Register; rs1: Register; imm: bigint };

type MultiplicationName =
    | 'mul'
    | 'mulh'
    | 'mulhu'
    | 'mulhsu'
    | 'mulw'
    | 'div'
    | 'divu'
    | 'rem'
    | 'remu'
    | 'divw'
    | 'divuw'
    | 'remw'
    | 'remuw';
/**
 * Represented as: [name: m_name] [rd: register], [rs1: register], [rs2: register]
 *
 * For example:
 *  - mul a0, a1, a0
 *  - mulh t0, a1, a0
 */
type MultiplicationType = {
    name: MultiplicationName;
    rd: Register;
    rs1: Register;
    rs2: Register;
};

type Instruction =
    | RegisterType
    | ImmediateType
    | MemoryType
    | UpperImmediateType
    | BranchType
    | JumpType
    | MultiplicationType;
