import React from "react";
import { Shield, ArrowLeft } from "lucide-react";

interface PrivacyNoticeProps {
  onBack?: () => void;
}

export const PrivacyNotice: React.FC<PrivacyNoticeProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen p-4" style={{ background: "linear-gradient(to bottom right, #eff6ff, #ffffff, #eff6ff)" }}>
      <div className="max-w-3xl mx-auto py-12">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-resilinc-primary hover:text-resilinc-primary-dark mb-6 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </button>
        )}

        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-resilinc-primary rounded-xl">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Privacy Notice</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6 text-sm leading-relaxed" style={{ color: "#374151" }}>
          <p className="text-xs text-gray-500">Last updated: April 2026</p>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>1. Who We Are</h2>
            <p>
              This Dispatch Management application is operated by your organisation. Personal
              information is processed in accordance with the Protection of Personal Information
              Act, 2013 (POPIA) and any applicable data-protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>2. What We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account data</strong> &mdash; username, email address, hashed password, role.</li>
              <li><strong>Operational data</strong> &mdash; jobs, driver assignments, delivery records, flowbin batches.</li>
              <li><strong>Messages</strong> &mdash; internal messages exchanged within the system.</li>
              <li><strong>Audit data</strong> &mdash; timestamps and creator IDs for records you create.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>3. Why We Process It</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To authenticate you and enforce role-based access.</li>
              <li>To manage dispatch operations, deliveries, and reporting.</li>
              <li>To maintain an audit trail for operational integrity.</li>
              <li>To communicate via internal messaging.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>4. Legal Basis</h2>
            <p>
              Processing is necessary for the performance of a contract (your employment or
              service agreement) and for compliance with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>5. Data Retention</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Login activity</strong> &mdash; retained for 365 days.</li>
              <li><strong>Password reset tokens</strong> &mdash; purged 30 days after expiry.</li>
              <li><strong>Abandoned registrations</strong> &mdash; removed after 90 days.</li>
              <li><strong>Operational records</strong> &mdash; retained per your organisation&apos;s policy.</li>
            </ul>
            <p className="mt-2">An automated retention sweep runs nightly to enforce these limits.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>6. Your Rights (POPIA)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access (s23)</strong> &mdash; You may request a copy of all personal data we hold about you via the data export feature in Settings.</li>
              <li><strong>Correction (s24)</strong> &mdash; Contact your administrator to correct inaccurate information.</li>
              <li><strong>Erasure (s25)</strong> &mdash; You may request deletion of your personal information. An administrator can erase your PII while preserving the audit trail.</li>
              <li><strong>Objection (s11)</strong> &mdash; You may object to processing on reasonable grounds.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>7. Security</h2>
            <p>
              Passwords are hashed with bcrypt (12 rounds). Connections are encrypted via TLS.
              Access is controlled by JWT tokens with 8-hour expiry. Rate limiting protects
              against brute-force attacks. All state-changing API requests are validated against
              CSRF protections.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>8. Third Parties</h2>
            <p>
              The application is hosted on Vercel (serverless functions) with a PostgreSQL
              database on Railway. No personal data is shared with third parties beyond these
              infrastructure providers, which act as operators under appropriate agreements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "#0f172a" }}>9. Contact</h2>
            <p>
              For privacy-related requests, contact your system administrator or your
              organisation&apos;s Information Officer.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
