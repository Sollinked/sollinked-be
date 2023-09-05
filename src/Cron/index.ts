import { processEmails } from "./ProcessEmails";
import cron from 'node-cron';
import { processMailsWithNoResponse, processPayments } from "./ProcessPayments";
import { processClaims } from "./ProcessClaims";
import { processExpiredReservationPayments, processReservationClaims, processReservationPayments } from "./ProcessReservationPayments";
import { processGithubInvitations, syncRepo } from "./ProcessGithubInvitations";
import { processGithubIssues } from "./ProcessGithubIssues";


export const init = () => {
    // run every 1 minute
    cron.schedule('*/1 * * * *', () => {
        // processEmails();
        processPayments();
        processClaims();
        processExpiredReservationPayments();
        processReservationClaims();
        processGithubInvitations();
        syncRepo();
        processGithubIssues();
        processMailsWithNoResponse();
    });

    setInterval(() => {
        processReservationPayments();
    }, 5000);

    // process emails every 30s
    setInterval(() => {
        processEmails();
    }, 30000);
}
