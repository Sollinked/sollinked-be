import { ProcessedUserGithubPaymentLog, UserGithubPaymentLog } from "./userGithubPaymentLog";
import { ProcessedUserGithubTier, UserGithubTier } from "./userGithubTier";

export type UserGithubSetting = {
    id: number;
    user_id: number;
    repo_link: string;
    uuid: string;
    last_synced_at?: string;
    behavior: 'mark' | 'close',
    is_active: boolean;
    whitelists: string[];
    tiers: ProcessedUserGithubTier[];
    logs: ProcessedUserGithubPaymentLog[];
}

export const fillableColumns = [
    'id',
    'user_id',
    'repo_link',
    'uuid',
    'last_synced_at',
    'behavior',
    'is_active',
];