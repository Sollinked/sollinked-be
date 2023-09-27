export type MailingListBroadcast = {
    id: number;
    user_id: number;
    title: string;
    content: string;
    created_at: string;
    execute_at: string;
    is_executing: boolean;
    is_draft: boolean;
    success_count: number;
    total_count: number;
}

export const fillableColumns = [
    'id',
    'user_id',
    'title',
    'content',
    'created_at',
    'execute_at',
    'is_executing',
    'is_draft',
];