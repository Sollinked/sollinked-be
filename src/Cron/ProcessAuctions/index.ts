import { simpleParser } from 'mailparser';
import { TipLink } from '@tiplink/api';
import { deleteEmailForwarder, getEmailByMessageId, getImap, mapAttachments, sendEmail } from '../../../src/Mail';
import * as mailAuctionController from '../../../src/Controllers/mailAuctionController';
import * as mailBidController from '../../../src/Controllers/mailBidController';
import * as userController from '../../Controllers/userController';
import * as userTierController from '../../Controllers/userTierController';
import { clawbackSOLFrom, getAdminAccount, getExcludeEmailDomains, getMailCredentials, sendTokensTo } from '../../../utils';
import moment from 'moment';
import { USDC_ADDRESS, USDC_DECIMALS } from '../../Constants';
import { ProcessedMail } from '../../Models/mail';
import Connection, { ImapMessage } from 'imap';
import DB from '../../DB';
import { BALANCE_ERROR_NUMBER, getAddressUSDCBalance } from '../../Token';

export const processAuctionPayments = async() => {
    console.log('processing auction payment')
    let auctions = await mailAuctionController.live(true);

    // no mails
    if(!auctions || auctions.length === 0) {
        await DB.log('ProcessAuctions', 'processAuctionPayments', 'No unprocessed auctions');
        return;
    }

    for(const auction of auctions) {
        for(const bidder of auction.bidders) {
            let tokenBalance = await getAddressUSDCBalance(bidder.tiplink_public_key!);
            
            // errored
            if(tokenBalance === null || tokenBalance === BALANCE_ERROR_NUMBER) {
                continue;
            }
        
            if(tokenBalance === 0) {
                continue;
            }

            await mailBidController.update(bidder.id!, {
                value_usd: tokenBalance,
            });
        }
    }
}