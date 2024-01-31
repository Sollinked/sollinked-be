import { ProcessedContentPass } from "./contentPass";

export type Content = {
    id: number;
    user_id: number;
    content_pass_ids: number[];
    content: string;
    title: string;
    slug: string;
    description: string;
    value_usd: string;
    is_free: boolean;
    status: 'draft' | 'published';
    deleted_at?: string;
    updated_at: string;
    paymentlink_id?: string;
}

export type ProcessedContent = {
    id: number;
    user_id: number;
    content_pass_ids: number[];
    content: string;
    title: string;
    slug: string;
    description: string;
    value_usd: number;
    is_free: boolean;
    status: 'draft' | 'published';
    deleted_at?: string;
    updated_at: string;
    paymentlink_id?: string;

    // generated
    contentPasses?: ProcessedContentPass[];
}

export const fillableColumns = [
    'id',
    'user_id',
    'content_pass_ids',
    'content',
    'title',
    'slug',
    'description',
    'value_usd',
    'is_free',
    'status',
    'deleted_at',
    'updated_at',
    'paymentlink_id',
];