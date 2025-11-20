import { describe, it, expect } from 'vitest';
import { immediate } from './arguments';

// Thanks Chatgpt for converting Peter's comment into a test-case :thumbs:
describe('immediate', () => {
    const rv32i_min = -2048n;
    const rv32i_max = 2047n;

    it('should correctly parse signed decimal', () => {
        expect(immediate('-1', rv32i_min, rv32i_max)).toBe(-1n);
    });

    it('should correctly parse unsigned decimal', () => {
        expect(immediate('18446744073709551615', rv32i_min, rv32i_max)).toBe(
            -1n
        );
    });

    it('should correctly parse unsigned hexadecimal', () => {
        expect(immediate('0xffffffffffffffff', rv32i_min, rv32i_max)).toBe(-1n);
    });

    it('should correctly parse signed hexadecimal', () => {
        expect(immediate('-0x1', rv32i_min, rv32i_max)).toBe(-1n);
    });

    it('should correctly parse signed octal', () => {
        expect(immediate('-01', rv32i_min, rv32i_max)).toBe(-1n);
    });

    it('should correctly parse unsigned octal', () => {
        expect(immediate('01777777777777777777777', rv32i_min, rv32i_max)).toBe(
            -1n
        );
    });

    it('should correctly parse signed binary', () => {
        expect(immediate('-0b1', rv32i_min, rv32i_max)).toBe(-1n);
    });

    it('should correctly parse unsigned binary', () => {
        expect(
            immediate(
                '0b1111111111111111111111111111111111111111111111111111111111111111',
                rv32i_min,
                rv32i_max
            )
        ).toBe(-1n);
    });

    it('should handle ambiguous cases', () => {
        // 0x800 is ambiguous, not allowed
        expect(immediate('0x800', rv32i_min, rv32i_max)).toBeUndefined();
    });

    it('should allow unambiguous RV64i constants', () => {
        expect(immediate('0xFFFFFFFFFFFFF800', rv32i_min, rv32i_max)).toBe(
            -2048n
        );
    });

    it('should reject invalid inputs', () => {
        expect(immediate('abcd', rv32i_min, rv32i_max)).toBeUndefined();
        expect(immediate('0xg123', rv32i_min, rv32i_max)).toBeUndefined();
        expect(immediate('', rv32i_min, rv32i_max)).toBeUndefined();
    });
});
