import { ProcessedUserGithubPaymentLog, UserGithubPaymentLog } from "./userGithubPaymentLog";
import { ProcessedUserGithubTier, UserGithubTier } from "./userGithubTier";

export type UserGithubSetting = {
    id: number;
    user_id: number;
    repo_link: string;
    start_monitoring_at?: string;
    whitelists: string[];
    tiers: ProcessedUserGithubTier[];
    logs: ProcessedUserGithubPaymentLog[];
}

export const fillableColumns = [
    'id',
    'user_id',
    'repo_link',
    'start_monitoring_at',
];