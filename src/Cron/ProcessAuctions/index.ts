import { simpleParser } from 'mailparser';
import { TipLink } from '@tiplink/api';
import { deleteEmailForwarder, getEmailByMessageId, getImap, mapAttachments, sendEmail } from '../../../src/Mail';
import * as mailAuctionController from '../../../src/Controllers/mailAuctionController';
import * as mailBidController from '../../../src/Controllers/mailBidController';
import * as userController from '../../Controllers/userController';
import * as mailController from '../../Controllers/mailController';
import { clawbackSOLFrom, closeEmptyAccounts, getAdminAccount, getExcludeEmailDomains, getMailCredentials, sendTokensTo } from '../../../utils';
import moment from 'moment';
import { USDC_ADDRESS, USDC_DECIMALS } from '../../Constants';
import { ProcessedMail } from '../../Models/mail';
import Connection, { ImapMessage } from 'imap';
import DB from '../../DB';
import { BALANCE_ERROR_NUMBER, getAddressUSDCBalance } from '../../Token';

export const processAuctionPayments = async() => {
    let auctions = await mailAuctionController.live(true, true);

    // no mails
    if(!auctions || auctions.length === 0) {
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

export const processAuctions = async() => {
    let auctions = await mailAuctionController.getUnprocessedEndedAuctions();
    let { domain } = getMailCredentials();

    // no auctions
    if(!auctions || auctions.length === 0) {
        return;
    }

    const adminAccount = getAdminAccount();
    for(const auction of auctions) {
        let bidders = await mailBidController.getBiddersForAuction(auction.id);
        let auctionUser = await userController.view(auction.user_id);

        if(bidders && bidders.length > 0) {
            let index = 0;
            for(const bidder of bidders) {
                index++;
                if(index <= auction.winner_count) {
                    //send email
                    let user = await userController.view(auction.user_id);
                    let fromUser = await userController.view(bidder.user_id);

                    await mailController.create({
                        user_id: auction.user_id,
                        from_user_id: bidder.user_id,
                        from_email: bidder.email ?? fromUser?.email_address,
                        to_email: `${user?.username}@${domain}`,
                        message_id: "from auction",
                        tiplink_url: bidder.tiplink_url,
                        tiplink_public_key: bidder.tiplink_public_key,
                        is_from_site: false,
                        is_auction: true,
                        subject: `Auction Winner: ${bidder.subject} (${bidder.value_usd} USDC)`,
                        message: bidder.message,
                    });
                    await mailBidController.update(bidder.id, { is_success: true });
                    
                    continue;
                }

                //refund
                if(Number(bidder.value_usd) > 0) {
                    try {
                        const tiplink = await TipLink.fromLink(bidder.tiplink_url);
                        await sendTokensTo(bidder.address, USDC_ADDRESS, USDC_DECIMALS, Number(bidder.value_usd), tiplink.keypair, adminAccount);
                        await mailBidController.update(bidder.id, { is_success: false });
                        await DB.log('ProcessAuctions', 'processAuctionPayments', `Refunded: ${bidder.id}`);
                        await closeEmptyAccounts(tiplink.keypair);
    
                        if(bidder.email) {
                            await sendEmail({
                                to: bidder.email,
                                subject: "You lost the auction!",
                                text: `Your bid of ${Number(bidder.value_usd)} USDC was not enough to be among the top ${auction.winner_count} in ${auctionUser!.display_name ?? auctionUser!.username}'s auction. Try again next time!\nYour bid is transferred back to your Solana address.`,
                            });
                        }
                    }

                    catch(e: any) {
                        await DB.log("ProcessAuctions", "processAuctions", `Error: ${e.toString()}`);
                    }
                }
            }
        }
        await mailAuctionController.markAsProcessed(auction.id);
    }
}

export const processAutoAuctions = async() => {
    let users = await userController.getAutoAuctionUsersWithoutOngoingAuction();
    if(!users || users.length === 0) {
        return;
    }

    let startDate = moment();
    for(const user of users) {
        let endDate = moment(startDate).add(user.auto_auction_duration, 'days');
        await mailAuctionController.create({
            start_date: startDate.utc().format('YYYY-MM-DD HH:mm:ss'),
            end_date: endDate.utc().format('YYYY-MM-DD HH:mm:ss'),
            min_bid: user.auto_auction_start_bid,
            winner_count: user.auto_auction_winner_count,
            user_id: user.id,
        });
    }
}