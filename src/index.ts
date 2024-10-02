// Some of this code is stolen from my older projects...
import { basicSetup, EditorView } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { materialDark } from '@uiw/codemirror-theme-material';

import MyModule from './output';
import { riscv } from './syntax';
const Module = MyModule();
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
    'x8 (s0/fp)',
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
const reg_vals: bigint[] = new Array(32).fill(0n);

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
        input_element.value = String(init_value);
        input_element.className =
            'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 m-1 p-0.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500';

        const label = document.createElement('label');
        label.textContent = `${mnemonic} = `;

        const row = document.createElement('div');
        row.appendChild(label);
        row.appendChild(input_element);
        row.className = 'flex justify-between';
        return row;
    };

    const create_column = (startIndex: number) => {
        const column = document.createElement('div');
        column.className = 'w-1/2 max-w-80'; // Make each column take half the width

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

    // Create a container for the two columns
    const container = document.createElement('div');
    container.className = 'flex';

    // Create the left column
    const leftColumn = create_column(0);
    container.appendChild(leftColumn);

    // Create the right column
    const rightColumn = create_column(16);
    container.appendChild(rightColumn);

    // Append the container to the table body
    table_body.appendChild(container);
};

const sync_registers = () => {};

// This is a really sus interface between the two things.
// @ts-ignore
window.interpreter = {
    set_line: (input: string) => {
        const log_view = document.getElementById('logs');
        if (!log_view) throw new Error('No log view');
        const message = document.createElement('p');
        message.textContent = input;
        log_view.append(message);
    },
    set_register: (reg_id: number, value: bigint) => {
        const regs = document.getElementById('registers')?.children;
        if (!regs) throw new Error('No registers element!!');
        const input = regs
            .item(reg_id)
            ?.querySelector('input') as HTMLInputElement;
        if (input) input.value = value.toString();
    },
};

// @ts-ignore
Module.then((mod) => {
    append_register_rows(registers, document.getElementById('registers'));
    const editor = new EditorView({
        doc: `# Type your code here...
addi x1, x0, 2047
addi x1, x1, 1363
# x1 = 3410 :)`,
        extensions: [basicSetup, materialDark, StreamLanguage.define(riscv)],
        parent: document.getElementById('editor')!,
    });
    const set_register = mod.cwrap('set_register', 'void', [
        'number',
        'bigint',
    ]);
    const set_memory = mod.cwrap('set_memory', 'void', ['number', 'bigint']);
    const prepare_code = mod.cwrap('prepare_code', 'number', []);
    const run_code = mod.cwrap('run_code', 'number', []);
    const free_code = mod.cwrap('free_code', 'void', []);

    window.addEventListener('click', async (event) => {
        const target = event.target;
        if (!target || !(target instanceof HTMLElement)) {
            console.error("This shouldn't happen...");
            console.error(target);
            return;
        }
        if (target.matches('#run')) {
            if (!(target instanceof HTMLButtonElement)) return;

            mod.FS.writeFile('input.asm', editor.state.doc.toString());
            prepare_code();
            let prev_pc = -1;
            let pc = 0;
            target.disabled = true;
            while (pc != prev_pc && pc != -2147483648) {
                prev_pc = pc;
                // Run at approx. 32 hz.
                await sleep(1000 / 32);
                pc = run_code();
                console.log(pc);
            }
            free_code();
            target.disabled = false;
        } else if (target.matches('#reset')) {
        } else if (target.matches('#stop')) {
        } else if (target.matches('#step')) {
        }
    });
});
