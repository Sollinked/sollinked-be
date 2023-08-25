import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { TipLink } from '@tiplink/api';
import { sendEmail } from '../../../src/Mail';
import * as controller from '../../../src/Controllers/mailController';
import * as profileController from '../../../src/Controllers/profilesController';

const imapConfig: Imap.Config = {
    user: 'test@kida.tech',
    password: 'Y*w]Y!)gH{K7',
    host: 'mail.kida.tech',
    port: 143,
    tls: false,
}

const imap = new Imap(imapConfig);
    
export const processEmails = () => {
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

                                let profiles = await profileController.find({ email_address: toEmail });
                                if(!profiles || profiles.length === 0){
                                    console.log('cant find profile');
                                    return;
                                }

                                // we process emails here
                                const tiplink = await TipLink.create();

                                // save from, to, messageId and tiplink url to db
                                await controller.create({
                                    profile_id: profiles[0].id,
                                    from_email: returnToEmail,
                                    to_email: toEmail,
                                    message_id: messageId,
                                    tiplink_url: tiplink.url.toString(),
                                    tiplink_public_key: tiplink.keypair.publicKey.toBase58(),
                                });

                                // need to include guide to deposit?
                                let returnText = `Please deposit USDC (Solana) to the Solana Address below for a guaranteed audience\n${tiplink.keypair.publicKey.toBase58()}`;
                                
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
                })
            });
        });

        imap.once('error', (err: any) => {
            console.log('error encountered 1')
            console.log(err);
        });

        imap.once('end', () => {
            console.log('connection ended');
        });

        imap.connect();
    }

    catch (e: any){
        console.log('error encountered 2')
        console.log(e);
    }
}