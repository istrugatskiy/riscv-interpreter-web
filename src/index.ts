// Some of this code is stolen from my older projects...
import { basicSetup, EditorView } from 'codemirror';
import { materialDark } from '@uiw/codemirror-theme-material';

import { riscv } from '@istrugatskiy/riscv-highlighter';
import { VirtualMachine } from '@istrugatskiy/riscv-vm';
import {
    compile_riscv,
    core_macros,
    DefMacroExpr,
    mk_error_string,
    pseudo_instructions,
    string_of_def_macro,
} from '@istrugatskiy/riscv-parser';
import { log_error, log_msg } from './log_manager';
import { linter } from '@codemirror/lint';
import {
    autocompletion,
    completeFromList,
    snippetCompletion,
} from '@codemirror/autocomplete';
import { abi_map } from '@istrugatskiy/riscv-parser/src/register_abis';
/**
 * Sleeps for a given amount of time the current "thread".
 * @param ms - The amount of time to sleep in milliseconds.
 * @returns A promise that resolves after the given amount of time (approximately).
 */
export const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Clamps a number between two values.
 *
 * @param num The number to clamp.
 * @param min The minimum value that the number can be.
 * @param max The maximum value the number can be.
 * @returns The number clamped between the two specified values.
 */
export const clamp = (num: bigint, min: bigint, max: bigint) =>
    num <= min ? min : num >= max ? max : num;

const registers = [
    'x0 (zero)',
    'x1 (ra)',
    'x2 (sp)',
    'x3 (gp)',
    'x4 (tp)',
    'x5 (t0)',
    'x6 (t1)',
    'x7 (t2)',
    'x8 (fp)',
    'x9 (s1)',
    'x10 (a0)',
    'x11 (a1)',
    'x12 (a2)',
    'x13 (a3)',
    'x14 (a4)',
    'x15 (a5)',
    'x16 (a6)',
    'x17 (a7)',
    'x18 (s2)',
    'x19 (s3)',
    'x20 (s4)',
    'x21 (s5)',
    'x22 (s6)',
    'x23 (s7)',
    'x24 (s8)',
    'x25 (s9)',
    'x26 (s10)',
    'x27 (s11)',
    'x28 (t3)',
    'x29 (t4)',
    'x30 (t5)',
    'x31 (t6)',
] as const;

const bigint_to_string = (num: bigint, radix: 'hex' | 'binary' | 'decimal') => {
    const val = BigInt.asUintN(64, num);
    if (radix == 'hex') return `0x${val.toString(16)}`;
    if (radix == 'binary') return `0b${val.toString(2)}`;
    return BigInt.asIntN(64, val).toString();
};

const append_register_rows = (table_body: HTMLElement | null) => {
    if (!table_body) return;

    const create_column = (start_index: IntRange<0, 17>) => {
        const column = document.createElement('div');
        column.className = 'flex flex-col';

        const fragment = document.createDocumentFragment();
        for (let i = start_index; i < start_index + 16; i++) {
            const mnemonic = registers[i as IntRange<0, 32>];
            if (mnemonic == 'x0 (zero)') {
                const sus_div = document.createElement('div');
                sus_div.textContent = 'x0 (zero) = 0';
                fragment.appendChild(sus_div);
                continue;
            }
            const input_element = document.createElement('input');
            input_element.type = 'text';
            input_element.id = `reg_${mnemonic}`;
            input_element.value = '0x0';
            // TODO: fix with tailwind classes.
            input_element.className =
                'text-center inline-block max-w-40 bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 m-1 p-0.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500';

            const label = document.createElement('label');
            label.textContent = `${mnemonic} =`;
            label.htmlFor = input_element.id;

            const row = document.createElement('div');
            row.appendChild(label);
            row.appendChild(input_element);
            row.className = 'flex justify-end max-w-80';
            fragment.appendChild(row);
        }

        column.appendChild(fragment);
        return column;
    };

    const container = document.createElement('div');
    container.className = 'flex justify-evenly flex-wrap';

    const left_column = create_column(0);
    container.appendChild(left_column);

    const right_column = create_column(16);
    container.appendChild(right_column);

    table_body.appendChild(container);
};

const update_mem_view = (memory: ReadonlyMap<bigint, bigint> | undefined) => {
    const offset_el = document.getElementById('offset');
    if (offset_el !== null && offset_el instanceof HTMLInputElement) {
        try {
            const rounded = clamp(
                BigInt(offset_el.value),
                0n,
                0x7fffffffffffffffn
            );
            offset_el.value = rounded.toString(10);
        } catch {
            offset_el.value = '0';
        }
        const val = BigInt(offset_el.value);
        const mem_values = document.getElementById('mem-values');
        if (!mem_values) {
            console.error('No memory values, unable to sync memory view');
            console.error(memory);
            return;
        }
        mem_values.replaceChildren();
        // Much easier than having to do for loop algebra and generating the memory address
        // offset on the fly (pretty much impossible to screw up).
        let offset_counter = val;
        for (let line_offset = 0n; line_offset < 4n; line_offset++) {
            const mem_row = document.createElement('p');
            mem_row.textContent = '';
            for (let block_offset = 0n; block_offset < 5n; block_offset++) {
                for (let byte_offset = 0n; byte_offset < 4; byte_offset++) {
                    mem_row.textContent += BigInt.asUintN(
                        8,
                        memory?.get(offset_counter) ?? 0n
                    )
                        .toString(16)
                        .padStart(2, '0');
                    offset_counter++;
                }
                mem_row.textContent += ' ';
            }
            mem_values.append(mem_row);
        }
    }
};
let current_radix: 'hex' | 'binary' | 'decimal' = 'hex';

window.addEventListener('load', () => {
    // This allows code to be preserved across reloads.
    const saved_code =
        localStorage.getItem('code') ??
        `# Type your code here...
addi x1, x0, 2047
addi x1, x1, 1363
# x1 = 3410 :)`;
    update_mem_view(undefined);
    append_register_rows(document.getElementById('registers'));
    const get_line_range = (line_no: number, code: string) => {
        let from = 0,
            current_line = 0;

        for (let i = 0; i < code.length; i++) {
            const ch = code.charAt(i);

            if (current_line === line_no && ch === '\n') {
                return { from, to: i };
            } else if (ch === '\n') {
                current_line++;
                from = i + 1;
            }
        }

        return { from, to: code.length };
    };
    const riscv_linter = linter((view) => {
        const code = view.state.doc.toString();
        const compiled_code = compile_riscv(code);
        if (compiled_code.every((item) => 'error_type' in item)) {
            return compiled_code.map((error) => ({
                severity: 'error',
                ...get_line_range(error.line - 1, code),
                message: mk_error_string(error),
            }));
        }
        return [];
    });

    const reg_completions = Array.from(abi_map.entries()).map(
        ([reg_name, reg_num]) => ({
            label: reg_name,
            detail: 'Register',
            type: 'Register',
            ...(reg_name.startsWith('x')
                ? {}
                : { info: `(x${reg_num.toString()})` }),
        })
    );
    const macro_completions = [...core_macros, ...pseudo_instructions].map(
        (macro) =>
            snippetCompletion(
                `${macro.name} ${macro.arglist_type.map(({ name }, arg_idx) => (name !== 'imm_register' ? `#{${name}${arg_idx.toString()}}` : `#{imm${arg_idx.toString()}}(#{reg${arg_idx.toString()}})`)).join(', ')}`.trim(),
                {
                    label: `${macro.name} ${macro.arglist_type.map(({ name }) => (name !== 'imm_register' ? name : 'imm(reg)')).join(', ')}`.trim(),
                    detail: `: ${string_of_def_macro(macro)} (${(core_macros as DefMacroExpr[]).includes(macro) ? 'Core' : 'Pseudo'})`,
                    type: 'MacroName',
                }
            )
    );
    const riscv_language = riscv().language;

    const editor = new EditorView({
        doc: saved_code,
        extensions: [
            basicSetup,
            materialDark,
            riscv_language,
            autocompletion({
                override: [
                    completeFromList([
                        ...reg_completions,
                        ...macro_completions,
                    ]),
                ],
            }),
            riscv_linter,
            EditorView.updateListener.of((v) => {
                localStorage.setItem('code', v.state.doc.toString());
            }),
        ],
        parent: document.getElementById('editor') ?? undefined,
    });

    const get_button = (id: string) =>
        document.getElementById(id) as HTMLButtonElement;
    const b_reset = get_button('reset');
    const b_step = get_button('step');
    const b_run = get_button('run');
    const b_stop = get_button('stop');

    const disable_all_buttons = () => {
        b_run.disabled = true;
        b_reset.disabled = true;
        b_step.disabled = true;
        b_stop.disabled = true;
        document.querySelectorAll('#registers input').forEach((input) => {
            const inp = input as HTMLInputElement;
            inp.disabled = true;
        });
    };

    // Let's not talk about this code :)
    let vm: InstanceType<typeof VirtualMachine> | undefined;

    const safe_step = () => {
        const step = () => {
            if (vm === undefined) {
                try {
                    const prog = compile_riscv(editor.state.doc.toString());
                    if (prog.every((el) => 'error_type' in el)) {
                        prog.forEach((error) => {
                            mk_error_string(error)
                                .split('\n')
                                .forEach((line) => {
                                    log_error(line);
                                });
                        });
                        return false;
                    }
                    const init_regs = [
                        0n,
                        ...Array.from(
                            document.querySelectorAll('#registers input')
                        ).map((input) => {
                            const inp = input as HTMLInputElement;
                            const val = inp.value;
                            inp.disabled = true;
                            return BigInt(val);
                        }),
                    ];
                    if (init_regs.length === 32) {
                        vm = new VirtualMachine(
                            prog,
                            init_regs as Tuple<bigint, 32>
                        );
                    } else {
                        return false;
                    }
                } catch (exc) {
                    console.error(exc);
                    if (exc instanceof Error) {
                        log_error(
                            'Unexpected error, please file an issue on GitHub.'
                        );
                        log_error(exc.message);
                        log_error('For more info see the JS console');
                    }
                    vm = undefined;
                    return false;
                }
            }
            try {
                const [line, line_no, step_again] = vm.step();
                log_msg(`[line ${line_no.toString()}]: ${line}`);
                return step_again;
            } catch (exc) {
                console.error(exc);
                if (exc instanceof Error) {
                    exc.message.split('\n').forEach((line) => {
                        log_error(line);
                    });
                }
                vm = undefined;
                return false;
            }
        };
        const ret_val = step();
        if (vm !== undefined) {
            vm.registers.forEach((value, reg_id) => {
                if (reg_id == 0) return;
                const regs = document.querySelectorAll('#registers input');
                const input = regs.item(reg_id - 1);
                if (input instanceof HTMLInputElement)
                    input.value = bigint_to_string(value, current_radix);
            });
            update_mem_view(vm.memory);
        }
        return ret_val;
    };

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    window.addEventListener('click', async (event) => {
        const target = event.target;
        if (!target || !(target instanceof HTMLElement)) {
            console.error("This shouldn't happen...");
            return;
        }

        if (target.matches('#run')) {
            disable_all_buttons();
            b_stop.disabled = false;

            let can_step_again = true;
            // This is wrong since another handler could change b_stop, without us knowing.
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            while (can_step_again && !b_stop.disabled) {
                await sleep(1000 / 64); // Run at approx. 64 Hz
                can_step_again = safe_step();
            }
            b_reset.disabled = false;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (b_stop.disabled) {
                b_step.disabled = false;
                b_run.disabled = false;
            }
            b_stop.disabled = true;
        } else if (target.matches('#reset')) {
            console.clear();
            // Reset compiler state
            vm = undefined;
            update_mem_view(undefined);
            b_reset.disabled = true;
            b_step.disabled = false;
            b_run.disabled = false;
            b_stop.disabled = true;
            document.querySelectorAll('#registers input').forEach((input) => {
                const inp = input as HTMLInputElement;
                inp.value = bigint_to_string(0n, current_radix);
                inp.disabled = false;
            });

            document.getElementById('logs')?.replaceChildren();
        } else if (target.matches('#stop')) {
            b_stop.disabled = true;
        } else if (target.matches('#step')) {
            if (!safe_step()) {
                disable_all_buttons();
            }
            b_reset.disabled = false;
        }
    });

    window.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || !(target instanceof HTMLElement)) {
            return;
        }
        if (target.matches('#view_as')) {
            if (!(target instanceof HTMLSelectElement)) {
                return;
            }
            const new_radix = target.value as 'hex' | 'binary' | 'decimal';
            current_radix = new_radix;
            for (const register of document.querySelectorAll(
                '#registers input'
            )) {
                try {
                    if (register instanceof HTMLInputElement) {
                        register.value = bigint_to_string(
                            BigInt(register.value),
                            new_radix
                        );
                    }
                } catch (exception) {
                    console.error('invalid literal');
                    console.error(exception);
                    if (register instanceof HTMLInputElement) {
                        register.value = bigint_to_string(0n, new_radix);
                    }
                }
            }
        } else if (target.matches('#offset')) {
            update_mem_view(vm?.memory);
        }
    });
});
