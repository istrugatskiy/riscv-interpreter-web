export class label_table extends Map<string, bigint> {
    set(key: string, value: bigint) {
        return super.set(key.toLowerCase(), value);
    }

    get(key: string) {
        return super.get(key.toLowerCase());
    }

    has(key: string) {
        return super.has(key.toLowerCase());
    }
}
