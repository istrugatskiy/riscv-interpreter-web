import { is_r_type } from '@istrugatskiy/riscv-parser';

const uint64_t = BigInt.asUintN.bind(null, 64);
const int64_t = BigInt.asIntN.bind(null, 64);
const int32_t = BigInt.asIntN.bind(null, 32);
const uint32_t = BigInt.asIntN.bind(null, 32);

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
        if (is_r_type(inst)) {
            const { name, rd, rs1, rs2 } = inst;
            if (rd !== 0) {
                const left = this.#registers[rs1],
                    right = this.#registers[rs2];
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
        }
    }
};
