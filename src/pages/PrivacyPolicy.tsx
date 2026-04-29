import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface)',
      color: 'var(--white)',
      fontFamily: "'Barlow', sans-serif",
      overflowX: 'hidden',
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
          Privacy Policy
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
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
            Effective date: 29 April 2026 · Last updated: 29 April 2026
          </p>
        </div>

        <Section title="1. Who We Are">
          <P>
            BREAKTAPES ("we", "our", "us") is an endurance-athlete training and race-history app
            operated by Ayush Krishnan. The app is available at{' '}
            <A href="https://app.breaktapes.com">app.breaktapes.com</A>. This Privacy Policy
            explains how we collect, use, share, and protect personal information when you use
            our service.
          </P>
          <P>
            For privacy enquiries use our{' '}
            <a href="/help" style={{ color: 'var(--orange)', textDecoration: 'none' }}>contact form</a>.
          </P>
        </Section>

        <Section title="2. Information We Collect">
          <SubSection title="2.1 Account information">
            <P>
              When you create an account we collect your email address and a hashed password via
              our authentication provider (Clerk). You may optionally provide a display name,
              profile photo, date of birth, gender, nationality, height, weight, club affiliations,
              and a short biography.
            </P>
          </SubSection>
          <SubSection title="2.2 Race and training data">
            <P>
              You voluntarily enter race history, finish times, placing, splits, medal photos,
              gear notes, goals, upcoming events, and related performance data. This data is
              stored in your account and synced across your devices.
            </P>
          </SubSection>
          <SubSection title="2.3 Wearable and health data">
            <P>
              If you connect a third-party wearable service you authorise us to receive:
            </P>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.9 }}>
              <li><strong>WHOOP</strong> — workout activities and daily recovery scores.</li>
              <li><strong>Garmin</strong> — wellness activities from the Garmin Health API.</li>
              <li><strong>Strava</strong> — activities, distances, and durations.</li>
              <li>
                <strong>Apple Health</strong> — health records exported by you from the iOS
                Health app and uploaded directly. The file is processed on your device and the
                resulting records are stored in your account. We never receive access to your
                HealthKit store.
              </li>
            </ul>
            <P>
              Health data is stored per-user with row-level security. It is never sold or shared
              with third parties for advertising.
            </P>
          </SubSection>
          <SubSection title="2.4 Location data">
            <P>
              We request your browser's coarse geolocation once to fetch a local weather forecast
              on the dashboard. Coordinates are cached for one hour in your browser's local
              storage and are not sent to our servers. Race city/country names you enter are
              geocoded using the Nominatim public API (OpenStreetMap) to draw map markers.
            </P>
          </SubSection>
          <SubSection title="2.5 Usage and technical data">
            <P>
              Our hosting provider Cloudflare may log standard server-side request metadata
              (IP address, user agent, referrer, request path, response code, timestamp) for
              security and performance purposes. We do not operate independent analytics or
              tracking pixels.
            </P>
          </SubSection>
          <SubSection title="2.6 Feedback (staging / beta)">
            <P>
              On our staging environment (<A href="https://dev.breaktapes.com">dev.breaktapes.com</A>)
              beta testers may submit optional star ratings and text feedback. This is stored in
              our database and used solely to improve the product.
            </P>
          </SubSection>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>Provide, personalise, and improve the BREAKTAPES service.</li>
            <li>Sync your data across your devices.</li>
            <li>Display weather forecasts, performance analytics, and race insights.</li>
            <li>Power your public athlete profile if you choose to enable it.</li>
            <li>Communicate product updates or support responses to the email you registered.</li>
            <li>Detect and prevent fraud, abuse, and security incidents.</li>
            <li>Comply with legal obligations.</li>
          </ul>
          <P>
            We do not use your data to train AI models, serve advertisements, or sell it
            to data brokers.
          </P>
        </Section>

        <Section title="4. Public Profiles">
          <P>
            You may opt in to a public athlete profile at{' '}
            <code style={codeStyle}>app.breaktapes.com/u/[username]</code>. When enabled,
            the information you choose to make visible (race history, personal bests, statistics,
            upcoming races) is accessible to anyone on the internet without an account. You can
            make your profile private or delete it at any time from Settings. Profile visibility
            toggles take effect immediately.
          </P>
        </Section>

        <Section title="5. Sharing of Information">
          <P>We share personal data only in the following limited circumstances:</P>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>
              <strong>Infrastructure providers</strong> — Supabase (database and storage,
              EU/US data centres), Cloudflare (CDN and Workers hosting), Clerk (authentication).
              Each provider is bound by a data processing agreement.
            </li>
            <li>
              <strong>Third-party wearable platforms</strong> — OAuth tokens for WHOOP, Garmin,
              and Strava are stored server-side to fetch your activity data on your behalf.
              We access only the scopes you explicitly grant.
            </li>
            <li>
              <strong>Legal requirements</strong> — We may disclose information if required
              by law, court order, or to protect our legal rights.
            </li>
            <li>
              <strong>Business transfer</strong> — In the event of a merger, acquisition, or
              sale of assets, user data may be transferred with advance notice to affected users.
            </li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <P>
            We retain your account data for as long as your account is active. You may
            permanently delete your account and all associated data at any time via
            Settings → Manage Account → Delete Account. Deletion is irreversible and processed
            within 30 days. Anonymised aggregate statistics (e.g. total race counts) may be
            retained indefinitely.
          </P>
          <P>
            Wearable activity data is retained until you disconnect the integration or delete
            your account. You may also manually clear imported Apple Health data from Settings.
          </P>
        </Section>

        <Section title="7. Security">
          <P>
            All data is transmitted over HTTPS/TLS. Wearable OAuth client secrets are stored
            exclusively server-side in encrypted environment variables and are never exposed
            to the browser. Supabase row-level security ensures each user can only read and
            write their own data. Passwords are hashed by Clerk using industry-standard
            algorithms — we never store plaintext passwords.
          </P>
          <P>
            No security measure is 100% effective. If you believe your account has been
            compromised,{' '}
            <a href="/help" style={{ color: 'var(--orange)', textDecoration: 'none' }}>contact us immediately</a>.
          </P>
        </Section>

        <Section title="8. Your Rights">
          <P>
            Depending on your jurisdiction you may have the right to:
          </P>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li><strong>Access</strong> — request a copy of the data we hold about you.</li>
            <li><strong>Rectification</strong> — correct inaccurate data via your profile settings.</li>
            <li><strong>Erasure</strong> — delete your account and all data (see Section 6).</li>
            <li><strong>Portability</strong> — export your race history in JSON format.</li>
            <li><strong>Objection</strong> — object to processing for certain purposes.</li>
            <li><strong>Restriction</strong> — request that we limit processing of your data.</li>
          </ul>
          <P>
            To exercise any of these rights, use our{' '}
            <a href="/help" style={{ color: 'var(--orange)', textDecoration: 'none' }}>contact form</a>.
            We will respond within 30 days.
          </P>
        </Section>

        <Section title="9. Children">
          <P>
            BREAKTAPES is not directed at children under 13. We do not knowingly collect
            personal information from children under 13. If you believe a child has provided
            us with personal information, contact us and we will delete it promptly.
          </P>
        </Section>

        <Section title="10. Cookies and Local Storage">
          <P>
            We do not use third-party advertising or tracking cookies. We use browser
            local storage and session storage to persist your app preferences (theme, units,
            layout, cached geocoding results) and authentication tokens. These are necessary
            for the app to function and are not shared with third parties.
          </P>
        </Section>

        <Section title="11. Third-Party Services">
          <P>
            The following third-party services are integrated into BREAKTAPES. Each has its
            own privacy policy governing data they collect:
          </P>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li><A href="https://supabase.com/privacy">Supabase</A> — database and auth infrastructure</li>
            <li><A href="https://clerk.com/legal/privacy">Clerk</A> — user authentication</li>
            <li><A href="https://www.cloudflare.com/privacypolicy/">Cloudflare</A> — hosting and CDN</li>
            <li><A href="https://www.whoop.com/privacy/">WHOOP</A> — wearable health data (optional)</li>
            <li><A href="https://www.garmin.com/en-US/privacy/connect/policy/">Garmin</A> — wearable activity data (optional)</li>
            <li><A href="https://www.strava.com/legal/privacy">Strava</A> — training activities (optional)</li>
            <li><A href="https://open-meteo.com/en/terms">Open-Meteo</A> — weather forecasts</li>
            <li>Nominatim / OpenStreetMap — geocoding (city/country names only, no personal data sent)</li>
          </ul>
        </Section>

        <Section title="12. Changes to This Policy">
          <P>
            We may update this Privacy Policy from time to time. Material changes will be
            communicated via an in-app notice or email at least 14 days before they take
            effect. Continued use after the effective date constitutes acceptance of the
            updated policy. The current version is always available at{' '}
            <A href="https://app.breaktapes.com/privacy">app.breaktapes.com/privacy</A>.
          </P>
        </Section>

        <Section title="13. Contact">
          <P>
            Questions or concerns about this policy?{' '}
            <a href="/help" style={{ color: 'var(--orange)', textDecoration: 'none' }}>Use our contact form</a>.
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
            href="/terms"
            style={{ color: 'var(--orange)', textDecoration: 'none' }}
          >
            Terms & Conditions →
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

const codeStyle: React.CSSProperties = {
  background: 'var(--surface3)',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: 'monospace',
}
