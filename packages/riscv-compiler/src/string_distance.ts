/**
 * See https://en.wikipedia.org/wiki/Levenshtein_distance#Iterative_with_two_matrix_rows
 */
export const str_distance = (s: string, t: string) => {
    const m = s.length,
        n = t.length;
    let v0: number[] = [],
        v1: number[] = [];

    for (let i = 0; i <= n; i++) {
        v0[i] = i;
    }

    for (let i = 0; i < m; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < n; j++) {
            const deletion_cost = (v0[j + 1] ?? 0) + 1;
            const insertion_cost = (v1[j] ?? 0) + 1;
            const substition_cost =
                s[i] === t[j] ? (v0[j] ?? 0) : (v0[j] ?? 0) + 1;
            v1[j + 1] = Math.min(
                deletion_cost,
                insertion_cost,
                substition_cost
            );
        }

        const temp_v0 = v0;
        v0 = v1;
        v1 = temp_v0;
    }

    return v0[n] ?? 0;
};
