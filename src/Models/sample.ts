export type Sample = {
    id: number;
    account: string;
    migration_link: string;
}

export const fillableColumns = [
    'account',
    'migration_link',
];