import nodemailer from 'nodemailer';
import { getMailCredentials } from '../../utils';
import Imap from 'imap';
import { Attachment as ParserAttachment, simpleParser } from 'mailparser';
import axios from 'axios';
import { Attachment } from 'nodemailer/lib/mailer';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export type SendEmailParams = {
    to: string,
    subject: string;
    text: string;
    textAsHtml?: string;
    inReplyTo?: string;
    references?: string;
    attachments?: Attachment[];
}

export const getImap = () => {
    const imapConfig: Imap.Config = {
        user: 'test@kida.tech',
        password: 'Y*w]Y!)gH{K7',
        host: 'mail.kida.tech',
        port: 143,
        tls: false,
    }

    return new Imap(imapConfig);
}

export const sendEmail = async ({ to, subject, text, inReplyTo, references, textAsHtml, attachments }: SendEmailParams) => {
    const { host, user, pass, name } = getMailCredentials();

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
        from: `"${name}" <${user}>`, // change to admin
        to,
        subject,
        text,
        html: textAsHtml,
        inReplyTo,
        references,
        attachments,
    });

    console.log(info.messageId);
}

export const getEmailByMessageId = (messageId: string) => {
    const imap = getImap();
    return new Promise<{ from: string, subject?: string, textAsHtml?: string, text?: string, messageId?: string, attachments: ParserAttachment[] }>((resolve, reject) => {
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
                    ], (err, results) => {
                        try {
                            const f = imap.fetch(results, { bodies: '' });
                            f.on('message', msg => {
                                return msg.on('body', stream => {
                                    return simpleParser(stream, async(err, parsed) => {
                                        const { from, to, subject, textAsHtml, text, messageId, attachments } = parsed;

                                        let fromEmail = from? from.text.match(/[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g) : "";
                                        let fromEmailStr = "";
                                        if(Array.isArray(fromEmail) && fromEmail.length > 0) {
                                            fromEmailStr = fromEmail[0];
                                        }
                                        
                                        return resolve({ from: fromEmailStr, subject, textAsHtml, text, messageId, attachments});
                                    })
                                })
                            });
        
                            f.once('error', e => {
                                console.log('error encountered 3')
                                console.log(e); 
                                return reject();
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
                return reject();
            });
    
            imap.once('end', () => {
                // do nothing
            });
    
            imap.connect();
        }
    
        catch (e: any){
            console.log('error encountered 2')
            console.log(e);
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
        console.log('Unable to create forwarder: ');
        console.log(res.data.errors.join(", "));
        return;
    }
    console.log(`Created new forwarder: ${username}@${domain}`);
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
        console.log('Unable to delete forwarder: ');
        console.log(res.data.errors.join(", "));
        return;
    }

    console.log(`Deleted forwarder: ${username}@${domain}`);
    return;
}

export const changeEmailForwarder = async(newUsername: string, oldUsername: string) => {
    try {
        await createEmailForwarder(newUsername);
        await deleteEmailForwarder(oldUsername);
    }

    catch (e){
        console.log(e);
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
        console.log({ 
            filename: pAttachment.filename,
            contentType: pAttachment.contentType,
        });
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
            console.log(e);
            console.log('cant remove folder: ' + folder);
        }
    });

    return attachments;
}