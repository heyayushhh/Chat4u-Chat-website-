const TermsPage = () => {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-base-100 rounded-lg shadow-cl p-6 space-y-6">
          <h1 className="text-2xl font-bold">Chat4U — Terms & Conditions and Privacy Policy</h1>
          <p className="text-base-content/70">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <p className="text-base-content/70">
            Welcome to Chat4U. By accessing or using Chat4U, you agree to these Terms & Conditions
            ("Terms") and acknowledge our Privacy Policy (collectively, the "Agreement"). If you do not
            agree, please do not use the service. This document is provided for transparency and
            compliance and does not constitute legal advice.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">1. Beta Status & Updates</h2>
            <p className="text-base-content/70">
              Chat4U is currently in beta. Features may change, break, or be removed without notice.
              The Founder may roll out significant updates when we are confident the app is operating
              smoothly. We appreciate your feedback as we improve the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">2. Eligibility & Accounts</h2>
            <ul className="list-disc ml-5 text-base-content/70 space-y-2">
              <li>You must be at least 13 years old to use Chat4U.</li>
              <li>Provide accurate information and keep your credentials secure.</li>
              <li>Do not share accounts. You are responsible for all activity under your account.</li>
              <li>You may delete your account at any time. We support hard deletion, which removes your
                account and associated content from Chat4U’s systems as described below.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">3. Acceptable Use & Prohibited Content</h2>
            <p className="text-base-content/70">You agree not to use Chat4U to:</p>
            <ul className="list-disc ml-5 text-base-content/70 space-y-2">
              <li>Harass, threaten, defame, impersonate, or invade the privacy of others.</li>
              <li>Post or share hate speech, extremist content, incitement to violence, or discrimination
                based on caste, religion, gender, sexual orientation, disability, or any protected
                characteristic.</li>
              <li>Share sexual content involving minors or solicit such content (strictly prohibited).</li>
              <li>Distribute obscene content, unsolicited spam, malware, or engage in phishing or fraud.</li>
              <li>Violate intellectual property rights, including unauthorized sharing of copyrighted works.</li>
              <li>Engage in activities that violate applicable law or court orders.</li>
            </ul>
            <p className="text-base-content/70">
              We may remove content, suspend, or terminate accounts that violate these rules.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">4. Content Ownership & License</h2>
            <p className="text-base-content/70">
              You own the content you post. To operate Chat4U, you grant us a limited, worldwide,
              non-exclusive, royalty-free license to host, process, transmit, and display your content
              within the service. This license ends when content is deleted from our systems per the
              retention policy below.
            </p>
          </section>

          <section id="privacy" className="space-y-3">
            <h2 className="text-lg font-semibold">5. Privacy Policy (India DPDP 2023 aligned)</h2>
            <ul className="list-disc ml-5 text-base-content/70 space-y-2">
              <li><span className="font-medium">Data we collect:</span> account details (username, email, display name),
                profile data, contacts you add, messages and attachments you send, device and usage
                metadata necessary for security and performance.</li>
              <li><span className="font-medium">Purpose:</span> operate the service, ensure safety, prevent abuse, and improve
                reliability. We do not sell your personal data.</li>
              <li><span className="font-medium">Retention & Deletion:</span> you can delete your account; we implement hard deletion
                that removes your account and associated content from Chat4U. Residual logs and backups
                may persist briefly for security and integrity but are purged on a schedule.</li>
              <li><span className="font-medium">Processing & Storage:</span> data may be stored or processed using third-party
                infrastructure (e.g., cloud storage/CDN) with appropriate safeguards.</li>
              <li><span className="font-medium">Your rights:</span> access, correction, and deletion, subject to legal or technical
                limits. Contact our Grievance Officer for requests.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">6. Indian Legal Compliance & Penalties</h2>
            <p className="text-base-content/70">
              Chat4U operates in accordance with Indian law, including but not limited to:
            </p>
            <ul className="list-disc ml-5 text-base-content/70 space-y-2">
              <li><span className="font-medium">Information Technology Act, 2000</span> and <span className="font-medium">IT (Intermediary Guidelines and
                Digital Media Ethics Code) Rules, 2021</span>: We act as an intermediary and will remove
                unlawful content upon actual knowledge or on receiving valid court/government orders.
                We designate a Grievance Officer and follow takedown timelines.</li>
              <li><span className="font-medium">Digital Personal Data Protection Act, 2023 (DPDP)</span>: We respect data principal
                rights and apply reasonable security safeguards. Breaches may be reported to
                authorities as required.</li>
              <li><span className="font-medium">Indian Penal Code (IPC)</span>: users must not post content that constitutes defamation
                (Sections 499/500), obscenity (Section 292), criminal intimidation (Section 506), or
                any other offense. Violations may result in account action and referral to law
                enforcement.</li>
              <li><span className="font-medium">POCSO Act, 2012</span>: strict prohibition on child sexual abuse material; we will
                report to competent authorities.</li>
              <li><span className="font-medium">Copyright Act, 1957</span>: respect intellectual property; submit takedown requests with
                necessary details for prompt action.</li>
              <li><span className="font-medium">Consumer Protection Act, 2019</span>: we aim for fair practices; any paid features (if
                introduced later) will include clear terms and refund policies.</li>
            </ul>
            <p className="text-base-content/70">
              <span className="font-medium">Enforcement & Penalties:</span> Depending on severity, we may issue warnings, remove
              content, temporarily suspend, or permanently terminate accounts. We may cooperate with
              law enforcement and disclose information when legally compelled.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">7. Moderation, Reporting & Takedown</h2>
            <ul className="list-disc ml-5 text-base-content/70 space-y-2">
              <li>Use in-app tools or email to report abuse or unlawful content.</li>
              <li>We strive to acknowledge complaints within 24 hours and aim to resolve within 15 days,
                per IT Rules 2021 expectations.</li>
              <li>We may preserve relevant data to comply with investigations and lawful requests.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">8. Security & Responsible Use</h2>
            <p className="text-base-content/70">
              We apply reasonable technical and organizational measures to protect data. No system is
              perfectly secure; please use strong passwords and avoid sharing sensitive information
              unnecessarily.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">9. Service Availability & Warranty Disclaimer</h2>
            <p className="text-base-content/70">
              Chat4U is provided on an "as is" and "as available" basis without warranties of any kind.
              We do not guarantee uninterrupted availability, error-free operation, or preservation of
              messages beyond normal functioning. Features may change during beta.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">10. Limitation of Liability</h2>
            <p className="text-base-content/70">
              To the maximum extent permitted by law, Chat4U and its Founder will not be liable for
              indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">11. Termination</h2>
            <p className="text-base-content/70">
              We may suspend or terminate your account at our discretion for violations or risk to the
              platform. You may terminate at any time by deleting your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">12. Governing Law & Jurisdiction</h2>
            <p className="text-base-content/70">
              These Terms are governed by the laws of India. You agree to the jurisdiction of competent
              courts in India for any disputes arising from or related to the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">13. Changes to This Agreement</h2>
            <p className="text-base-content/70">
              We may update these Terms and the Privacy Policy from time to time. We will post updates
              here. Continued use of Chat4U after changes signifies your acceptance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">14. Contact & Grievance Officer</h2>
            <p className="text-base-content/70">
              Grievance Officer: <span className="font-medium">Founder</span> —
              <span className="font-medium"> ayushkrsna01@gmail.com</span>
            </p>
            <p className="text-base-content/70">
              For complaints or rights requests (access, correction, deletion), email us. We aim to
              acknowledge within 24 hours and resolve within 15 days.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;