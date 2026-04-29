import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function TermsAndConditions() {
  const navigate = useNavigate()

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: 'var(--surface)',
      color: 'var(--white)',
      fontFamily: "'Barlow', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1rem',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}>
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--white)',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 14,
            opacity: 0.7,
          }}
        >
          ← Back
        </button>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Terms & Conditions
        </span>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '2rem 1.25rem 4rem',
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900,
            fontSize: 40,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            margin: 0,
          }}>
            Terms & Conditions
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
            Effective date: 29 April 2026 · Last updated: 29 April 2026
          </p>
        </div>

        <Section title="1. Acceptance of Terms">
          <P>
            By creating an account or using BREAKTAPES ("the Service") at{' '}
            <A href="https://app.breaktapes.com">app.breaktapes.com</A>, you agree to
            be bound by these Terms & Conditions ("Terms"). If you do not agree, do not
            use the Service.
          </P>
        </Section>

        <Section title="2. Eligibility">
          <P>
            You must be at least 13 years old to use BREAKTAPES. By using the Service
            you represent that you meet this requirement. If you are under 18, you confirm
            that you have obtained the consent of a parent or legal guardian.
          </P>
        </Section>

        <Section title="3. Your Account">
          <P>
            You are responsible for maintaining the confidentiality of your credentials
            and for all activity that occurs under your account. If you believe your account
            has been compromised,{' '}
            <a href="/help" style={{ color: 'var(--orange)', textDecoration: 'none' }}>notify us immediately</a>.
          </P>
          <P>
            You agree to provide accurate, current information when registering and to keep
            your profile details up to date. We reserve the right to suspend or terminate
            accounts that contain materially false information.
          </P>
        </Section>

        <Section title="4. Permitted Use">
          <P>
            BREAKTAPES is a personal training and race-tracking tool. You may use the
            Service to:
          </P>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>Log your own race history, training activities, and performance data.</li>
            <li>Connect wearable devices to import your health and activity data.</li>
            <li>Share a public athlete profile if you choose to enable one.</li>
            <li>Discover races and plan your racing season.</li>
          </ul>
        </Section>

        <Section title="5. Prohibited Conduct">
          <P>You agree not to:</P>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
            <li>Submit false race results, placing, or personal records.</li>
            <li>Impersonate another person or entity.</li>
            <li>Scrape, crawl, or systematically extract data from the Service without our written permission.</li>
            <li>Attempt to reverse-engineer, decompile, or otherwise extract the source code of the Service.</li>
            <li>
              Interfere with or disrupt the integrity or performance of the Service, its servers,
              or networks connected to it.
            </li>
            <li>Upload malicious files, viruses, or any other harmful software.</li>
            <li>
              Use the Service to harvest or collect personal data about other users without
              their consent.
            </li>
            <li>
              Use automated tools to create accounts, submit data, or interact with the
              Service in ways not intended by us.
            </li>
          </ul>
        </Section>

        <Section title="6. Your Content">
          <SubSection title="6.1 Ownership">
            <P>
              You retain all rights to the content you submit — race results, photos, notes,
              profile information, and any other data you enter ("Your Content").
            </P>
          </SubSection>
          <SubSection title="6.2 Licence to us">
            <P>
              By submitting Your Content you grant us a non-exclusive, royalty-free, worldwide
              licence to store, process, and display it solely for the purpose of operating
              and improving the Service. We will not use your race results or health data
              in any marketing material without your explicit consent.
            </P>
          </SubSection>
          <SubSection title="6.3 Public profile content">
            <P>
              If you enable a public athlete profile, Your Content on that profile will be
              accessible to any internet user. You are solely responsible for what you choose
              to make public. You can disable your public profile at any time from Settings.
            </P>
          </SubSection>
          <SubSection title="6.4 Responsibility">
            <P>
              You are solely responsible for Your Content. You represent that you have all
              necessary rights to submit it and that it does not violate any third-party
              intellectual property rights, privacy rights, or applicable law.
            </P>
          </SubSection>
        </Section>

        <Section title="7. Wearable and Third-Party Integrations">
          <P>
            Connecting a third-party service (WHOOP, Garmin, Strava, Apple Health) is optional.
            By connecting, you authorise us to access data from that service on your behalf
            under the scopes you grant. You can revoke access at any time from Settings →
            Train → Wearables, or by revoking permissions directly in the third-party platform.
          </P>
          <P>
            We are not responsible for the availability, accuracy, or content of third-party
            platforms. Their terms of service and privacy policies govern your use of those
            platforms independently of your use of BREAKTAPES.
          </P>
        </Section>

        <Section title="8. Race Catalog Data">
          <P>
            The race catalog in BREAKTAPES contains publicly available race information. Race
            dates, distances, and event details may change. We make no guarantee of accuracy
            or completeness. Always verify event details directly with race organisers before
            registering or travelling.
          </P>
        </Section>

        <Section title="9. Intellectual Property">
          <P>
            All rights in the BREAKTAPES name, logo, design, software, and original content
            (excluding Your Content) are owned by or licensed to us. Nothing in these Terms
            grants you any right to use our trademarks, trade names, or branding without
            our prior written consent.
          </P>
        </Section>

        <Section title="10. Privacy">
          <P>
            Your use of the Service is also governed by our{' '}
            <a href="/privacy" style={{ color: 'var(--orange)', textDecoration: 'none' }}>
              Privacy Policy
            </a>
            , which is incorporated into these Terms by reference.
          </P>
        </Section>

        <Section title="11. Disclaimer of Warranties">
          <P>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
            KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </P>
          <P>
            We do not warrant that the Service will be uninterrupted, error-free, or free
            of harmful components. BREAKTAPES is a personal tool — it is not a substitute
            for professional coaching, medical advice, or nutritional guidance. Consult
            qualified professionals before making training decisions based on data in the app.
          </P>
        </Section>

        <Section title="12. Limitation of Liability">
          <P>
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WE BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF PROFITS, OR
            PERSONAL INJURY, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE,
            EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </P>
          <P>
            OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING
            TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT
            YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) USD 50.
          </P>
        </Section>

        <Section title="13. Indemnification">
          <P>
            You agree to indemnify and hold harmless BREAKTAPES, its operators, affiliates,
            and service providers from any claims, damages, losses, liabilities, costs, and
            expenses (including reasonable legal fees) arising from: (a) your use of the
            Service; (b) Your Content; (c) your violation of these Terms; or (d) your
            violation of any third-party rights.
          </P>
        </Section>

        <Section title="14. Termination">
          <P>
            We may suspend or terminate your access to the Service at any time if we
            reasonably believe you have violated these Terms. You may terminate your account
            at any time via Settings → Manage Account → Delete Account.
          </P>
          <P>
            Upon termination, your right to use the Service ceases immediately. Sections 6.1
            (ownership of Your Content), 9, 11, 12, 13, and 16 survive termination.
          </P>
        </Section>

        <Section title="15. Changes to Terms">
          <P>
            We may update these Terms at any time. Material changes will be communicated
            via an in-app notice or email at least 14 days before they take effect.
            Continued use after the effective date constitutes acceptance of the updated Terms.
            The current version is always available at{' '}
            <A href="https://app.breaktapes.com/terms">app.breaktapes.com/terms</A>.
          </P>
        </Section>

        <Section title="16. Governing Law">
          <P>
            These Terms are governed by and construed in accordance with the laws of India,
            without regard to its conflict-of-law provisions. Any dispute arising under these
            Terms shall be subject to the exclusive jurisdiction of the courts located in
            Bangalore, India.
          </P>
        </Section>

        <Section title="17. Contact">
          <P>
            For questions about these Terms, use our{' '}
            <a href="/help" style={{ color: 'var(--orange)', textDecoration: 'none' }}>contact form</a>.
          </P>
        </Section>

        <div style={{
          marginTop: '3rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border)',
          color: 'var(--muted)',
          fontSize: 13,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          justifyContent: 'space-between',
        }}>
          <span>© 2026 BREAKTAPES</span>
          <a
            href="/privacy"
            style={{ color: 'var(--orange)', textDecoration: 'none' }}
          >
            Privacy Policy →
          </a>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h2 style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        fontSize: 20,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--orange)',
        marginBottom: '0.75rem',
        marginTop: 0,
      }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{
        fontFamily: "'Barlow', sans-serif",
        fontWeight: 600,
        fontSize: 15,
        margin: '0 0 0.4rem',
        color: 'var(--white)',
      }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 15,
      lineHeight: 1.75,
      color: 'rgba(245,245,245,0.8)',
      margin: '0 0 0.75rem',
    }}>
      {children}
    </p>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('mailto') ? undefined : '_blank'}
      rel="noopener noreferrer"
      style={{ color: 'var(--orange)', textDecoration: 'none' }}
    >
      {children}
    </a>
  )
}
