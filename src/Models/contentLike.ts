export type ContentLike = {
    id: number;
    user_id: number;
    content_id: number;
    created_at: string;

}

export const fillableColumns = [
    'user_id',
    'content_id',
    'created_at',
];