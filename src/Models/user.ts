import { ProcessedContent } from "./content";
import { ProcessedContentPass } from "./contentPass";
import { ProcessedMail } from "./mail";
import { MailingList } from "./mailingList";
import { MailingListBroadcast } from "./mailingListBroadcast";
import { MailingListSubscriber } from "./mailingListSubscriber";
import { UserGithubSetting } from "./userGithubSetting";
import { ProcessedUserReservation } from "./userReservation";
import { ProcessedUserReservationSetting } from "./userReservationSetting";
import { UserTier } from "./userTier";
import { Webhook } from "./webhook";

export type User = {
    id: number;
    address: string;
    username: string;
    calendar_advance_days: number;
    display_name?: string;
    profile_picture?: string;
    email_address?: string;
    facebook?: string;
    twitter?: string;
    twitch?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    tiers?: UserTier[];
    mails?: ProcessedMail[];
    mailingList?: MailingList;
    broadcasts?: MailingListBroadcast[];
    subscriptions?: MailingListSubscriber[];
    reservations?: ProcessedUserReservation[];
    reservationSettings?: ProcessedUserReservationSetting[];
    contents?: ProcessedContent[];
    contentPasses?: ProcessedContentPass[];
    webhooks?: Webhook[];
    githubSettings?: UserGithubSetting[];
    is_verified: boolean;
}

export type PublicUser = {
    id: number;
    username: string;
    display_name: string;
    profile_picture?: string;
    facebook: string;
    instagram: string;
    twitter: string;
    twitch: string;
    tiktok: string;
    youtube: string;
    calendar_advance_days: number;
    mailingList?: MailingList;
    contents?: ProcessedContent[];
    contentPasses?: ProcessedContentPass[];
    tiers?: UserTier[];
    is_verified: boolean;
}

export type HomepageUser = {
    username: string;
    display_name: string;
    profile_picture?: string;
    value_usd: number;
    is_verified: boolean;
}

export const fillableColumns = [
    'id',
    'address',
    'username',
    'display_name',
    'profile_picture',
    'email_address',
    'facebook',
    'twitter',
    'twitch',
    'instagram',
    'tiktok',
    'youtube',
    'calendar_advance_days',
    'is_verified',
];