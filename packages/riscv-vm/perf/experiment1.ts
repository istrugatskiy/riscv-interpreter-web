import { compile_riscv } from '@istrugatskiy/riscv-compiler';
import { VirtualMachine } from '../src/vm';

// Thanks chatgpt...
const code = `li sp, 0x8000
li ra, 0x400
li a0, 41

fib:
    addi    sp, sp, -32        # allocate stack frame (keep 16-byte alignment)
    sd      ra, 24(sp)         # save return address
    sd      a0, 16(sp)         # save original n

    li      t0, 1
    ble     a0, t0, .fib_base  # if n <= 1 -> return n (in a0)

    # compute fib(n-1)
    addi    a0, a0, -1
    call    fib
    sd      a0, 8(sp)          # save fib(n-1) at sp+8

    # compute fib(n-2)
    ld      a0, 16(sp)         # reload original n
    addi    a0, a0, -2
    call    fib                # returns fib(n-2) in a0

    ld      t1, 8(sp)          # t1 = fib(n-1)
    add     a0, a0, t1         # a0 = fib(n-2) + fib(n-1)
    j       .fib_done

.fib_base:
    # a0 already contains n (0 or 1) — return as-is
.fib_done:
    ld      ra, 24(sp)         # restore ra
    addi    sp, sp, 32         # deallocate stack frame
    ret`;

console.time('Compile');
const program = compile_riscv(code);
console.timeEnd('Compile');

const registers = [];

for (let i = 0; i < 32; i++) {
    registers.push(0n);
}

console.time('Make VM');
const vm = new VirtualMachine(
    program as Program,
    registers as Tuple<bigint, 32>
);
console.timeEnd('Make VM');

console.time('Execute');
for (let i = 0; i < 25_000_000; i++) {
    const result = vm.step();
    if (!result.at(2)) {
        console.log('stopped early');
        break;
    }
}
console.timeEnd('Execute');

console.log(vm.registers.at(10));
