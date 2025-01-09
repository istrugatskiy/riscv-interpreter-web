import {
    is_b_type,
    is_i_type,
    is_j_type,
    is_mem_type,
    is_r_type,
    is_u_type,
} from '@istrugatskiy/riscv-parser';

const uint64_t = BigInt.asUintN.bind(null, 64);
const int64_t = BigInt.asIntN.bind(null, 64);
const int32_t = BigInt.asIntN.bind(null, 32);
const uint32_t = BigInt.asIntN.bind(null, 32);

// Note how explicit elif blocks are used for all instructions.
// This is very important, since this will prevent weird else bugs
// and allow Typescript's never type to ensure that all instructions are
// explicitly handled.
export const VirtualMachine = class {
    #memory: Map<bigint, bigint> = new Map();
    #registers: bigint[] = new Array(32).fill(0n);
    #pc: bigint = 0n;
    #program: program;

    constructor(program: program) {
        this.#program = program;
    }

    /**
     * Steps the program by one virtual instruction,
     * that is one element of the top-level instruction array.
     * Returns [string_rep, line_no, can_step_again]
     */
    step(): [string, number, boolean] {
        if (
            this.#pc % 4n != 0n ||
            this.#pc < 0 ||
            this.#pc > Number.MAX_SAFE_INTEGER
        ) {
            throw new Error('Illegal pc state');
        }
        const inst = this.#program[Number(this.#pc % 4n)];

        if (inst === undefined) {
            return ['', Number(this.#pc), false];
        }
        const { string_rep, line_no, instructions } = inst;
        this.#pc = instructions.reduce((_, inst) => this.#eval_inst(inst), -1n);

        if (this.#pc % 4n !== 0n) {
            throw new Error(`Instruction addresss misaligned exception.`);
        }

        return [
            string_rep,
            line_no,
            this.#pc < 0 || this.#pc > this.#program.length * 4,
        ];
    }

    /**
     * Evaluate instruction and return new pc.
     */
    #eval_inst(inst: instruction): bigint {
        if (is_r_type(inst) || is_i_type(inst)) {
            let { name, rd, rs1 } = inst;
            if (rd !== 0) {
                const left = this.#registers[rs1],
                    right =
                        'rs2' in inst ? this.#registers[inst.rs2] : inst.imm;
                name = name.replace('i', '') as r_names;
                if (left === undefined || right === undefined) {
                    throw new Error('Registers out of range');
                }
                if (name === 'add') {
                    this.#registers[rd] = uint64_t(left + right);
                } else if (name === 'sub') {
                    this.#registers[rd] = uint64_t(left - right);
                } else if (name === 'and') {
                    this.#registers[rd] = uint64_t(left & right);
                } else if (name === 'or') {
                    this.#registers[rd] = uint64_t(left | right);
                } else if (name === 'xor') {
                    this.#registers[rd] = uint64_t(left ^ right);
                } else if (name === 'slt') {
                    this.#registers[rd] = BigInt(
                        int64_t(left) < int64_t(right)
                    );
                } else if (name === 'sltu') {
                    this.#registers[rd] = BigInt(left < right);
                } else if (name === 'sll') {
                    this.#registers[rd] = uint64_t(left << (right & 0x3fn));
                } else if (name === 'sra') {
                    this.#registers[rd] = uint64_t(
                        int64_t(left) >> (right & 0x3fn)
                    );
                } else if (name === 'srl') {
                    this.#registers[rd] = uint64_t(left >> (right & 0x3fn));
                } else if (name === 'addw') {
                    this.#registers[rd] = uint64_t(
                        // I believe the outer call is unnecessary...
                        // but just in case, I'll keep it.
                        int64_t(
                            int32_t(
                                int32_t(left & 0xffffffffn) +
                                    int32_t(right & 0xffffffffn)
                            )
                        )
                    );
                } else if (name === 'sllw') {
                    this.#registers[rd] = uint64_t(
                        int64_t(
                            uint32_t(
                                uint32_t(left & 0xffffffffn) <<
                                    uint32_t(right & 0x1fn)
                            )
                        )
                    );
                } else if (name === 'srlw') {
                    this.#registers[rd] = uint64_t(
                        int64_t(
                            uint32_t(
                                uint32_t(left & 0xffffffffn) >>
                                    uint32_t(right & 0x1fn)
                            )
                        )
                    );
                } else if (name === 'subw') {
                    this.#registers[rd] = uint64_t(
                        int64_t(
                            int32_t(
                                int32_t(left & 0xffffffffn) -
                                    int32_t(right & 0xffffffffn)
                            )
                        )
                    );
                } else if (name === 'sraw') {
                    this.#registers[rd] = uint64_t(
                        int64_t(
                            int32_t(
                                int32_t(left & 0xffffffffn) >>
                                    uint32_t(right & 0x1fn)
                            )
                        )
                    );
                }
            }
            return this.#pc + 4n;
        } else if (is_mem_type(inst)) {
        } else if (is_u_type(inst)) {
            const { name, rd, imm } = inst;
            // We sign extend the 32 bit immediate to a full 64 bits.
            // Peter's code does this in a weird way, and the functions are
            // different for lui, auipc.
            // I think this is likely a bug in the C code, but I may be missing something.
            const shifted = uint64_t(int32_t(imm << 12n));
            if (rd !== 0) {
                if (name === 'lui') {
                    this.#registers[rd] = shifted;
                } else if (name === 'auipc') {
                    this.#registers[rd] = shifted + this.#pc;
                }
            }
            return this.#pc + 4n;
        } else if (is_b_type(inst)) {
        } else if (is_j_type(inst)) {
            const { name, rd, imm } = inst;
            if (rd !== 0) {
                this.#registers[rd] = int64_t(this.#pc + 4n);
            }
            if (name === 'jal') {
                // Just in case :)
                return int64_t(imm);
            } else if (name === 'jalr') {
                const right = this.#registers[inst.rs1];
                if (right === undefined) {
                    throw new Error('Registers out of range');
                }
                const result = int64_t((imm + right) & ~1n);
                return result;
            }
        }
    }
};
