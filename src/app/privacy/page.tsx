import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Lock, Eye, MapPin, Camera, FileText, CheckCircle2, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Guild Club Services",
  description: "Official Privacy Policy for Guild Club Services clinical care application and mobile platforms.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-[#0B7A63] flex items-center justify-center text-white font-bold text-base shadow-xs">
              GC
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 text-sm sm:text-base block leading-tight">
                Guild Club Services
              </span>
              <span className="text-[11px] text-[#0B7A63] font-semibold uppercase tracking-wider block">
                Clinical Care Platform
              </span>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-[#0B7A63] border border-slate-300 hover:border-[#0B7A63] px-3.5 py-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Title Section */}
        <div className="border-b border-slate-200 pb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-[#0B7A63] border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span>Official Policy & Data Transparency</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Effective Date: <strong>16 November 2026</strong> &bull; Applicable to Application ID:{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 text-slate-800 font-mono text-xs">com.guildclub.services</code>
          </p>
        </div>

        {/* Intro */}
        <div className="bg-white border border-slate-200 p-6 shadow-xs space-y-3 leading-relaxed text-sm text-slate-700">
          <p>
            Guild Club Services (“we”, “us”, or “our”) is dedicated to safeguarding patient clinical confidentiality,
            health information privacy, and practitioner data integrity. This Privacy Policy governs the collection, use,
            disclosure, and protection of information obtained through the <strong>Guild Club Services</strong> mobile
            application (Android & iOS) and web platform (
            <a href="https://guildclub-services.vercel.app" className="text-[#0B7A63] underline font-medium">
              https://guildclub-services.vercel.app
            </a>
            ).
          </p>
          <p>
            By accessing or using our clinical care services, authorized users (including clinical administrators,
            licensed therapists, and staff) acknowledge the terms outlined in this policy.
          </p>
        </div>

        {/* Section 1: Information We Collect */}
        <section className="bg-white border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-5 h-5 text-[#0B7A63]" />
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              1. Information We Collect
            </h2>
          </div>

          <div className="space-y-4 text-sm text-slate-700">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0B7A63]" />
                <span>A. Clinical Health & Case Data</span>
              </h3>
              <p className="leading-relaxed text-slate-600 pl-5">
                To coordinate therapeutic treatments, we collect clinical intake data including patient name, age, gender,
                contact details, presenting conditions, assigned clinical rooms, treatment sessions, exercises performed,
                and therapist session progression notes.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#0B7A63]" />
                <span>B. Clinical Photos & Informed Consent</span>
              </h3>
              <p className="leading-relaxed text-slate-600 pl-5">
                Therapists may capture joining and present condition photos strictly for clinical documentation and
                progress tracking. <strong>Photos are captured exclusively with affirmative, documented informed patient
                or legal guardian consent.</strong>
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#0B7A63]" />
                <span>C. Practitioner Attendance & Location Verification</span>
              </h3>
              <p className="leading-relaxed text-slate-600 pl-5">
                When a therapist signs in on duty, our application captures foreground GPS location (latitude, longitude,
                and accuracy) to verify physical presence at their authorized clinic branch (e.g., Wellknox Banjara Hills).
                <strong> Location is captured strictly at the instant of clock-in and is never tracked continuously or in
                the background.</strong>
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#0B7A63]" />
                <span>D. Patient Digital Signatures</span>
              </h3>
              <p className="leading-relaxed text-slate-600 pl-5">
                Patients or authorized guardians provide an on-screen digital signature upon session completion to certify
                treatment delivery.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: How We Use Information */}
        <section className="bg-white border border-slate-200 p-6 shadow-xs space-y-3 text-sm text-slate-700">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Eye className="w-5 h-5 text-[#0B7A63]" />
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              2. How We Use Collected Data
            </h2>
          </div>
          <ul className="list-disc pl-5 space-y-2 text-slate-600 leading-relaxed">
            <li>Facilitating clinical therapy case management, daily scheduling, and room allocation.</li>
            <li>Generating longitudinal clinical progress reports and treatment continuity audit trails.</li>
            <li>Verifying practitioner duty status and maintaining branch security compliance.</li>
            <li>Enforcing strict Role-Based Access Control (RBAC) to ensure medical staff access only authorized patient records.</li>
            <li>Operating time-locked records synchronized to the Asia/Kolkata (IST) timezone.</li>
          </ul>
        </section>

        {/* Section 3: Data Sharing & Third-Party Disclosure */}
        <section className="bg-white border border-slate-200 p-6 shadow-xs space-y-3 text-sm text-slate-700">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
            3. Data Sharing & Third-Party Disclosure
          </h2>
          <p className="leading-relaxed text-slate-600 font-medium">
            We do not sell, rent, commercialize, or share patient health information or user personal data with any
            third-party advertisers, data brokers, or marketing networks.
          </p>
          <p className="leading-relaxed text-slate-600">
            Data is stored and transmitted exclusively using encrypted, enterprise-grade cloud infrastructure (Neon Serverless
            PostgreSQL, Vercel) compliant with modern transport security protocols (TLS 1.3 / HTTPS).
          </p>
        </section>

        {/* Section 4: Data Security & Retention */}
        <section className="bg-white border border-slate-200 p-6 shadow-xs space-y-3 text-sm text-slate-700">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
            4. Security Standards & Retention
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-600 leading-relaxed">
            <li>
              <strong>Encryption in Transit:</strong> All HTTP network requests are forcefully redirected to HTTPS with
              strict SSL certificate validation.
            </li>
            <li>
              <strong>Credential Protection:</strong> Passwords are protected using salted one-way cryptographic hashing
              (bcrypt, 12 rounds). Plaintext passwords are never stored in databases or logs.
            </li>
            <li>
              <strong>Retention:</strong> Clinical documentation is retained in compliance with statutory medical record
              retention requirements or until authorized clinic administrators execute verified archival.
            </li>
          </ul>
        </section>

        {/* Section 5: User Rights & Account Deletion */}
        <section className="bg-white border border-slate-200 p-6 shadow-xs space-y-3 text-sm text-slate-700">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
            5. User Rights & Data Deletion Requests
          </h2>
          <p className="leading-relaxed text-slate-600">
            Staff members and patients have the right to request access to their personal data, rectify inaccuracies, or
            request account deletion. To initiate a data access or deletion request, please submit a written request to:
          </p>
          <div className="bg-slate-50 border border-slate-200 p-4 font-mono text-xs space-y-1 text-slate-800">
            <p>Email: <a href="mailto:privacy@guildclub.com" className="text-[#0B7A63] underline">privacy@guildclub.com</a></p>
            <p>Administrative Entity: Guild Club Services Care Platform</p>
            <p>Jurisdiction: Hyderabad, Telangana, India</p>
          </div>
        </section>

        {/* Section 6: Updates to this Policy */}
        <section className="bg-white border border-slate-200 p-6 shadow-xs space-y-3 text-sm text-slate-700">
          <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
            6. Changes to this Privacy Policy
          </h2>
          <p className="leading-relaxed text-slate-600">
            We may periodically update this policy to reflect operational, legal, or regulatory enhancements. Any changes
            will be posted directly on this page with an updated effective date.
          </p>
        </section>

        {/* Section 7: Contact Us */}
        <div className="bg-emerald-50 border border-emerald-200 p-6 space-y-2 text-sm text-emerald-950">
          <h3 className="font-bold uppercase tracking-wider text-xs text-[#0B7A63]">
            Official Privacy & Security Contact
          </h3>
          <p className="text-xs text-slate-600">
            For questions or inquiries regarding our data handling and privacy compliance:
          </p>
          <p className="text-xs font-semibold">
            Guild Club Services Clinical Administration &bull; Hyderabad, Telangana, India
          </p>
          <p className="text-xs">
            Portal: <a href="https://guildclub-services.vercel.app" className="underline font-medium text-[#0B7A63]">https://guildclub-services.vercel.app</a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} Guild Club Services. All rights reserved.</p>
      </footer>
    </div>
  );
}
