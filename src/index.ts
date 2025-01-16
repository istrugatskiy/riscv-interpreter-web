// Some of this code is stolen from my older projects...
import { basicSetup, EditorView } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { materialDark } from '@uiw/codemirror-theme-material';

import { riscv } from '@istrugatskiy/riscv-highlighter';
import { VirtualMachine } from '@istrugatskiy/riscv-vm/src/vm';
import { compile_riscv } from '@istrugatskiy/riscv-parser';

/**
 * Sleeps for a given amount of time the current "thread".
 * @param ms - The amount of time to sleep in milliseconds.
 * @returns A promise that resolves after the given amount of time (approximately).
 */
export const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

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
];

const bigint_to_string = (num: bigint, radix: 'hex' | 'binary' | 'decimal') => {
    const val = BigInt.asUintN(64, num);
    if (radix == 'hex') return `0x${val.toString(16)}`;
    if (radix == 'binary') return `0b${val.toString(2)}`;
    return BigInt.asIntN(64, val).toString();
};

const append_register_rows = (
    register_mnemonics: string[],
    table_body: HTMLElement | null
) => {
    if (!table_body) return;

    const create_table_row = (init_value: number, mnemonic: string) => {
        if (mnemonic == 'x0 (zero)') {
            const sus_div = document.createElement('div');
            sus_div.textContent = 'x0 (zero) = 0';
            return sus_div;
        }
        const input_element = document.createElement('input');
        input_element.type = 'text';
        input_element.value = '0x' + init_value.toString(16);
        // TODO: fix with tailwind classes.
        input_element.className =
            'text-center inline-block max-w-40 bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 m-1 p-0.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500';

        const label = document.createElement('label');
        label.textContent = `${mnemonic} =`;

        const row = document.createElement('div');
        row.appendChild(label);
        row.appendChild(input_element);
        row.className = 'flex justify-end max-w-80';
        return row;
    };

    const create_column = (startIndex: number) => {
        const column = document.createElement('div');
        column.className = 'flex flex-col';

        const fragment = document.createDocumentFragment();
        for (let i = startIndex; i < startIndex + 16; i++) {
            if (i < register_mnemonics.length) {
                fragment.appendChild(
                    create_table_row(0, register_mnemonics[i]!)
                );
            }
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

    // Append the container to the table body
    table_body.appendChild(container);
};

const log_line = (text: string, error_color = false) => {
    const log_view = document.getElementById('logs');
    if (!log_view) throw new Error('No log view');
    // This weird height logic allows the scroll to be fixed.
    const height =
        log_view.parentElement?.scrollTop ==
        log_view.parentElement!.scrollHeight -
            log_view.parentElement!.offsetHeight;
    const message = document.createElement('p');
    message.textContent = text;
    if (error_color) {
        message.classList.add('text-red-700');
    }
    log_view.append(message);
    if (height) {
        log_view.parentElement!.scrollTop =
            log_view.parentElement!.scrollHeight;
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
    append_register_rows(registers, document.getElementById('registers'));
    const editor = new EditorView({
        doc: saved_code,
        extensions: [
            basicSetup,
            materialDark,
            StreamLanguage.define(riscv),
            EditorView.updateListener.of((v) => {
                localStorage.setItem('code', v.state.doc.toString());
            }),
        ],
        parent: document.getElementById('editor')!,
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
                    if (prog.every((el) => 'message' in el)) {
                        prog.forEach((error) =>
                            error.message
                                .split('\n')
                                .forEach((line) => log_line(line, true))
                        );
                        return false;
                    }
                    const init_regs = Array.from(
                        document.querySelectorAll('#registers input')
                    ).map((input) => {
                        const inp = input as HTMLInputElement;
                        const val = inp.value;
                        inp.disabled = true;
                        return BigInt(val);
                    });
                    vm = new VirtualMachine(prog, init_regs);
                } catch (exc) {
                    console.error(exc);
                    if (exc instanceof Error) {
                        log_line(
                            'Unexpected error, please file an issue on GitHub.',
                            true
                        );
                        log_line(exc.message, true);
                        log_line('For more info see the JS console', true);
                    }
                    vm = undefined;
                    return false;
                }
            }
            try {
                const [line, line_no, step_again] = vm.step();
                log_line(`[line ${line_no}]: ${line}`);
                return step_again;
            } catch (exc) {
                console.error(exc);
                if (exc instanceof Error) {
                    exc.message
                        .split('\n')
                        .forEach((line) => log_line(line, true));
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
                if (!regs) throw new Error('No registers element!!');
                const input = regs.item(reg_id - 1) as HTMLInputElement;
                if (input) input.value = bigint_to_string(value, current_radix);
            });
        }
        return ret_val;
    };

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
            while (can_step_again && !b_stop.disabled) {
                await sleep(1000 / 64); // Run at approx. 64 Hz
                can_step_again = safe_step();
            }
            b_reset.disabled = false;
            if (b_stop.disabled) {
                b_step.disabled = false;
                b_run.disabled = false;
            }
            b_stop.disabled = true;
        } else if (target.matches('#reset')) {
            // Reset compiler state
            vm = undefined;
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

    window.addEventListener('change', async (event) => {
        const target = event.target;
        if (!target || !(target instanceof HTMLSelectElement)) {
            return;
        }
        if (target.matches('#view_as')) {
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
                    if (register instanceof HTMLInputElement) {
                        register.value = bigint_to_string(0n, new_radix);
                    }
                }
            }
        }
    });
});
