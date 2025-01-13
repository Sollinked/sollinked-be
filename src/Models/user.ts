import { ProcessedContent } from "./content";
import { ProcessedContentPass } from "./contentPass";
import { ContentProductId } from "./contentProductId";
import { ProcessedMail } from "./mail";
import { MailAuction } from "./mailAuction";
import { MailingList } from "./mailingList";
import { MailingListBroadcast } from "./mailingListBroadcast";
import { MailingListSubscriber } from "./mailingListSubscriber";
import { UserGithubSetting } from "./userGithubSetting";
import { ProcessedUserReservation } from "./userReservation";
import { ProcessedUserReservationSetting } from "./userReservationSetting";
import { UserTag } from "./userTag";
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
    auctions?: MailAuction[];
    mailingList?: MailingList;
    broadcasts?: MailingListBroadcast[];
    subscriptions?: MailingListSubscriber[];
    reservations?: ProcessedUserReservation[];
    reservationSettings?: ProcessedUserReservationSetting[];
    contents?: ProcessedContent[];
    contentPasses?: ProcessedContentPass[];
    contentProductId?: ContentProductId;
    webhooks?: Webhook[];
    githubSettings?: UserGithubSetting[];
    tags?: UserTag[];
    is_verified: boolean;
    holiday_mode: boolean;
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
    holiday_mode: boolean;
    tags?: UserTag[];
}

export type HomepageUser = {
    id: number;
    username: string;
    display_name: string;
    profile_picture?: string;
    value_usd: number;
    is_verified: boolean;
    tags?: UserTag[];
    holiday_mode: boolean;
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
    'holiday_mode',
];