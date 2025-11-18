import { describe, it, expect } from 'vitest';
import { parser } from './riscv';
import { SyntaxNode } from '@lezer/common';

const strict_parser = parser.configure({ strict: true });

const string_of_code = (code: string) => {
    // Return a string representation of the node.

    const children_of = (node: SyntaxNode) => {
        const cur = node.cursor(),
            children: SyntaxNode[] = [];
        if (!cur.firstChild()) return children;
        children.push(cur.node);
        while (cur.nextSibling()) {
            children.push(cur.node);
        }
        return children;
    };
    const traverse_tree = (node: SyntaxNode, indentation: number) => {
        const children = children_of(node);
        let string_rep = `${' '.repeat(indentation)}${node.type.name}(`;
        for (const child of children) {
            string_rep += `\n${traverse_tree(child, indentation + 2)},`;
        }

        if (children.length === 0) {
            string_rep += `"${code.slice(node.from, node.to)}")`;
        } else {
            string_rep = string_rep.slice(0, string_rep.length - 1);
            string_rep += `\n${' '.repeat(indentation)})`;
        }

        return string_rep;
    };

    const top_node = strict_parser.parse(code).topNode as unknown as SyntaxNode;
    return traverse_tree(top_node, 0);
};

describe('RISC-V Parser', () => {
    it('Should not crash on some simple programs', () => {
        const simple_prog = `addi x0, x0, x0
`;
        expect(strict_parser.parse(simple_prog));

        const parsed = string_of_code(`# Type your code here...
addi x1, x0, 2047
addi x1, x1, 1363
# x1 = 3410 :)
`);
        expect(parsed);

        const tabbed_program = `addi    x0, x0, x0
`;
        expect(tabbed_program);
    });

    it('Should not crash on the GCD test program', () => {
        const gcd_prog = `## desc = GCD test
## cycles = 579
# SETUP - do not delete
lui t0, 0x0172f
addi t0, t0, 0x082
sw t0, 0(x0)
lui t0, 0x44200
sw t0, 4(x0)
addi t0, x0, 0x244
sw t0, 8(x0)

# TODO: complete the gcd(a, b) function
#   read a from memory location 0;
#   the most significant byte of b is located at memory location 9,
#   the next byte is at address 8,
#   the next byte is at 7,
#   and the least significant byte is at location 6;
#   place the output of algorithm in t0
# Initialize a to t0:
lw t0, 0(zero)
# Initialize b to t1:
# We shift each byte by one so we can load the word properly:
lb t3, 6(zero)
sb t3, 4(zero)

lb t3, 7(zero)
sb t3, 5(zero)

lb t3, 8(zero)
sb t3, 6(zero)

lb t3, 9(zero)
sb t3, 7(zero)

lw t1, 4(zero)

# Check if we should leave the loop:
loop:
slt t3, zero, t0
beq t3, zero, end
slt t3, zero, t1
beq t3, zero, end

# Swap a and b if b > a:
slt t3, t0, t1
beq t3, zero, skip_if
    sw t0, 0(zero)
    sw t1, 4(zero)
    lw t0, 4(zero)
    lw t1, 0(zero)
skip_if:
# Our c will be t3:
sub t3, t0, t1
# Set a equal to b:
add t0, t1, zero
add t1, t3, zero
# Go to loop start:
beq zero, zero, loop
end:
## expect[5] = 0x00000d52
`;
        expect(strict_parser.parse(gcd_prog));

        console.log(string_of_code(gcd_prog));

        const inline_label_test = `skibidi: addi x12, x12, 1
`;
        expect(strict_parser.parse(inline_label_test));
        console.log(string_of_code(inline_label_test));
    });
});
