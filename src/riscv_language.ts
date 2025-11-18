/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Adds RISC-V language support to codemirror. Previously, this LRLanguage definition was in a separate module.
 * Since LRLanguage changes from codemirror version to codemirror version, this would lead to really weird and
 * hard-to-debug bugs with peer dependencies. At some point, I found it easier to inline the short language
 * snippet into the actual UI code, since that is its main purpose. I recommend future users of codemirror
 * do the same.
 */

import {
    foldInside,
    foldNodeProp,
    indentNodeProp,
    LRLanguage,
} from '@codemirror/language';
import { riscv_parser } from '@istrugatskiy/riscv-compiler';
import { styleTags, tags } from '@lezer/highlight';

export const riscv_language = LRLanguage.define({
    name: 'riscv',
    parser: riscv_parser.configure({
        props: [
            styleTags({
                Comment: tags.lineComment,
                Register: tags.variableName,
                Immediate: tags.number,
                LabelName: tags.propertyName,
                MacroName: tags.macroName,
            }),
            indentNodeProp.add({
                Application: (context) =>
                    context.column(context.node.from) + context.unit,
            }),
            foldNodeProp.add({
                Application: foldInside,
            }),
        ],
    }),
    languageData: {
        commentTokens: { line: '#' },
    },
});
