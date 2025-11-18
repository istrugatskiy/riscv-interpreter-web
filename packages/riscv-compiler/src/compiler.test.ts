// Thanks chat gpt 4o :)
import { describe, it, expect } from 'vitest';
import { InterpreterError, compile_riscv } from './compiler';

const is_error = (result: Program | InterpreterError[]) =>
    result.every((entry) => 'error_type' in entry);

const flatten_bytecode = (program: Program) =>
    program.flatMap(({ instructions }) => instructions);

describe('compile_riscv', () => {
    it('parses a valid program without errors', () => {
        const result = compile_riscv(`
      # Basic instructions
      add x1, x2, x3
      sub x4, x5, x6

      # Memory operation
      lw x7, 0(x8)

      label:
      jal x9, label
    `);
        if (!is_error(result)) {
            expect(flatten_bytecode(result)).toHaveLength(4);
        } else {
            throw new Error('Expected valid program to compile without errors');
        }
    });

    it('returns compile_error[] for a program with missing arguments', () => {
        const result = compile_riscv(`add x1, x2
      sub x3, x4,
    `);
        expect(is_error(result)).toBe(true);
        if (is_error(result)) {
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('line', 2);
        }
    });

    it('handles labels and jumps correctly', () => {
        const result = compile_riscv(`start:
      add x1, x2, x3
      jal x0, start
    `);
        if (!is_error(result)) {
            expect(flatten_bytecode(result)).toHaveLength(2);
            expect(flatten_bytecode(result)[1]).toEqual({
                name: 'jal',
                rd: 0,
                imm: 0n,
            });
        }
    });

    it('throws compile_error[] for multiple instructions or labels on one line', () => {
        const result = compile_riscv(`label: add x1, x2, x3`);
        expect(is_error(result)).toBe(true);
        if (is_error(result)) {
            expect(result).toHaveLength(1);
            expect(result[0]?.line).toBe(1);
        }
    });

    it('handles arbitrary spacing and comments', () => {
        const result = compile_riscv(`
      add x1, x2, x3     # Extra spaces
      
      lw x4, 4(x5)       # Aligned memory access
    `);
        if (!is_error(result)) {
            expect(flatten_bytecode(result)).toHaveLength(2);
            expect(flatten_bytecode(result)[0]).toEqual({
                name: 'add',
                rd: 1,
                rs1: 2,
                rs2: 3,
            });
            expect(flatten_bytecode(result)[1]).toEqual({
                name: 'lw',
                rd: 4,
                rs1: 5,
                imm: 4n,
            });
        }
    });

    it('returns compile_error[] for arguments with spaces', () => {
        const result = compile_riscv(`add x1, x 2, x3`);
        expect(is_error(result)).toBe(true);
        if (is_error(result)) {
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('error_type');
        }
    });

    it('parses a complex valid program with various instructions', () => {
        const result = compile_riscv(`
      addi x1, x2, 100
      slli x3, x4, 2
      lui x5, 0x10000
      label:
      beq x1, x2, label
    `);
        if (!is_error(result)) {
            expect(flatten_bytecode(result)).toHaveLength(4);
            expect(flatten_bytecode(result)[0]).toEqual({
                name: 'addi',
                rd: 1,
                rs1: 2,
                imm: 100n,
            });
            expect(flatten_bytecode(result)[1]).toEqual({
                name: 'slli',
                rd: 3,
                rs1: 4,
                imm: 2n,
            });
        }
    });

    it('returns compile_error[] for unrecognized instructions', () => {
        const result = compile_riscv(`invalid_instruction x1, x2, x3`);
        expect(is_error(result)).toBe(true);
        if (is_error(result)) {
            expect(result).toHaveLength(1);
            expect(result[0]?.line).toBe(1);
        }
    });

    it('validates memory offsets and imm ranges', () => {
        const bad_programs = [
            `lw x1, 4096(x2)`, // Offset too large
            `addi x3, x4, -3000`, // Immediate too small
        ];

        bad_programs.forEach((program) => {
            const result = compile_riscv(program);
            expect(is_error(result)).toBe(true);
            if (is_error(result)) {
                expect(result).toHaveLength(1);
                expect(result[0]?.line).toBe(1);
            }
        });
    });

    it('parses multiple valid programs with branching', () => {
        const result = compile_riscv(`
      beq x1, x2, 4
      bne x3, x4, 8
    `);
        if (!is_error(result)) {
            expect(flatten_bytecode(result)).toHaveLength(2);
            expect(flatten_bytecode(result)[0]).toEqual({
                name: 'beq',
                rs1: 1,
                rs2: 2,
                imm: 4n,
            });
            expect(flatten_bytecode(result)[1]).toEqual({
                name: 'bne',
                rs1: 3,
                rs2: 4,
                imm: 8n,
            });
        }
    });

    it('handles empty lines and ignores them', () => {
        const result = compile_riscv(`
      
      add x1, x2, x3
      
      
      sub x4, x5, x6
    `);
        if (!is_error(result)) {
            expect(flatten_bytecode(result)).toHaveLength(2);
        }
    });

    it('returns compile_error[] for missing commas between arguments', () => {
        const result = compile_riscv(`add x1 x2, x3`);
        expect(is_error(result)).toBe(true);
        if (is_error(result)) {
            expect(result).toHaveLength(1);
            expect(result[0]?.line).toBe(1);
        }
    });

    it('parses programs with pseudo-instructions reduced to low-level instructions', () => {
        const result = compile_riscv(`
      mv x1, x2
      not x3, x4
    `);
        if (!is_error(result)) {
            expect(flatten_bytecode(result)).toHaveLength(2);
            expect(flatten_bytecode(result)[0]).toEqual({
                name: 'addi',
                rd: 1,
                rs1: 2,
                imm: 0n,
            });
            expect(flatten_bytecode(result)[1]).toEqual({
                name: 'xori',
                rd: 3,
                rs1: 4,
                imm: -1n,
            });
        }
    });
});
