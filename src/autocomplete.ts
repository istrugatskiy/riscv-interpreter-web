import {
    core_macros,
    pseudo_macros,
    string_of_def_macro,
    reg_name_to_id,
    label_table_from_tree,
} from '@istrugatskiy/riscv-compiler';
import {
    autocompletion,
    CompletionContext,
    snippetCompletion,
} from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';

export const reg_completions = Array.from(reg_name_to_id.entries()).map(
    ([reg_name, reg_num]) => ({
        label: reg_name,
        detail: 'Register',
        type: 'Register',
        ...(reg_name.startsWith('x')
            ? {}
            : { info: `(x${reg_num.toString()})` }),
    })
);

export const macro_completions = [...core_macros, ...pseudo_macros].map(
    (macro) =>
        snippetCompletion(
            macro.name + (macro.arglist_type.length === 0 ? '' : ' '),
            {
                label: macro.name,
                detail: `: ${string_of_def_macro(macro)} (${core_macros.includes(macro) ? 'Core' : 'Pseudo'})`,
                type: 'MacroName',
            }
        )
);

/**
 * We can only autocomplete three potential things:
 * - Registers
 * - Macro names
 * - Label names
 */
const complete_riscv = (context: CompletionContext) => {
    const tree = syntaxTree(context.state);
    const node_before = syntaxTree(context.state).resolveInner(context.pos, -1);

    if (node_before.name === 'Comment') {
        return null;
    }

    if (node_before.name === 'MacroName' || node_before.name === 'LabelDef') {
        return { from: node_before.from, options: macro_completions };
    }

    // TODO: ImmRegister
    if (
        node_before.name === 'MacroExpr' ||
        node_before.parent?.name === 'ArgList'
    ) {
        const macro_name_node =
            node_before.name === 'MacroExpr'
                ? node_before.getChild('MacroName')
                : node_before.parent?.prevSibling;
        if (!macro_name_node || macro_name_node.name !== 'MacroName') {
            return null;
        }

        let total_current_args = 0;
        let prev_sibling = node_before;
        while (prev_sibling.name !== 'MacroExpr' && prev_sibling.prevSibling) {
            prev_sibling = prev_sibling.prevSibling;
            total_current_args++;
        }

        const macro_name = context.state.sliceDoc(
            macro_name_node.from,
            macro_name_node.to
        );
        const potential_macro = [...core_macros, ...pseudo_macros].find(
            ({ name, arglist_type }) =>
                macro_name === name && total_current_args < arglist_type.length
        );
        if (potential_macro === undefined) {
            return null;
        }

        const arg_to_complete =
            potential_macro.arglist_type[total_current_args];
        if (
            arg_to_complete === undefined ||
            arg_to_complete.name === 'Immediate'
        ) {
            return null;
        }

        if (
            arg_to_complete.name === 'LabelName' ||
            arg_to_complete.name === 'Register'
        ) {
            const base_completion =
                arg_to_complete.name === 'Register'
                    ? reg_completions
                    : Array.from(
                          label_table_from_tree(
                              tree,
                              context.state.doc.toString()
                          ).keys()
                      ).map((label) => ({
                          label,
                          detail: 'Label',
                          type: 'LabelName',
                      }));

            return {
                from:
                    node_before.name === 'MacroExpr'
                        ? node_before.to
                        : node_before.from,
                options:
                    total_current_args + 1 ===
                    potential_macro.arglist_type.length
                        ? base_completion
                        : base_completion.map((completion) => ({
                              ...completion,
                              apply: `${completion.label}, `,
                          })),
            };
        }
    }

    return null;
};

export const autocomplete_riscv = () =>
    autocompletion({
        override: [complete_riscv],
    });
