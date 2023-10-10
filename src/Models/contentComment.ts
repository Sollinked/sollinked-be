export type ContentComment = {
    id: number;
    user_id: number;
    content_id: number;
    reply_to_id?: number;
    comment: string;
    created_at: string;
    deleted_at?: string;

}

export const fillableColumns = [
    'user_id',
    'content_id',
    'reply_to_id',
    'comment',
    'created_at',
    'deleted_at',
];