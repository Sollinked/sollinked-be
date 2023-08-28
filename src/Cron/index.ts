import { processEmails } from "./ProcessEmails";
import cron from 'node-cron';
import { processPayments } from "./ProcessPayments";


export const init = () => {
    // run every 2 minutes
    cron.schedule('*/2 * * * *', () => {
        processEmails();
        processPayments();
    });
}
