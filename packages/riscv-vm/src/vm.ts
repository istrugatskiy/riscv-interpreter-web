import {
    is_b_type,
    is_i_type,
    is_j_type,
    is_m_type,
    is_mem_type,
    is_r_type,
    is_u_type,
} from '/home/ilya/Desktop/code/html/riscv/packages/riscv-compiler';

const uint64_t = BigInt.asUintN.bind(undefined, 64);
const int64_t = BigInt.asIntN.bind(undefined, 64);
const int32_t = BigInt.asIntN.bind(undefined, 32);
const uint32_t = BigInt.asUintN.bind(undefined, 32);

export class VirtualMachine {
    #memory = new Map<bigint, bigint>();
    #registers;
    #pc = 0n;
    #program: Program;

    constructor(program: Program, registers: Tuple<bigint, 32>) {
        this.#program = program;
        this.#registers = registers;
    }

    /**
     * Steps the program by one virtual instruction,
     * that is one element of the top-level instruction array.
     * Returns [string_rep, line_no, can_step_again]
     */
    step(): [string, number, boolean] {
        try {
            if (
                this.#pc % 4n != 0n ||
                this.#pc < 0 ||
                this.#pc > Number.MAX_SAFE_INTEGER
            ) {
                throw new Error('Illegal pc state');
            }
            if (this.#registers[0] !== 0n) {
                throw new Error(
                    `Illegal zero register state: x0 = ${this.#registers[0].toString()}`
                );
            }
            const inst = this.#program[Number(this.#pc / 4n)];

            if (inst === undefined) {
                return ['', Number(this.#pc), false];
            }
            const { string_rep, line_no, instructions } = inst;
            this.#pc = instructions.reduce(
                (_, inst) => this.#eval_inst(inst),
                -1n
            );
            if (this.#pc % 4n !== 0n) {
                throw new Error(`Instruction addresss misaligned`);
            }

            return [
                string_rep,
                line_no,
                this.#pc >= 0 && this.#pc < this.#program.length * 4,
            ];
        } catch (exc) {
            if (!(exc instanceof Error)) {
                console.error(exc);
                throw new Error(`** (InternalError) **
--> Something went wrong running your code.
See the JS console for more info.`);
            }
            console.error(exc);
            throw new Error(`** (RuntimeError) **
--> ${exc.message}
See the JS console for more info.`);
        }
    }

    get registers() {
        return [...this.#registers];
    }

    get memory() {
        return this.#memory as ReadonlyMap<bigint, bigint>;
    }

    /**
     * Evaluate instruction and return new pc.
     */
    #eval_inst(inst: Instruction): bigint {
        if (is_r_type(inst) || is_i_type(inst) || is_m_type(inst)) {
            // Yes, this is technically incorrect, but it makes my life easier...
            let { name } = inst;
            const { rd, rs1 } = inst;
            if (rd !== 0) {
                const left = this.#registers[rs1],
                    right =
                        'rs2' in inst ? this.#registers[inst.rs2] : inst.imm;
                name = (is_i_type(inst) ? name.replace('i', '') : name) as
                    | RegisterName
                    | MultiplicationName;
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
                } else if (name === 'mul') {
                    this.#registers[rd] = uint64_t(left * right);
                } else if (name === 'mulh') {
                    this.#registers[rd] = uint64_t(
                        (int64_t(left) * int64_t(right)) >> 64n
                    );
                } else if (name === 'mulhu') {
                    this.#registers[rd] = uint64_t((left * right) >> 64n);
                } else if (name === 'mulhsu') {
                    this.#registers[rd] = uint64_t(
                        (int64_t(left) * right) >> 64n
                    );
                } else if (name === 'mulw') {
                    this.#registers[rd] = uint64_t(
                        int32_t(uint32_t(left) * uint32_t(right))
                    );
                } else if (name === 'div') {
                    this.#registers[rd] = uint64_t(
                        right === 0n ? -1n : int64_t(left) / int64_t(right)
                    );
                } else if (name === 'divu') {
                    this.#registers[rd] = uint64_t(
                        right === 0n ? -1n : left / right
                    );
                } else if (name === 'rem') {
                    this.#registers[rd] = uint64_t(
                        right === 0n ? left : int64_t(left) % int64_t(right)
                    );
                } else if (name === 'remu') {
                    this.#registers[rd] = uint64_t(
                        right === 0n ? left : left % right
                    );
                } else if (name === 'divw') {
                    this.#registers[rd] = uint64_t(
                        right === 0n
                            ? -1n
                            : int32_t(int32_t(left) / int32_t(right))
                    );
                } else if (name === 'divuw') {
                    this.#registers[rd] = uint64_t(
                        right === 0n
                            ? -1n
                            : int32_t(uint32_t(left) / uint32_t(right))
                    );
                } else if (name === 'remw') {
                    this.#registers[rd] = uint64_t(
                        int32_t(
                            right === 0n ? left : int32_t(left) % int32_t(right)
                        )
                    );
                    // Disable this check because we want to make clear the instruction we are operating on.
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                } else if (name === 'remuw') {
                    this.#registers[rd] = uint64_t(
                        int32_t(
                            right === 0n
                                ? uint32_t(left)
                                : uint32_t(left) % uint32_t(right)
                        )
                    );
                }
            }
            return this.#pc + 4n;
        } else if (is_mem_type(inst)) {
            const { name, rd, rs1, imm } = inst;
            const left = this.#registers[rd],
                right = this.#registers[rs1];
            // If instruction is a store, rs1 = left, rs2 = right.
            const store_range = (end: bigint) => {
                for (let offset = 0n; offset < end; offset++) {
                    if (uint64_t(offset + right + imm) > 0x7fffffffffffffffn) {
                        throw new Error(
                            'Memory address must be in range [0, 0x7FFFFFFFFFFFFFFF]'
                        );
                    }
                    const byte = BigInt.asIntN(8, left >> (8n * offset));
                    this.#memory.set(uint64_t(right + imm + offset), byte);
                }
            };
            const load_range = (end: bigint) => {
                let out = 0n;
                for (let offset = 0n; offset < end; offset++) {
                    if (uint64_t(offset + right + imm) > 0x7fffffffffffffffn) {
                        throw new Error(
                            'Memory address must be in range [0, 0x7FFFFFFFFFFFFFFF]'
                        );
                    }
                    const byte_val =
                        this.#memory.get(uint64_t(offset + right + imm)) ?? 0n;
                    out += BigInt.asUintN(8, byte_val) << (8n * offset);
                }
                this.#registers[rd] = uint64_t(
                    BigInt.asIntN(8 * Number(end), out)
                );
            };
            const func = name.at(0) === 's' ? store_range : load_range;
            const size = name.at(1) as 'b' | 'h' | 'w' | 'd';
            if (size === 'b') {
                func(1n);
            } else if (size === 'h') {
                func(2n);
            } else if (size === 'w') {
                func(4n);
            } else {
                func(8n);
            }
            return this.#pc + 4n;
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
                } else {
                    this.#registers[rd] = shifted + this.#pc;
                }
            }
            return this.#pc + 4n;
        } else if (is_b_type(inst)) {
            const { name, rs1, rs2, imm } = inst;
            const left = this.#registers[rs1],
                right = this.#registers[rs2];
            if (
                (name === 'beq' && left === right) ||
                (name === 'bne' && left !== right) ||
                (name === 'blt' && int64_t(left) < int64_t(right)) ||
                (name === 'bltu' && left < right) ||
                (name === 'bge' && int64_t(left) >= int64_t(right)) ||
                (name === 'bgeu' && left >= right)
            ) {
                return imm;
            }

            return this.#pc + 4n;
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
                const result = int64_t((imm + right) & ~1n);
                return result;
            }
        }
        throw new Error('Illegal Command');
    }
}
