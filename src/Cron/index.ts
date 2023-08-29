import { processEmails } from "./ProcessEmails";
import cron from 'node-cron';
import { processPayments } from "./ProcessPayments";
import { processClaims } from "./ProcessClaims";
import { processExpiredReservationPayments, processReservationClaims, processReservationPayments } from "./ProcessReservationPayments";


export const init = () => {
    // run every 2 minutes
    cron.schedule('*/2 * * * *', () => {
        processEmails();
        processPayments();
        processClaims();
        processReservationPayments();
        processExpiredReservationPayments();
        processReservationClaims();
    });
}
