export type ContentPass = {
    id: number;
    user_id: number;
    name: string;
    description: string;
    amount: number;
}

export const fillableColumns = [
    'user_id',
    'name',
    'description',
    'amount',
];