import nodemailer from 'nodemailer';
import { getMailCredentials } from '../../utils';

export type SendEmailParams = {
    to: string,
    subject: string;
    text: string;
    inReplyTo?: string;
    references?: string;
}

export const sendEmail = async ({ to, subject, text, inReplyTo, references }: SendEmailParams) => {
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
        inReplyTo,
        references,
    });

    console.log(info.messageId);
}