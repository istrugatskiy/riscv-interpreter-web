const is_r_type = (inst: Instruction) => inst.inst_type == 0;
const is_i_type = (inst: Instruction) => inst.inst_type == 1;
const is_mem_type = (inst: Instruction) => inst.inst_type == 2;
const is_u_type = (inst: Instruction) => inst.inst_type == 3;
const is_b_type = (inst: Instruction) => inst.inst_type == 4;
const is_j_type = (inst: Instruction) => inst.inst_type == 5;
const is_m_type = (inst: Instruction) => inst.inst_type == 6;

const uint64_t = BigInt.asUintN.bind(undefined, 64);
const uint32_t = BigInt.asUintN.bind(undefined, 32);
const int64_t = BigInt.asIntN.bind(undefined, 64);
const int32_t = BigInt.asIntN.bind(undefined, 32);

/**
 * A faster byte-addressable RISC-V interpreter memory.
 * There is no garbage collection, yet...
 */
export class InterpreterMemory {
    readonly #memory = new Map<bigint, BigUint64Array>();

    readonly #page_size: number;
    readonly #page_offset_width: number;
    readonly #page_id_mask: bigint;

    #last_used_page: { page_id: bigint; page: BigUint64Array } | undefined;

    constructor(page_size: number) {
        if (Math.log2(page_size) % 1 !== 0) {
            throw new Error('Page size must be power of two.');
        }
        this.#page_size = page_size;
        this.#page_offset_width = Math.ceil(Math.log2(this.#page_size));
        this.#page_id_mask = uint64_t(
            (2n ** 64n - 1n) << BigInt(this.#page_offset_width)
        );
    }

    /**
     * Set if new_value is not undefined, otherwise equivalent to get.
     * pg_offset is used to cut down on costs of casting page_offset and computing it.
     */
    #get_or_set(
        byte: bigint,
        new_value: bigint | undefined,
        pg_offset: number | undefined
    ) {
        const page_id = byte & this.#page_id_mask;
        const page_offset =
            pg_offset ?? Number(BigInt.asUintN(this.#page_offset_width, byte));

        if (page_id !== this.#last_used_page?.page_id) {
            let page = this.#memory.get(page_id);
            if (page === undefined) {
                page = new BigUint64Array(this.#page_size);
                this.#memory.set(page_id, page);
            }

            this.#last_used_page = { page_id, page };
        }

        if (new_value !== undefined) {
            this.#last_used_page.page[page_offset] = new_value;
        }

        return this.#last_used_page.page[page_offset] ?? 0n;
    }

    get(byte: bigint) {
        return this.#get_or_set(byte, undefined, undefined);
    }

    /**
     * Set the value of memory[byte] to be value.
     * We require 0 <= value <= 255
     */
    set(byte: bigint, value: bigint) {
        return this.#get_or_set(byte, value, undefined);
    }

    store_range(start: bigint, end: bigint, value: bigint) {
        let page_offset = Number(
            BigInt.asUintN(this.#page_offset_width, start)
        );
        for (let offset = 0n; offset < end; offset++) {
            const byte = BigInt.asIntN(8, value >> (8n * offset));
            this.#get_or_set(uint64_t(start + offset), byte, page_offset);
            page_offset = (page_offset + 1) % this.#page_size;
        }
    }

    load_range(start: bigint, end: bigint, load_unsigned = false) {
        let out = 0n;
        let page_offset = Number(
            BigInt.asUintN(this.#page_offset_width, start)
        );
        for (let offset = 0n; offset < end; offset++) {
            const byte_val = this.#get_or_set(
                uint64_t(start + offset),
                undefined,
                page_offset
            );
            out += BigInt.asUintN(8, byte_val) << (8n * offset);
            page_offset = (page_offset + 1) % this.#page_size;
        }

        if (!load_unsigned) {
            return uint64_t(BigInt.asIntN(8 * Number(end), out));
        }

        return uint64_t(BigInt.asUintN(8 * Number(end), out));
    }
}

export class VirtualMachine {
    #memory = new InterpreterMemory(2 ** 12);
    #registers;
    pc = 0;
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
                this.pc % 4 != 0 ||
                this.pc < 0 ||
                this.pc > Number.MAX_SAFE_INTEGER
            ) {
                throw new Error('Illegal pc state');
            }
            if (this.#registers[0] !== 0n) {
                throw new Error(
                    `Illegal zero register state: x0 = ${this.#registers[0].toString()}`
                );
            }
            const inst = this.#program[this.pc / 4];

            if (inst === undefined) {
                return ['', this.pc, false];
            }
            const { string_rep, line_no, instructions } = inst;
            this.pc = instructions.reduce(
                (_, inst) => this.#eval_inst(inst),
                -1
            );
            if (this.pc % 4 !== 0) {
                throw new Error(`Instruction addresss misaligned`);
            }

            return [
                string_rep,
                line_no,
                this.pc >= 0 && this.pc < this.#program.length * 4,
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
        return this.#memory;
    }

    /**
     * Evaluate instruction and return new pc.
     */
    #eval_inst(inst: Instruction): number {
        if (is_r_type(inst) || is_i_type(inst) || is_m_type(inst)) {
            // Yes, this is technically incorrect, but it makes my life easier...
            let { name } = inst;
            const { rd, rs1 } = inst;
            if (rd !== 0) {
                const left = this.#registers[rs1],
                    right =
                        'rs2' in inst ? this.#registers[inst.rs2] : inst.imm;

                // Force normalized i type and reg type instructions.
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
            return this.pc + 4;
        } else if (is_mem_type(inst)) {
            const { name, rd, rs1, imm } = inst;
            const left = this.#registers[rd],
                right = this.#registers[rs1];
            // If instruction is a store, rs1 = left, rs2 = right.
            const store_range = (end: bigint) => {
                this.#memory.store_range(right + imm, end, left);
            };
            const load_range = (end: bigint) => {
                if (rd !== 0) {
                    this.#registers[rd] = this.#memory.load_range(
                        right + imm,
                        end,
                        name.charAt(2) === 'u'
                    );
                }
            };
            const func = name.startsWith('s') ? store_range : load_range;
            const size = name.charAt(1) as 'b' | 'h' | 'w' | 'd';
            if (size === 'b') {
                func(1n);
            } else if (size === 'h') {
                func(2n);
            } else if (size === 'w') {
                func(4n);
            } else {
                func(8n);
            }
            return this.pc + 4;
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
                    this.#registers[rd] = shifted + BigInt(this.pc);
                }
            }
            return this.pc + 4;
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
                return Number(imm);
            }

            return this.pc + 4;
        } else if (is_j_type(inst)) {
            const { name, rd, imm } = inst;
            if (rd !== 0) {
                this.#registers[rd] = int64_t(BigInt(this.pc + 4));
            }
            if (name === 'jal') {
                // Just in case :)
                return Number(int64_t(imm));
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (name === 'jalr') {
                const right = this.#registers[inst.rs1];
                const result = int64_t((imm + right) & ~1n);
                return Number(result);
            }
        }
        throw new Error('Illegal Command');
    }
}
