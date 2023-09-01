import * as mailController from '../../Controllers/mailController';
import * as userController from '../../Controllers/userController';
import * as userTierController from '../../Controllers/userTierController';
import * as webhookController from '../../Controllers/webhookController';
import moment from 'moment';
import { createEmailForwarder, deleteAttachments, getEmailByMessageId, mapAttachments, sendEmail } from '../../Mail';
import { getAddressUSDCBalance } from '../../Token';
import { v4 as uuidv4 } from 'uuid';
import { getMailCredentials, sendSOLTo } from '../../../utils';

export const processPayments = async() => {
    let credentials = getMailCredentials();
    let createdAfter = moment().add(-2, 'd').format('YYYY-MM-DD')
    let mails = await mailController.find({
        is_processed: false,
    }, createdAfter);

    let uuid = uuidv4();
    let bcc_to_email = `${uuid}@${credentials.domain}`;

    // no mails
    if(!mails) {
        console.log('process payment', 'no unprocessed mails');
        return;
    }

    for(const [index, mail] of mails.entries()) {
        let tokenBalance = await getAddressUSDCBalance(mail.tiplink_public_key);
        if(tokenBalance === 0) {
            continue;
        }

        let user = await userController.view(mail.user_id);
        let tiers = await userTierController.find({ user_id: mail.user_id });

        if(!user) {
            console.log('process payment', 'no user');
            continue;
        }
        
        if(!user.email_address) {
            console.log('process payment', 'no email address');
            continue;
        }

        if(!tiers) {
            console.log('process payment', 'no tier');
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

            await sendEmail({
                to: user.email_address,
                subject: `Received ${tokenBalance} USDC from ${from}: ${subject ?? "No Subject"}`,
                text: `${text}\n\n\n-------------------\nSollinked BCC Email Address: ${bcc_to_email ?? ""}\n\nOR\n\nClick this link to reply: mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}`,
                textAsHtml: `${textAsHtml}\n\n\n<p>-------------------</p>\n<p>Sollinked BCC Email Address: ${bcc_to_email ?? ""}</p>\n\n<p>OR</p>\n\n<p>Click this link to reply: <a href="mailto:${mail.from_email}?bcc=${bcc_to_email ?? ""}&subject=${subject ?? "No Subject"}">Reply</a></p>`,
                attachments,
            });

            let processed_at = moment().format('YYYY-MM-DD HH:mm:ss');
            let expiry_date = moment().add(tier.respond_days, 'd').format('YYYY-MM-DDTHH:mm:ssZ');
            let utc_expiry_date = moment().utc().add(tier.respond_days, 'd').format('YYYY-MM-DD HH:mm');

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

            // dont process the rest of the tiers
            break;
        }
    } 
}