export type ContentCNFT = {
    id: number;
    mint_address: string;
    nft_id: number;
    content_pass_id: number;
    created_at: string;
}

export const fillableColumns = [
    'mint_address',
    'nft_id',
    'content_pass_id',
    'created_at',
];