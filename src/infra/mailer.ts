// Console-transport mailer. The Session 5 contract says the email "shows up in
// Ethereal (or the console transport)". We render the message to a structured
// JSON line and log it: zero credentials, zero extra deps, and the same
// function signature a real SMTP transport would use — so swapping in
// nodemailer + Ethereal later is a one-file change.
export interface ConfirmationEmail {
  to: string;
  name: string;
  eventTitle: string;
}

export async function sendConfirmation(input: ConfirmationEmail): Promise<void> {
  console.log(
    JSON.stringify({
      type: "email:confirmation",
      to: input.to,
      name: input.name,
      eventTitle: input.eventTitle,
      sentAt: new Date().toISOString(),
    }),
  );
}
