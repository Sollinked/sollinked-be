import * as mailController from '../../Controllers/mailController';
import * as userController from '../../Controllers/userController';
import * as userTierController from '../../Controllers/userTierController';
import * as webhookController from '../../Controllers/webhookController';
import * as clientio from 'socket.io-client';
import moment from 'moment';
import { createEmailForwarder, deleteAttachments, getEmailByMessageId, mapAttachments, sendEmail } from '../../Mail';
import { BALANCE_ERROR_NUMBER, getAddressUSDCBalance } from '../../Token';
import { v4 as uuidv4 } from 'uuid';
import { getMailCredentials, getServerPort, sendSOLTo } from '../../../utils';
import DB from '../../DB';

const port = getServerPort();
let socket = clientio.connect(`ws://localhost:${port}`);
const notifyPayer = (tiplink_public_key: string) => {
    // notify payer
    if(!tiplink_public_key) {
        return;
    }

    if(!socket.connected) {
        return;
    }

    if(tiplink_public_key && socket.connected) {
        // socket connected
        socket.emit('update_mail_payment_status', { tiplink_public_key, isPaid: true });
    }
}

export const processPayments = async() => {
    let credentials = getMailCredentials();
    let createdAfter = moment().add(-2, 'd').format('YYYY-MM-DD')
    let mails = await mailController.find({
        is_processed: false,
    }, {
        createdAfter,
        onlyFromSMTP: true,
    });

    // no mails
    if(!mails) {
        let db = new DB();
        await db.log('ProcessPayments', 'processPayments', 'No unprocessed mails');
        return;
    }

    for(const [index, mail] of mails.entries()) {
        let uuid = uuidv4();
        let bcc_to_email = `${uuid}@${credentials.domain}`;
    
        let tokenBalance = await getAddressUSDCBalance(mail.tiplink_public_key);

        // errored
        if(tokenBalance === null || tokenBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        if(tokenBalance === 0) {
            continue;
        }

        let user = await userController.view(mail.user_id);
        let tiers = await userTierController.find({ user_id: mail.user_id });

        if(!user) {
            let db = new DB();
            await db.log('ProcessPayments', 'processPayments', 'No user');
            continue;
        }
        
        if(!user.email_address) {
            let db = new DB();
            await db.log('ProcessPayments', 'processPayments', `No email address: ${user.id}`);
            continue;
        }

        if(!tiers) {
            let db = new DB();
            await db.log('ProcessPayments', 'processPayments', `No tier: ${user.id}`);
            /* // user didn't set tiers, all emails are eligible
            let { from, subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(mail.message_id) as any;
            let attachments = mapAttachments(parserAttachments);

            await sendEmail({
                to: user.email_address,
                subject: subject ?? `Email from ${from}`,
                text: `${text}\n\n\n-------------------\nSollinked BCC Email Address: ${bcc_to_email ?? ""}\n\nOR\n\nClick this link to reply: mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}`,
                textAsHtml: `${textAsHtml}\n\n\n<p>-------------------</p>\n<p>Sollinked BCC Email Address: ${bcc_to_email ?? ""}</p>\n\n<p>OR</p>\n\n<p>Click this link to reply: <a href="mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}">Reply</a></p>`,
                attachments,
            }); */
            continue;
        }

        // process tiers
        // tiers are ordered by value_usd descending
        for(const [index, tier] of tiers.entries()) {
            if(tokenBalance < parseFloat(tier.value_usd)) {
                continue;
            }

            let { from, subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(mail.message_id) as any;
            let attachments = mapAttachments(parserAttachments);

            let processed_at = moment().format('YYYY-MM-DDTHH:mm:ssZ');
            let expiry_date = moment().add(tier.respond_days, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
            let utc_expiry_date = moment().utc().add(tier.respond_days, 'd').format('YYYY-MM-DD HH:mm');

            if(tier.respond_days === 0) {
                // add 12 hours instead
                expiry_date = moment().add(12, 'h').format('YYYY-MM-DDTHH:mm:ssZ');
            }

            let sent_message_id = await sendEmail({
                to: user.email_address,
                subject: `${subject ?? "No Subject"}`,
                text: `Paid: ${tokenBalance} USDC\nExpiry Date: ${utc_expiry_date} UTC\nSender: ${from}\n\n${text}`,
                textAsHtml: `<p>Paid: ${tokenBalance} USDC</p><p>Expiry Date: ${utc_expiry_date} UTC</p><p>Sender: ${from}</p><br>${textAsHtml}`,
                attachments,
                replyTo: `${uuid}@${credentials.domain}`
            });
            
            // receipt
            await sendEmail({
                to: from,
                subject: subject ?? "Re:",
                text: `Email has been sent to ${user.username}. You will be refunded if they don't reply by ${utc_expiry_date} UTC.`,
                inReplyTo: mail.message_id, // have to set this to reply to message in a thread
                references: mail.message_id, // have to set this to reply to message in a thread
            });

            // create a forwarder for responses
            // delete this forwarder once done
            await createEmailForwarder(uuid);

            // update the mail to contain the necessary info
            await mailController.update(mail.key, { 
                processed_at,
                expiry_date,
                value_usd: tokenBalance,
                is_processed: true,
                bcc_to_email,
                sent_message_id,
                subject: subject ?? "No Subject"
            });

            await sendSOLTo(true, mail.tiplink_public_key, 0.003);

            // delete attachments
            deleteAttachments(attachments);

            await webhookController.executeByUserId(mail.user_id, {
                payer: mail.from_email,
                amount: tokenBalance,
                expiry_date: utc_expiry_date + " UTC",
                bcc_to: bcc_to_email,
            });

            // notify
            notifyPayer(mail.tiplink_public_key);

            // dont process the rest of the tiers
            break;
        }
    } 
}

export const processFromSitePayments = async() => {
    let credentials = getMailCredentials();
    let createdAfter = moment().add(-1, 'h').format('YYYY-MM-DD')
    let mails = await mailController.find({
        is_processed: false,
    }, {
        createdAfter,
    });

    // no mails
    if(!mails) {
        let db = new DB();
        await db.log('ProcessPayments', 'processFromSitePayments', 'No unprocessed mails');
        return;
    }

    for(const [index, mail] of mails.entries()) {
        let uuid = uuidv4();
        let bcc_to_email = `${uuid}@${credentials.domain}`;
    
        let tokenBalance = await getAddressUSDCBalance(mail.tiplink_public_key);

        // errored
        if(tokenBalance === null || tokenBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        if(tokenBalance === 0) {
            continue;
        }

        let user = await userController.view(mail.user_id);
        let tiers = await userTierController.find({ user_id: mail.user_id });

        if(!user) {
            let db = new DB();
            await db.log('ProcessPayments', 'processPayments', 'No user');
            continue;
        }
        
        if(!user.email_address) {
            let db = new DB();
            await db.log('ProcessPayments', 'processPayments', `No email address: ${user.id}`);
            continue;
        }

        if(!tiers) {
            let db = new DB();
            await db.log('ProcessPayments', 'processPayments', `No tier: ${user.id}`);
            /* // user didn't set tiers, all emails are eligible
            let { from, subject, textAsHtml, text, attachments: parserAttachments } = await getEmailByMessageId(mail.message_id) as any;
            let attachments = mapAttachments(parserAttachments);

            await sendEmail({
                to: user.email_address,
                subject: subject ?? `Email from ${from}`,
                text: `${text}\n\n\n-------------------\nSollinked BCC Email Address: ${bcc_to_email ?? ""}\n\nOR\n\nClick this link to reply: mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}`,
                textAsHtml: `${textAsHtml}\n\n\n<p>-------------------</p>\n<p>Sollinked BCC Email Address: ${bcc_to_email ?? ""}</p>\n\n<p>OR</p>\n\n<p>Click this link to reply: <a href="mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}">Reply</a></p>`,
                attachments,
            }); */
            continue;
        }

        // process tiers
        // tiers are ordered by value_usd descending
        for(const [index, tier] of tiers.entries()) {
            if(tokenBalance < parseFloat(tier.value_usd)) {
                continue;
            }

            let processed_at = moment().format('YYYY-MM-DDTHH:mm:ssZ');
            let expiry_date = moment().add(tier.respond_days, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
            let utc_expiry_date = moment().utc().add(tier.respond_days, 'd').format('YYYY-MM-DD HH:mm');

            if(tier.respond_days === 0) {
                // add 12 hours instead
                expiry_date = moment().add(12, 'h').format('YYYY-MM-DDTHH:mm:ssZ');
            }

            let sent_message_id = await sendEmail({
                to: user.email_address,
                subject: `${mail.subject ?? "No Subject"}`,
                text: `Paid: ${tokenBalance} USDC\nExpiry Date: ${utc_expiry_date} UTC\nSender: ${mail.from_email}\n\n${mail.message}`,
                textAsHtml: `<p>Paid: ${tokenBalance} USDC</p><p>Expiry Date: ${utc_expiry_date} UTC</p><p>Sender: ${mail.from_email}</p><br>${mail.message}`,
                replyTo: `${uuid}@${credentials.domain}`
            });
            
            // receipt
            await sendEmail({
                to: mail.from_email,
                subject: mail.subject ?? "Re:",
                text: `Email has been sent to ${user.username}. You will be refunded if they don't reply by ${utc_expiry_date} UTC.`,
                inReplyTo: mail.message_id, // have to set this to reply to message in a thread
                references: mail.message_id, // have to set this to reply to message in a thread
            });

            // create a forwarder for responses
            // delete this forwarder once done
            await createEmailForwarder(uuid);

            // update the mail to contain the necessary info
            await mailController.update(mail.key, { 
                processed_at,
                expiry_date,
                value_usd: tokenBalance,
                is_processed: true,
                bcc_to_email,
                sent_message_id,
                subject: mail.subject ?? "No Subject"
            });

            await sendSOLTo(true, mail.tiplink_public_key, 0.003);

            await webhookController.executeByUserId(mail.user_id, {
                payer: mail.from_email,
                amount: tokenBalance,
                expiry_date: utc_expiry_date + " UTC",
                bcc_to: bcc_to_email,
            });

            // notify
            notifyPayer(mail.tiplink_public_key);

            // dont process the rest of the tiers
            break;
        }
    } 
}

export const processMailsWithNoResponse = async() => {
    let mails = await mailController.getExpired();
    if(!mails) {
        let db = new DB();
        await db.log('ProcessPayments', 'processMailsWithNoResponse', `No expired mails`);
        return;
    }

    for(const [index, mail] of mails.entries()) {
        const { user_id, from_email, to_email, tiplink_url, tiplink_public_key, message_id, sent_message_id, subject, is_from_site } = mail;
        let usdcBalance = await getAddressUSDCBalance(tiplink_public_key);

        // errored
        if(usdcBalance === null || usdcBalance === BALANCE_ERROR_NUMBER) {
            continue;
        }

        if(usdcBalance > 0) {
            let isNotValidId = message_id === "from site";
            let senderSubject = is_from_site? 'Email Receipt' : subject;
            
            await sendEmail({
                to: from_email,
                subject: senderSubject ?? "USDC Refund",
                inReplyTo: isNotValidId? undefined : message_id,
                references: isNotValidId? undefined : message_id,
                text: `${to_email} has failed to respond within the time limit. Please claim the refund through this link ${tiplink_url}.\n\nPlease make sure it's a Tiplink URL, you will not be asked to deposit any funds.\n\nRegards,\nSollinked.`,
            });

            let users = await userController.find({ id: user_id });
            if(sent_message_id && users && users[0].email_address) {
                await sendEmail({
                    to: users[0].email_address,
                    subject: subject ?? "Email Refunded",
                    inReplyTo: sent_message_id,
                    references: sent_message_id,
                    text: `This email has expired, the funds had been returned to the sender.`,
                });
            }
        }

        await mailController.update(mail.key, { value_usd: 0 });
    }
}