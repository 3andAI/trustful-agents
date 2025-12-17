import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { query, queryOne, queryMany } from '../db/index.js';
// ============================================================================
// Configuration
// ============================================================================
const AWS_REGION = process.env.AWS_REGION || 'eu-central-1';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@trustful.agents';
const FROM_NAME = process.env.FROM_NAME || 'Trustful Agents';
// ============================================================================
// SES Client
// ============================================================================
const sesClient = new SESClient({
    region: AWS_REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    } : undefined, // Use default credentials chain if not specified
});
const templates = {
    council_deletion_proposed: (vars) => ({
        subject: `Vote Required: Council "${vars.councilName}" Deletion Proposed`,
        html: `
      <h2>Council Deletion Proposed</h2>
      <p>A proposal to delete the council <strong>"${vars.councilName}"</strong> has been submitted.</p>
      <p><strong>Proposed by:</strong> ${vars.proposer}</p>
      <p><strong>Reason:</strong> ${vars.reason || 'Not specified'}</p>
      <p>Please review and cast your vote in the governance dashboard.</p>
      <p><a href="${vars.dashboardUrl}">Go to Dashboard</a></p>
    `,
        text: `Council Deletion Proposed

A proposal to delete the council "${vars.councilName}" has been submitted.

Proposed by: ${vars.proposer}
Reason: ${vars.reason || 'Not specified'}

Please review and cast your vote in the governance dashboard.
Dashboard: ${vars.dashboardUrl}`,
    }),
    council_deleted: (vars) => ({
        subject: `Council "${vars.councilName}" Has Been Deleted`,
        html: `
      <h2>Council Deleted</h2>
      <p>The council <strong>"${vars.councilName}"</strong> has been successfully deleted.</p>
      <p><strong>Executed by:</strong> ${vars.executor}</p>
      <p><strong>Transaction:</strong> <a href="${vars.txUrl}">${vars.txHash}</a></p>
    `,
        text: `Council Deleted

The council "${vars.councilName}" has been successfully deleted.

Executed by: ${vars.executor}
Transaction: ${vars.txUrl}`,
    }),
    council_deletion_rejected: (vars) => ({
        subject: `Council "${vars.councilName}" Deletion Rejected`,
        html: `
      <h2>Council Deletion Rejected</h2>
      <p>The proposal to delete council <strong>"${vars.councilName}"</strong> did not reach the required threshold.</p>
      <p><strong>Votes for:</strong> ${vars.votesFor}</p>
      <p><strong>Votes against:</strong> ${vars.votesAgainst}</p>
      <p><strong>Required:</strong> ${vars.threshold}</p>
    `,
        text: `Council Deletion Rejected

The proposal to delete council "${vars.councilName}" did not reach the required threshold.

Votes for: ${vars.votesFor}
Votes against: ${vars.votesAgainst}
Required: ${vars.threshold}`,
    }),
    member_added: (vars) => ({
        subject: `You've Been Added to Council "${vars.councilName}"`,
        html: `
      <h2>Welcome to ${vars.councilName}</h2>
      <p>You have been added as a member of the <strong>"${vars.councilName}"</strong> council.</p>
      <p><strong>Your address:</strong> ${vars.memberAddress}</p>
      <p><strong>Added by:</strong> ${vars.addedBy}</p>
      <p>You can now participate in claim disputes for agents assigned to this council.</p>
      <p><a href="${vars.dashboardUrl}">Go to Council Dashboard</a></p>
    `,
        text: `Welcome to ${vars.councilName}

You have been added as a member of the "${vars.councilName}" council.

Your address: ${vars.memberAddress}
Added by: ${vars.addedBy}

You can now participate in claim disputes for agents assigned to this council.
Dashboard: ${vars.dashboardUrl}`,
    }),
    member_removed: (vars) => ({
        subject: `You've Been Removed from Council "${vars.councilName}"`,
        html: `
      <h2>Council Membership Ended</h2>
      <p>You have been removed from the <strong>"${vars.councilName}"</strong> council.</p>
      <p><strong>Removed by:</strong> ${vars.removedBy}</p>
      <p><strong>Reason:</strong> ${vars.reason || 'Not specified'}</p>
      <p>If you believe this is an error, please contact the governance team.</p>
    `,
        text: `Council Membership Ended

You have been removed from the "${vars.councilName}" council.

Removed by: ${vars.removedBy}
Reason: ${vars.reason || 'Not specified'}

If you believe this is an error, please contact the governance team.`,
    }),
    vote_required: (vars) => ({
        subject: `Vote Required: ${vars.action} for "${vars.targetName}"`,
        html: `
      <h2>Your Vote is Needed</h2>
      <p>A governance action requires your vote.</p>
      <p><strong>Action:</strong> ${vars.action}</p>
      <p><strong>Target:</strong> ${vars.targetName}</p>
      <p><strong>Proposed by:</strong> ${vars.proposer}</p>
      <p><strong>Current votes:</strong> ${vars.currentVotes} / ${vars.requiredVotes}</p>
      <p><strong>Deadline:</strong> ${vars.deadline}</p>
      <p><a href="${vars.dashboardUrl}">Cast Your Vote</a></p>
    `,
        text: `Your Vote is Needed

A governance action requires your vote.

Action: ${vars.action}
Target: ${vars.targetName}
Proposed by: ${vars.proposer}
Current votes: ${vars.currentVotes} / ${vars.requiredVotes}
Deadline: ${vars.deadline}

Cast your vote: ${vars.dashboardUrl}`,
    }),
};
// ============================================================================
// Queue Management
// ============================================================================
export async function queueEmail(recipientEmail, template, variables, scheduledAt) {
    const result = await queryOne(`INSERT INTO email_queue (recipient_email, template, variables, scheduled_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`, [recipientEmail, template, JSON.stringify(variables), scheduledAt || new Date()]);
    if (!result) {
        throw new Error('Failed to queue email');
    }
    return result;
}
export async function getPendingEmails(limit = 10) {
    return queryMany(`SELECT * FROM email_queue 
     WHERE status = 'pending' AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT $1`, [limit]);
}
export async function markEmailSent(id) {
    await query(`UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`, [id]);
}
export async function markEmailFailed(id, error) {
    await query(`UPDATE email_queue 
     SET status = 'failed', attempts = attempts + 1, last_error = $2
     WHERE id = $1`, [id, error]);
}
// ============================================================================
// Email Sending
// ============================================================================
export async function sendEmail(to, template, variables) {
    const templateFn = templates[template];
    if (!templateFn) {
        console.error(`Unknown email template: ${template}`);
        return false;
    }
    const content = templateFn(variables);
    try {
        const command = new SendEmailCommand({
            Source: `${FROM_NAME} <${FROM_EMAIL}>`,
            Destination: {
                ToAddresses: [to],
            },
            Message: {
                Subject: {
                    Data: content.subject,
                    Charset: 'UTF-8',
                },
                Body: {
                    Html: {
                        Data: content.html,
                        Charset: 'UTF-8',
                    },
                    Text: {
                        Data: content.text,
                        Charset: 'UTF-8',
                    },
                },
            },
        });
        await sesClient.send(command);
        console.log(`Email sent successfully to ${to}`);
        return true;
    }
    catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        return false;
    }
}
// ============================================================================
// Queue Processor
// ============================================================================
export async function processEmailQueue() {
    const pendingEmails = await getPendingEmails(10);
    let sent = 0;
    for (const email of pendingEmails) {
        const success = await sendEmail(email.recipient_email, email.template, email.variables);
        if (success) {
            await markEmailSent(email.id);
            sent++;
        }
        else {
            await markEmailFailed(email.id, 'Send failed');
        }
    }
    return sent;
}
// ============================================================================
// Bulk Notifications
// ============================================================================
export async function notifyAllSigners(template, variables, excludeAddress) {
    // Get all governance signers with emails
    const signers = await queryMany(`SELECT email FROM governance_signers 
     WHERE email IS NOT NULL 
     ${excludeAddress ? 'AND address != $1' : ''}`, excludeAddress ? [excludeAddress.toLowerCase()] : []);
    let queued = 0;
    for (const signer of signers) {
        await queueEmail(signer.email, template, variables);
        queued++;
    }
    return queued;
}
export async function notifyCouncilMembers(councilId, template, variables, excludeAddress) {
    // Get all council members with emails
    const members = await queryMany(`SELECT email FROM council_members 
     WHERE council_id = $1 AND email IS NOT NULL
     ${excludeAddress ? 'AND address != $2' : ''}`, excludeAddress ? [councilId, excludeAddress.toLowerCase()] : [councilId]);
    let queued = 0;
    for (const member of members) {
        await queueEmail(member.email, template, variables);
        queued++;
    }
    return queued;
}
// ============================================================================
// Health Check
// ============================================================================
export async function healthCheck() {
    try {
        // Just verify client is configured
        return !!sesClient;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=email.js.map