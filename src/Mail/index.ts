import nodemailer from 'nodemailer';
import { getMailCredentials } from '../../utils';
import Imap from 'imap';
import { AddressObject, Attachment as ParserAttachment, simpleParser } from 'mailparser';
import axios from 'axios';
import { Attachment } from 'nodemailer/lib/mailer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import DB from '../DB';

export type SendEmailParams = {
    to: string,
    subject: string;
    text?: string;
    textAsHtml?: string;
    inReplyTo?: string;
    references?: string;
    attachments?: Attachment[];
    replyTo?: string;
    from?: string;
}

export const getImap = () => {
    const { user, pass, host, } = getMailCredentials();
    const imapConfig: Imap.Config = {
        user,
        password: pass,
        host,
        port: 143,
        tls: false,
    }

    return new Imap(imapConfig);
}

export const sendEmail = async ({ 
    to, 
    subject, 
    text, 
    inReplyTo, 
    references, 
    textAsHtml, 
    attachments,
    replyTo,
    from,
}: SendEmailParams) => {
    const { host, user, pass, name, bcc } = getMailCredentials();

    let retries = 0;
    let sentMessageId = "";

    while(retries < 3) {
        try {
            const transporter = nodemailer.createTransport({
                host,
                port: 465,
                secure: true,
                auth: {
                    user,
                    pass,
                }
            });

            const info = await transporter.sendMail({
                from: from ?? `"${name}" <${user}>`,
                to,
                bcc,
                subject,
                text,
                html: textAsHtml,
                inReplyTo,
                references,
                attachments,
                replyTo
            });
    
            let db = new DB();
            await db.log('Mail', 'sendEmail', `Email sent to: ${to}, subject: ${subject}, bcc: ${bcc}`);
            sentMessageId = info.messageId;
            break;
        }

        catch(e: any) {
            let db = new DB();
            await db.log('Mail', 'sendEmail', `Send Email Error, retrying..\n\n${e.toString()}`);
            retries++;
        }
    }

    return sentMessageId;
}

export const getEmailByMessageId = (messageId: string) => {
    const imap = getImap();
    return new Promise<{ from: string, subject?: string, to: string[], cc?: AddressObject | AddressObject[], bcc?: AddressObject | AddressObject[], textAsHtml?: string, text?: string, messageId?: string, attachments: ParserAttachment[] }>(async (resolve, reject) => {
        try {
            imap.once('ready', () => {
                // on ready
                return imap.openBox('INBOX', false, () => {
                    // open inbox
                    return imap.search([
                        [
                            'HEADER',
                            'Message-ID',
                            messageId
                        ]
                    ], async (err, results) => {
                        try {
                            const f = imap.fetch(results, { bodies: '' });
                            f.on('message', msg => {
                                return msg.on('body', stream => {
                                    return simpleParser(stream as any, async(err, parsed) => {
                                        const { from, to, subject, textAsHtml, text, messageId, attachments, bcc, cc } = parsed;

                                        let fromEmail = from? from.text.match(/[\w-\+\.]+@([\w-]+\.)+[\w-]{2,10}/g) : "";
                                        let fromEmailStr = "";
                                        if(Array.isArray(fromEmail) && fromEmail.length > 0) {
                                            fromEmailStr = fromEmail[0];
                                        }
    
                                        let toEmails: string[] = [];
                                        if(to) {
                                            let toText = Array.isArray(to)? to.map(x => x.text).join(", ") : to.text;
                                            let toEmailMatch = toText.match(/[\w-\+\.]+@([\w-]+\.)+[\w-]{2,10}/g);
                                            if(Array.isArray(toEmailMatch) && toEmailMatch.length > 0) {
                                                toEmails = toEmailMatch;
                                            }
                                        }

                                        return resolve({ from: fromEmailStr, to: toEmails, bcc, cc, subject, textAsHtml, text, messageId, attachments});
                                    })
                                })
                            });
        
                            f.once('error', async e => {
                                let db = new DB();
                                await db.log('Mail', 'getEmailByMessageId', `ME1:\n${e.toString()}`);
                                return reject();
                            });
        
                            f.once('end', () => {
                                // fetched all messages
                                imap.end();
                            });
                        }

                        catch(e: any) {

                            if(!e.message.includes("Nothing to fetch")) {
                                let db = new DB();
                                await db.log('Mail', 'getEmailByMessageId', `ME2:\n${e.toString()}`);
                            }
                            imap.end();
                        }
                    })
                });
            });
    
            imap.once('error', async(err: any) => {
                let db = new DB();
                await db.log('Mail', 'getEmailByMessageId', `MEe:\n${err.toString()}`);
                return reject();
            });
    
            imap.once('end', () => {
                // do nothing
            });
    
            imap.connect();
        }
    
        catch (e: any){
            let db = new DB();
            await db.log('Mail', 'getEmailByMessageId', `ME4:\n${e.toString()}`);
            return reject();
        }
    })
}

export const createEmailForwarder = async(username: string) => {
    let { cpanel, user: admin, auth, domain } = getMailCredentials();
    admin = admin.replace("@", "%40");
    username = username.toLowerCase();

    let url = `${cpanel}/execute/Email/add_forwarder?domain=${domain}&email=${username}%40${domain}&fwdopt=fwd&fwdemail=${admin}`;
    const res = await axios.post(url, undefined, {
        headers: {
            "Authorization": auth,
        }
    });

    if(res.data.errors && res.data.errors.length > 0) {
        let db = new DB();
        await db.log('Mail', 'createEmailForwarder', `Unable to create forwarder: ${res.data.errors.join(", ")}\nForwarder: ${username}`);
        return;
    }
    return;
}

export const deleteEmailForwarder = async(username: string) => {
    let { cpanel, user: admin, auth, domain } = getMailCredentials();
    username = username.toLowerCase();
    
    let url = `${cpanel}/execute/Email/delete_forwarder?address=${username}%40${domain}&forwarder=${admin}`;
    const res = await axios.post(url, undefined, {
        headers: {
            "Authorization": auth,
        }
    });

    if(res.data.errors && res.data.errors.length > 0) {
        let db = new DB();
        await db.log('Mail', 'deleteEmailForwarder', `Unable to delete forwarder: ${res.data.errors.join(", ")}\nForwarder: ${username}`);
        return;
    }

    return;
}

export const changeEmailForwarder = async(newUsername: string, oldUsername: string) => {
    try {
        await createEmailForwarder(newUsername);
        await deleteEmailForwarder(oldUsername);
    }

    catch (e: any){
        let db = new DB();
        await db.log('Mail', 'changeEmailForwarder', `Unable to change forwarder:\n\n${e.toString()}`);
        return false;
    }

    return true;
}

// model changer
export const mapAttachments = (parserAttachments: ParserAttachment[]) => {
    if(!fs.existsSync('./attachments')) {
        fs.mkdirSync('./attachments');
    }
    let attachments: Attachment[] = [];
    parserAttachments.forEach(pAttachment => {
        // make sure no duplicate files
        let folder = `./attachments/${uuidv4()}`;
        fs.mkdirSync(folder);

        // download the file
        let filename = `${folder}/${pAttachment.filename ?? "file"}`
        fs.writeFileSync(filename, pAttachment.content);

        // attach the file
        let attachment: Attachment = {
            filename: pAttachment.filename,
            path: filename,
        };

        attachments.push(attachment);
    });

    return attachments;
}
export const deleteAttachments = (attachments: Attachment[]) => {
    attachments.forEach(attachment => {
        if(!attachment.path) {
            return;
        }
        let path = attachment.path.toString();
        // format = './attachments/folder_name/filename
        let folder = "./attachments/" + path.split('/')[2];
        
        try {
            fs.rmSync(path);
            fs.rmdirSync(folder);
        }

        catch(e) {
            console.log('cant remove folder: ', folder);
        }
    });

    return attachments;
}