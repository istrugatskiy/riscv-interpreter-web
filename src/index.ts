// Some of this code is stolen from my older projects...
import { basicSetup, EditorView } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { materialDark } from '@uiw/codemirror-theme-material';

import MyModule from './output';
import { riscv } from './syntax';

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
        column.className = 'flex flex-col'; // Make each column take half the width

        const fragment = document.createDocumentFragment();
        for (let i = startIndex; i < startIndex + 16; i++) {
            if (i < register_mnemonics.length) {
                fragment.appendChild(
                    create_table_row(0, register_mnemonics[i])
                );
            }
        }

        column.appendChild(fragment);
        return column;
    };

    const container = document.createElement('div');
    container.className = 'flex justify-evenly flex-wrap';

    const leftColumn = create_column(0);
    container.appendChild(leftColumn);

    const rightColumn = create_column(16);
    container.appendChild(rightColumn);

    // Append the container to the table body
    table_body.appendChild(container);
};

const log_line = (text: string) => {
    const log_view = document.getElementById('logs');
    if (!log_view) throw new Error('No log view');
    // This weird height logic allows the scroll to be fixed.
    const height =
        log_view.parentElement?.scrollTop ==
        log_view.parentElement!.scrollHeight -
            log_view.parentElement!.offsetHeight;
    const message = document.createElement('p');
    message.textContent = text;
    log_view.append(message);
    if (height) {
        log_view.parentElement!.scrollTop =
            log_view.parentElement!.scrollHeight;
    }
};
let current_radix: 'hex' | 'binary' | 'decimal' = 'hex';

// window.interpreter is the interface used for c wasm to js register communication.
// There probably is a better way to do this?
// @ts-ignore
window.interpreter = {
    set_register: (reg_id: number, value: bigint) => {
        if (reg_id == 0) return;
        const regs = document.querySelectorAll('#registers input');
        if (!regs) throw new Error('No registers element!!');
        const input = regs.item(reg_id - 1) as HTMLInputElement;
        if (input) input.value = bigint_to_string(value, current_radix);
    },
};

const Module = MyModule({ print: log_line });

Module.then((mod) => {
    let code_prepared = false;
    let stop_requested = false;

    // This allows code to be preserved across reloads.
    const previous_value =
        localStorage.getItem('code') ??
        `# Type your code here...
addi x1, x0, 2047
addi x1, x1, 1363
# x1 = 3410 :)`;
    append_register_rows(registers, document.getElementById('registers'));
    const editor = new EditorView({
        doc: previous_value,
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
    // This pc prev_pc approach works fine, just users need to press step an extra two times.
    // I will fix it once I get the chance.
    let pc = 0;
    let prev_pc = -1;

    const set_register = mod.cwrap('set_register', 'void', [
        'bigint',
        'bigint',
    ]);

    // This function is for memory activities.
    // It needs to be fixed up soon.
    const set_memory = mod.cwrap('set_memory', 'void', ['number', 'bigint']);
    const prepare_code = mod.cwrap('prepare_code', 'number', []);
    const run_code = mod.cwrap('run_code', 'number', []);
    const free_code = mod.cwrap('free_code', 'void', []);
    const get_button = (id: string) =>
        document.getElementById(id) as HTMLButtonElement;
    const b_reset = get_button('reset');
    const b_step = get_button('step');
    const b_run = get_button('run');
    const b_stop = get_button('stop');

    const safe_prepare = () => {
        if (!code_prepared) {
            mod.FS.writeFile('input.asm', editor.state.doc.toString());
            prepare_code();
            code_prepared = true;
            pc = 0;
            prev_pc = -1;
            document
                .querySelectorAll('#registers input')
                .forEach((input, idx) => {
                    const inp = input as HTMLInputElement;
                    const val = inp.value;
                    inp.disabled = true;
                    set_register(BigInt(idx + 1), BigInt(val));
                });
        }
    };

    const safe_step = () => {
        safe_prepare();
        if (pc == prev_pc || pc == -2147483648 || stop_requested) return false;
        prev_pc = pc;
        pc = run_code();
        return true;
    };

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

    const handle_run = async () => {
        // Disable buttons during execution
        disable_all_buttons();
        stop_requested = false;

        b_stop.disabled = false;

        let can_step_again = true;
        while (can_step_again) {
            await sleep(1000 / 64); // Run at approx. 64 Hz
            can_step_again = safe_step();
        }
        if (stop_requested) {
            b_reset.disabled = false;
            b_step.disabled = false;
            b_run.disabled = false;
            b_stop.disabled = true;
            stop_requested = false;
            return;
        }
        free_code();
        code_prepared = false;

        b_reset.disabled = false;
        b_stop.disabled = true;
    };

    window.addEventListener('click', async (event) => {
        const target = event.target;
        if (!target || !(target instanceof HTMLElement)) {
            console.error("This shouldn't happen...");
            return;
        }

        if (target.matches('#run')) {
            await handle_run();
        } else if (target.matches('#reset')) {
            // Reset compiler state
            if (code_prepared) {
                free_code();
                code_prepared = false;
            }
            b_reset.disabled = true;
            b_step.disabled = false;
            b_run.disabled = false;
            b_stop.disabled = true;
            document.querySelectorAll('#registers input').forEach((input) => {
                const inp = input as HTMLInputElement;
                inp.value = bigint_to_string(0n, current_radix);
                inp.disabled = false;
            });

            document.getElementById('logs')?.replaceChildren(); // Clear logs
        } else if (target.matches('#stop')) {
            stop_requested = true;
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
