import { processEmails, processUnclaimedRespondedEmails } from "./ProcessEmails";
import cron from 'node-cron';
import { processFromSitePayments, processMailsWithNoResponse, processPayments } from "./ProcessPayments";
import { processClaims } from "./ProcessClaims";
import { processExpiredReservationPayments, processReservationClaims, processReservationPayments } from "./ProcessReservationPayments";
import { processGithubInvitations, syncRepo } from "./ProcessGithubInvitations";
import { processGithubIssues } from "./ProcessGithubIssues";
import { processBroadcasts } from "./ProcessBroadcasts";


export const init = () => {
    // run every 1 minute
    cron.schedule('*/1 * * * *', () => {
        // processEmails();
        processPayments();
        processFromSitePayments();
        processClaims();
        processExpiredReservationPayments();
        processReservationClaims();
        // processGithubInvitations();
        // syncRepo();
        // processGithubIssues();
        processMailsWithNoResponse();
    });

    setInterval(() => {
        processReservationPayments();
        processUnclaimedRespondedEmails();
    }, 5000);

    // process emails every 30s
    setInterval(() => {
        // might have to check if it's checking emails
        processEmails();

        // broadcast
        processBroadcasts();
    }, 30000);
}
