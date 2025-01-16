// Stolen and adapted from https://github.com/codewars/codemirror-riscv
// I patched it up for codemirror 6 and fixed a few minor bugs, made it look slightly better
import { simpleMode } from '@codemirror/legacy-modes/mode/simple-mode.js';

// prettier-ignore
const directives = [
  // Architecture independent directives.
  // http://sourceware.org/binutils/docs/as/Pseudo-Ops.html#Pseudo-Ops
  "abort", "align", "altmacro", "ascii", "asciz",
  "balign", "balignw", "balignl",
  "bundle_align_mode", "bundle_lock", "bundle_unlock",
  "byte", "cfi_startproc", "comm",
  "data", "def", "desc", "dim", "double",
  "eject", "else", "elseif", "end", "endef", "endfunc", "endif",
  "equ", "equiv", "eqv", "err",
  "error", "exitm", "extern", "fail", "file", "fill",
  "float", "func", "global", "gnu_attribute",
  "hidden", "hword", "ident", "if", "incbin", "include", "int",
  "internal", "irp", "irpc", "lcomm", "lflags", "line", "linkonce",
  "list", "ln", "loc", "loc_mark_labels", "local", "long",
  "macro", "mri", "noaltmacro", "nolist", "octa", "offset", "org",
  "p2align", "popsection", "previous", "print", "protected", "psize",
  "purgem", "pushsection", "quad", "reloc", "rept", "sbttl", "scl",
  "section", "set", "short", "single", "size", "skip", "sleb128",
  "space", "stab", "string", "struct", "subsection", "symver", "tag",
  "text", "title", "type", "uleb128", "val", "version", "vtable_entry",
  "vtable_inherit", "warning", "weak", "weakref", "word",
  // RISC-V
  // https://github.com/riscv-non-isa/riscv-asm-manual/blob/master/riscv-asm.md#pseudo-ops
  "2byte", "4byte", "8byte", "bss", "common", "globl",
  "dtpreldword", "dtprelword", "dword", "half",
  "insn", "macro", "endm", "option", "rodata",
  "variant_cc", "zero",
];
const directivesPattern = new RegExp('\\.(?:' + directives.join('|') + ')');

const registers = /x([0-9]|[12][0-9]|3[01])/;
const registerAbiNames =
    /zero|ra|[fsgt]p|t[0-6]|f?s(?:[0-9]|1[01])|f?a[0-7]|ft(?:[0-9]|1[01])/;

// https://github.com/riscv-non-isa/riscv-asm-manual/blob/master/riscv-asm.md#assembler-relocation-functions
// prettier-ignore
const relocationFunctions = [
  "hi", "lo", "pcrel_hi", "pcrel_lo",
  "tprel_hi", "tprel_lo", "tprel_add",
  "tls_ie_pcrel_hi", "tls_gd_pcrel_hi", "got_pcrel_hi",
];
const relocationFunctionPatterns = new RegExp(
    '%(?:' + relocationFunctions.join('|') + ')\\([^)]+\\)'
);

const instructions = (xs: string[]) =>
    new RegExp(
        '\\b(?:' +
            xs.map((x) => x.replace(/\./g, (_) => '\\.')).join('|') +
            ')\\b'
    );

// prettier-ignore
const pseudos = instructions([
  "j", "jr", "la", "lla", "lga", "li",
  "beqz", "bnez", "bgez", "blez", "bgtz", "bltz",
  "bgt", "bgtu", "ble", "bleu",
  "seqz", "snez", "sgtz", "sltz",
  "call", "tail", "fence",
  "mv", "neg", "negw", "not", "nop", "ret",
  "fabs.s", "fabs.d", "fmv.s", "fmv.d", "fneg.s", "fneg.d",
  "sext.b", "sext.h", "sext.w",
  "zext.b", "zext.h", "zext.w",
]);

// prettier-ignore
const baseI = instructions([
  // RV32I/RV64I
  "add", "addi", "and", "andi", "auipc", "beq", "bge", "bgeu", "blt", "bltu", "bne",
  "csrrc", "csrrci", "csrrs", "csrrsi", "csrrw", "csrrwi", "ebreak", "ecall", "fence",
  "fence.i", "jal", "jalr", "lb", "lbu", "lh", "lhu", "lui", "lw", "mret", "or", "ori",
  "sb", "sfence.vma", "sh", "sll", "slli", "slt", "slti", "sltiu", "sltu", "sra", "srai",
  "sret", "srl", "srli", "sub", "sw", "uret", "wfi", "xor", "xori",
  // RV64I
  "addiw", "addw", "ld", "lwu", "sd", "slliw", "sllw", "sraiw", "sraw", "srliw", "srlw",
  "subw",
]);

// prettier-ignore
const extM = instructions([
  // RV32M/RV64M
  "div", "divu", "mul", "mulh", "mulhsu", "mulhu", "rem", "remu",
  // RV64M
  "divuw", "divw", "mulw", "remuw", "remw",
]);

// prettier-ignore
const extA = instructions([
  // RV32A/RV64A
  "amoadd.w", "amoand.w", "amomax.w", "amomaxu.w", "amomin.w", "amominu.w",
  "amoor.w", "amoswap.w", "amoxor.w", "lr.w", "sc.w",
  // RV64A
  "amoadd.d", "amoand.d", "amomax.d", "amomaxu.d", "amomin.d", "amominu.d",
  "amoor.d", "amoswap.d", "amoxor.d", "lr.d", "sc.d",
]);

// prettier-ignore
const extFD = instructions([
  // RV32F/RV64D
  "fadd.d", "fadd.s", "fclass.d", "fclass.s", "fcvt.d.s", "fcvt.d.w",
  "fcvt.d.wu", "fcvt.s.d", "fcvt.s.w", "fcvt.s.wu", "fcvt.w.d", "fcvt.w.s",
  "fcvt.wu.d", "fcvt.wu.s", "fdiv.d", "fdiv.s", "feq.d", "feq.s", "fld",
  "fle.d", "fle.s", "flt.d", "flt.s", "flw", "fmadd.d", "fmadd.s", "fmax.d",
  "fmax.s", "fmin.d", "fmin.s", "fmsub.d", "fmsub.s", "fmul.d", "fmul.s",
  "fmv.w.x", "fmv.x.w", "fnmadd.d", "fnmadd.s", "fnmsub.d", "fnmsub.s", "fsd",
  "fsgnj.d", "fsgnj.s", "fsgnjn.d", "fsgnjn.s", "fsgnjx.d", "fsgnjx.s", "fsqrt.d",
  "fsqrt.s", "fsub.d", "fsub.s", "fsw",
  // RV64F
  "fcvt.l.s", "fcvt.lu.s", "fcvt.s.l", "fcvt.s.lu",
  // RV64D
  "fcvt.d.l", "fcvt.d.lu", "fcvt.l.d", "fcvt.lu.d", "fmv.d.x", "fmv.x.d",
]);

// prettier-ignore
const extC = instructions([
  // RV32C/RV64C
  "c.add", "c.addi", "c.addi16sp", "c.addi4spn", "c.addiw", "c.addw",
  "c.and", "c.andi", "c.beqz", "c.bnez", "c.ebreak",
  "c.fld", "c.fldsp", "c.flw", "c.flwsp", "c.fsd", "c.fsdsp", "c.fsw", "c.fswsp",
  "c.j", "c.jal", "c.jalr", "c.jr", "c.ld", "c.ldsp",
  "c.li", "c.lui", "c.lw", "c.lwsp", "c.mv", "c.nop", "c.or", "c.sd", "c.sdsp",
  "c.slli", "c.srai", "c.srli", "c.sub", "c.subw", "c.sw", "c.swsp", "c.xor",
]);

export const riscv = simpleMode({
    meta: {
        // Yes typescript, I am aware of how scuffed this entire thing is...
        // @ts-ignore
        lineComment: '#',
    },
    start: [
        { regex: /#.*/, token: 'comment' },

        // Labels
        { regex: /\w+:/, token: 'tag' },
        { regex: /[1-9]\d*:/, token: 'tag' },
        // Reference to local label
        { regex: /[1-9]\d*[bf]/, token: 'variable-2' },

        // Integer literal
        {
            regex: /(?<!x)(-?(?:0|[1-9]\d*|0x[0-9A-Fa-f]+))\b/,
            token: 'number',
        },
        // String literal
        { regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: 'string' },

        { regex: relocationFunctionPatterns, token: 'builtin' },

        // Directives
        { regex: directivesPattern, token: 'attribute' },
        // Instructions
        { regex: extC, token: 'builtin' },
        { regex: extFD, token: 'builtin' },
        { regex: extA, token: 'builtin' },
        { regex: extM, token: 'builtin' },
        { regex: baseI, token: 'builtin' },
        { regex: pseudos, token: 'builtin' },

        // Registers
        { regex: registers, token: 'variable-2' },
        { regex: registerAbiNames, token: 'variable-2' },
    ],
});
