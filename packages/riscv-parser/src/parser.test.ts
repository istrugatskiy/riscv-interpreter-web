import { expect, test } from 'vitest';
import { parse_file } from './parser';

// Thanks GPT-4o, though you are somewhat useless :/
// Had to refactor your mid code, and make it better.
// TBH if you can be replaced by GPT, you are an NPC.
test('Parses valid lines with instructions, labels, and comments', () => {
    expect(
        parse_file(`
    main:  # Entry point
    temp42:
    add x1, x2, x3  # Addition instruction
    beq x4, x5, loop # Branch if equal
    loop:
    sub x6, x7, x8  # Subtraction
    nop
  `)
    ).toStrictEqual({
        labels: new Map([
            ['main', 1],
            ['temp42', 1],
            ['loop', 3],
        ]),
        code_lines: [
            {
                name: 'add',
                args: ['x1', 'x2', 'x3'],
                string_rep: 'add x1, x2, x3  # Addition instruction',
                code_line: 3,
            },
            {
                name: 'beq',
                args: ['x4', 'x5', 'loop'],
                string_rep: 'beq x4, x5, loop # Branch if equal',
                code_line: 4,
            },
            {
                name: 'sub',
                args: ['x6', 'x7', 'x8'],
                string_rep: 'sub x6, x7, x8  # Subtraction',
                code_line: 6,
            },
            { name: 'nop', args: [], string_rep: 'nop', code_line: 7 },
        ],
    });
});

test('Handles excessive spacing and blank lines', () => {
    expect(
        parse_file(`
      main:     
      
    add   x1,   x2,   0(x3) # This instruction is stupid, but the parser is stupider.      
    
        beq    x4,   x5,    end   
        end:  
  `)
    ).toStrictEqual({
        labels: new Map([
            ['main', 1],
            ['end', 3],
        ]),
        code_lines: [
            {
                name: 'add',
                args: ['x1', 'x2', '0(x3)'],
                string_rep:
                    'add   x1,   x2,   0(x3) # This instruction is stupid, but the parser is stupider.',
                code_line: 3,
            },
            {
                name: 'beq',
                args: ['x4', 'x5', 'end'],
                string_rep: 'beq    x4,   x5,    end',
                code_line: 5,
            },
        ],
    });
});

test('Detects invalid lines', () => {
    expect(
        parse_file(`
    main:
    add x1, x2, x3
    invalid_instruction # This should work fine, the parser doesn't know which macros exist.
    sub x4 x5 x6 # Missing commas
  `)
    ).toStrictEqual([
        {
            message: `** (CompileError) **
Irreducable expression @ line 4!
Expression: sub x4 x5 x6 # Missing commas
Normalized as: sub x4 x5 x6
Is not empty but does not match label_expr | macro_expr`,
            line: 4,
        },
    ]);
});

test('Labels that go out of bounds point to code_lines.length + 1', () => {
    expect(
        parse_file(`
    start:
    loop:
    end:
  `)
    ).toStrictEqual({
        labels: new Map([
            ['start', 1],
            ['loop', 1],
            ['end', 1],
        ]),
        code_lines: [],
    });
});

test('Detects invalid labels', () => {
    expect(
        parse_file(`
    valid_label:
    add x1, x2, x3
    ())):
    invalid_instruction_here
  `)
    ).toStrictEqual([
        {
            message: `** (CompileError) **
Irreducable expression @ line 3!
Expression: ())):
Normalized as: ())):
Is not empty but does not match label_expr | macro_expr`,
            line: 3,
        },
    ]);
});
