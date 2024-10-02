/**
 * Map human-readable registers to an index based representations.
 */

export const defs = Array.from({ length: 32 }, (_, idx) => `x${idx}`).reduce(
    (map, val, idx) => map.set(val, idx),
    new Map<string, number>()
) as ReadonlyMap<string, number>;
const abis = [
    'zero',
    'ra',
    'sp',
    'gp',
    'tp',
    't0',
    't1',
    't2',
    's0',
    's1',
    'a0',
    'a1',
    'a2',
    'a3',
    'a4',
    'a5',
    'a6',
    'a7',
    's2',
    's3',
    's4',
    's5',
    's6',
    's7',
    's8',
    's9',
    's10',
    's11',
    't3',
    't4',
    't5',
    't6',
].reduce(
    (map, val, idx) => map.set(val, idx),
    new Map<string, number>()
) as ReadonlyMap<string, number>;
export const abi_map = new Map([...abis, ...defs]).set('fp', 8) as ReadonlyMap<
    string,
    number
>;
