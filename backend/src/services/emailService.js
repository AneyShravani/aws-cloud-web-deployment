const transporter = require('../config/mail');

const sendAdminCredentials = async ({ adminName, adminEmail, temporaryPassword, organizationName }) => {
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #2563eb;">AI Lab Maintenance</h2>
      <p>Hello <strong>${adminName}</strong>,</p>
      <p>Your organization <strong>${organizationName}</strong> has been successfully registered in the AI Lab Maintenance System.</p>
      <p>Your administrator account has been created.</p>
      <div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-left: 4px solid #2563eb;">
        <p style="margin: 0 0 8px;"><strong>Login Email</strong><br />${adminEmail}</p>
        <p style="margin: 0;"><strong>Temporary Password</strong><br />${temporaryPassword}</p>
      </div>
      <p>Please login using these credentials.</p>
      <p>For security reasons, you must change your password after your first login.</p>
      <p>Regards,<br />AI Lab Maintenance Team</p>
    </div>
  `;

  const mailOptions = {
    from: mailFrom,
    to: adminEmail,
    subject: 'AI Lab Maintenance - Admin Login Credentials',
    html,
  };

  await transporter.sendMail(mailOptions);
};

const sendUserCredentials = async ({ userName, userEmail, temporaryPassword, organizationName }) => {
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #2563eb;">AI Lab Maintenance</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>An account has been created for you${organizationName ? ` at <strong>${organizationName}</strong>` : ''} in the AI Lab Maintenance System.</p>
      <div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-left: 4px solid #2563eb;">
        <p style="margin: 0 0 8px;"><strong>Login Email</strong><br />${userEmail}</p>
        <p style="margin: 0;"><strong>Temporary Password</strong><br />${temporaryPassword}</p>
      </div>
      <p>Please log in with these credentials. For your security, you'll be asked to set a new password on your first login.</p>
      <p>Once logged in, you can raise lab access requests yourself.</p>
      <p>Regards,<br />AI Lab Maintenance Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: mailFrom,
    to: userEmail,
    subject: 'AI Lab Maintenance - Your Login Credentials',
    html,
  });
};

const sendPasswordResetOtp = async ({ adminName, adminEmail, otp }) => {
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #2563eb;">AI Lab Maintenance</h2>
      <p>Hello <strong>${adminName}</strong>,</p>
      <p>Use the OTP below to reset your password.</p>
      <div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-left: 4px solid #2563eb;">
        <p style="margin: 0;"><strong>OTP</strong><br />${otp}</p>
      </div>
      <p>This OTP expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      <p>Regards,<br />AI Lab Maintenance Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: mailFrom,
    to: adminEmail,
    subject: 'AI Lab Maintenance - Password Reset OTP',
    html,
  });
};

const sendApprovalEmail = async ({
  studentEmail,
  studentName,
  projectName,
  systemName,
  referenceId,
  startDate,
  endDate,
}) => {
  const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER;

  const formattedStartDate = new Date(startDate).toLocaleDateString();
  const formattedEndDate = new Date(endDate).toLocaleDateString();

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="color: #2563eb;">AI Lab Maintenance</h2>
      <p>Hello <strong>${studentName}</strong>,</p>
      <p>Your request has been approved.</p>
      <div style="margin: 20px 0; padding: 16px; background: #f8fafc; border-left: 4px solid #2563eb;">
        <p style="margin: 0 0 8px;"><strong>Project:</strong> ${projectName}</p>
        <p style="margin: 0 0 8px;"><strong>System:</strong> ${systemName}</p>
        <p style="margin: 0 0 8px;"><strong>Reference ID:</strong> ${referenceId}</p>
        <p style="margin: 0;"><strong>Duration:</strong> ${formattedStartDate} to ${formattedEndDate}</p>
      </div>
      <p>Regards,<br />AI Lab Maintenance Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: mailFrom,
    to: studentEmail,
    subject: 'AI Lab Request Approved',
    html,
  });
};

module.exports = {
  sendAdminCredentials,
  sendUserCredentials,
  sendPasswordResetOtp,
  sendApprovalEmail,
};