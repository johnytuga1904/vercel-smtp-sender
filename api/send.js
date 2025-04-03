// api/send.js
const nodemailer = require('nodemailer');

// WICHTIG: Ersetze dies durch ein starkes, geheimes Token!
// Dieses Token muss auch in deiner Supabase Function verwendet werden,
// um sicherzustellen, dass nur sie diese Funktion aufrufen kann.
const EXPECTED_AUTH_TOKEN = process.env.SMTP_SENDER_AUTH_TOKEN || pitoAvoar01. ;

module.exports = async (req, res) => {
    // Nur POST-Anfragen erlauben
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    // Sicherheitsüberprüfung: Überprüfe das Authorization-Token
    const authToken = (req.headers.authorization || '').split('Bearer ')[1];
    if (authToken !== EXPECTED_AUTH_TOKEN) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
        const { smtpConfig, to, subject, text, html, attachments } = req.body;

        // Validierung der Eingabe (minimal)
        if (!smtpConfig || !to || !subject || (!text && !html)) {
            return res.status(400).json({ success: false, error: 'Missing required email parameters.' });
        }
        if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.auth || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
            return res.status(400).json({ success: false, error: 'Missing required SMTP configuration parameters.' });
        }

        // Stelle sicher, dass secure=true ist, wenn Port 465 verwendet wird
        const secureConnection = smtpConfig.port === 465;

        // Erstelle den Nodemailer Transporter mit den Benutzerdaten
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: secureConnection, // true für Port 465, false für andere (STARTTLS wird meist automatisch versucht)
            auth: {
                user: smtpConfig.auth.user,
                pass: smtpConfig.auth.pass,
            },
            // Optional: TLS-Optionen (manchmal bei älteren Servern nötig)
            // tls: {
            //  ciphers:'SSLv3' // Beispiel
            //  rejectUnauthorized: false // Nur wenn absolut nötig und du dem Server vertraust!
            // }
        });

         // Optional: Verifiziere die SMTP-Verbindung (kann fehlschlagen, siehe Nodemailer Doku)
         /*
         try {
             await transporter.verify();
             console.log('SMTP Connection Verified');
         } catch (verifyError) {
             console.error('SMTP Connection Verification Failed:', verifyError);
             // Nicht unbedingt abbrechen, sendMail versuchen
         }
         */

        // Bereite die Mail-Optionen vor
        const mailOptions = {
            from: smtpConfig.auth.user, // Absender ist der SMTP-Benutzer
            to: to,                     // Empfänger aus dem Request
            subject: subject,           // Betreff aus dem Request
            text: text,                 // Textinhalt (optional)
            html: html,                 // HTML-Inhalt (optional)
            attachments: attachments ? attachments.map(att => ({
                filename: att.filename,
                content: att.content, // Muss Base64-kodierter String sein
                encoding: 'base64',
                contentType: att.contentType
            })) : undefined // Anhänge aus dem Request (Base64-dekodiert)
        };

        // Sende die E-Mail
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);

        // Erfolgreiche Antwort senden
        return res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('Error sending email:', error);
        // Fehlerantwort senden
        // Versuche, eine spezifischere Fehlermeldung zu geben, wenn möglich
        let errorMessage = 'Failed to send email.';
        if (error.code === 'EAUTH') {
             errorMessage = 'SMTP Authentication failed. Please check username/password.';
        } else if (error.code === 'ECONNECTION') {
             errorMessage = 'Failed to connect to SMTP server. Please check host/port.';
        } else if (error.message) {
             errorMessage = error.message; // Gib die Fehlermeldung von Nodemailer weiter
        }

        return res.status(500).json({ success: false, error: errorMessage, errorCode: error.code });
    }
};
