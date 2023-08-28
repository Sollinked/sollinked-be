import { simpleParser } from 'mailparser';
import { TipLink } from '@tiplink/api';
import { getImap, sendEmail } from '../../../src/Mail';
import * as controller from '../../../src/Controllers/mailController';
import * as userController from '../../Controllers/userController';
import * as userTierController from '../../Controllers/userTierController';
import { getMailCredentials } from '../../../utils';
import moment from 'moment';
    
export const processEmails = () => {
    const imap = getImap();
    const credentails = getMailCredentials();

    try {
        imap.once('ready', () => {
            // on ready
            imap.openBox('INBOX', false, () => {
                // open inbox
                imap.search([
                    'UNSEEN',
                    [
                        'SINCE',
                        new Date(),
                    ]
                ], (err, results) => {
                    try {
                        const f = imap.fetch(results, { bodies: '' });
                        f.on('message', msg => {
                            msg.on('body', stream => {
                                simpleParser(stream, async(err, parsed) => {
                                    /* console.log(parsed); */
                                    const { from, to, subject, textAsHtml, text, messageId } = parsed;
    
                                    if(!from) {
                                        console.log('cant find from address');
                                        return;
                                    }
    
                                    if(!to) {
                                        console.log('cant find to address');
                                        return;
                                    }
    
                                    if(!messageId) {
                                        console.log('cant find message id');
                                        return;
                                    }
    
                                    let fromEmailMatch = from.text.match(/[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g);
                                    if(!fromEmailMatch || fromEmailMatch.length === 0){
                                        console.log('cant find from email');
                                        return;
                                    }
    
                                    let toText = Array.isArray(to)? to.map(x => x.text).join(", ") : to.text;
    
                                    let toEmailMatch = toText.match(/[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g);
                                    if(!toEmailMatch || toEmailMatch.length === 0){
                                        console.log('cant find to email');
                                        return;
                                    }
    
                                    let returnToEmail = fromEmailMatch[0];
                                    let toEmail = toEmailMatch[0];
                                    let username = toEmail.replace(`@${credentails.domain}`, "");
                                    
                                    let users = await userController.find({ username });
                                    if(!users || users.length === 0){
                                        console.log('cant find user');
                                        return;
                                    }
    
                                    // we process emails here
                                    const tiplink = await TipLink.create();
    
                                    // save from, to, messageId and tiplink url to db
                                    await controller.create({
                                        user_id: users[0].id,
                                        from_email: returnToEmail,
                                        to_email: toEmail,
                                        message_id: messageId,
                                        tiplink_url: tiplink.url.toString(),
                                        tiplink_public_key: tiplink.keypair.publicKey.toBase58(),
                                    });

                                    // need to include guide to deposit?
                                    let returnText = `Please deposit USDC (Solana) to the Solana Address below for a guaranteed audience\n${tiplink.keypair.publicKey.toBase58()}.\nPlease deposit by ${moment().add(2, 'd').utc().format('YYYY-MM-DD HH:mm:ss')}, deposits after this date will not be processed.`;
                                    let userTiers = await userTierController.find({ user_id: users[0].id });
                                    if(userTiers && userTiers.length > 0){
                                        returnText += "\n\nThey will reply in:";

                                        userTiers.forEach((tier, index) => {
                                            console.log(tier);
                                            returnText += `\n${index + 1}. ${tier.respond_days} days for ${parseFloat(tier.value_usd).toFixed(2)} USDC`;
                                        });

                                        returnText += "\n\nFunds will be returned if they did not reply.";
                                    }
                                    
                                    await sendEmail({
                                        to: returnToEmail,
                                        subject: subject ?? "Re:",
                                        text: returnText,
                                        inReplyTo: messageId, // have to set this to reply to message in a thread
                                        references: messageId, // have to set this to reply to message in a thread
                                    });
                                })
                            })
                            msg.once('attributes', attrs => {
                                const {uid} = attrs;
                                imap.addFlags(uid, ['\\Seen'], () => {
                                    // do nothing
                                });
                            });
                        });
    
                        f.once('error', e => {
                            console.log('error encountered 3')
                            console.log(e); 
                        });
    
                        f.once('end', () => {
                            // fetched all messages
                            imap.end();
                        });
                    }

                    catch(e: any) {
                        if(!e.message.includes("Nothing to fetch")) {
                            console.log('error encountered 4');
                            console.log(e.message);
                        }
                        imap.end();
                    }
                })
            });
        });

        imap.once('error', (err: any) => {
            console.log('error encountered 1')
            console.log(err);
        });

        imap.once('end', () => {
            // console.log('connection ended');
        });

        imap.connect();
    }

    catch (e: any){
        console.log('error encountered 2')
        console.log(e);
    }
}