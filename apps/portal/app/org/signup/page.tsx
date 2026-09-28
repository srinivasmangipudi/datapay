import { DataPayLogo } from "../../components/DataPayLogo";
import { orgSignupAction } from "./actions";

export const dynamic = "force-dynamic";

export default function OrgSignupPage({
  searchParams,
}: {
  searchParams: { error?: string; submitted?: string };
}): JSX.Element {
  return (
    <main className="loginPage">
      <form className="loginCard" action={orgSignupAction}>
        <div className="loginLogo">
          <DataPayLogo size={36} tagline="Organization sign-up" />
        </div>
        <h1>Create your organization account</h1>
        {/* A household landing here has taken a wrong turn — say so before they
            fill in a form that will sit unapproved forever, and point at the
            thing they actually wanted. */}
        <p className="notForMembers">
          <strong>This is for businesses and organizations.</strong> If you want to answer questions
          and earn tokens, you don&apos;t need an account here —{" "}
          <a href="https://play.google.com/store/apps/details?id=org.datapay.mobile" target="_blank" rel="noopener noreferrer">
            get the DataPay app
          </a>{" "}
          instead.
        </p>
        <p className="lede">
          An ops reviewer activates every new organization before it can submit questions or list
          products — check back and log in once approved. Already have an account?{" "}
          <a href="/org/login">Sign in</a>.
        </p>

        {searchParams.error && <div className="errorBanner">{searchParams.error}</div>}
        {searchParams.submitted && (
          <div className="successBanner">
            Account created — awaiting approval. Try logging in once you've heard it's active.
          </div>
        )}

        <input name="name" placeholder="Company name" autoFocus required />
        <input type="email" name="email" placeholder="Work email" autoComplete="username" required />
        <input
          type="password"
          name="password"
          placeholder="Password (min 8 characters)"
          minLength={8}
          autoComplete="new-password"
          required
        />
        <button type="submit" className="submitBtn">
          Create account
        </button>
      </form>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .loginPage { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #F6F5F1; }
        .loginCard { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 12px; background: #fff; border: 1px solid #e1e0d9; border-radius: 10px; padding: 32px; }
        .loginLogo { margin-bottom: 8px; }
        h1 { font-size: 1.4rem; margin: 4px 0; }
        .lede { color: #898781; font-size: 13px; margin: 0 0 8px; line-height: 1.5; }
        .lede a { color: #0E7A5C; font-weight: 600; }
        .notForMembers { font-size: 13px; line-height: 1.55; margin: 0 0 14px; padding: 12px 14px; border: 1px solid #0E7A5C33; border-left: 3px solid #0E7A5C; border-radius: 8px; background: #0E7A5C0A; color: #4a4843; }
        .notForMembers strong { color: #23221f; }
        .notForMembers a { color: #0E7A5C; font-weight: 600; }
        input { padding: 10px 12px; border-radius: 6px; border: 1px solid #d8d7cf; background: #fcfcfb; font-size: 14px; font-family: inherit; }
        .submitBtn { padding: 10px 20px; border-radius: 999px; border: 1px solid #0E7A5C; background: #0E7A5C; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
        .errorBanner { background: #f3e4e2; border: 1px solid #8c3a34; color: #8c3a34; border-radius: 6px; padding: 10px 14px; font-size: 13px; }
        .successBanner { background: #E3EFEA; border: 1px solid #0E7A5C; color: #0E7A5C; border-radius: 6px; padding: 10px 14px; font-size: 13px; }
        @media (prefers-color-scheme: dark) {
          .loginPage { background: #101418; }
          .loginCard { background: #14161b; border-color: #2c2c2a; }
          .lede { color: #9b9a94; }
          .lede a { color: #12946F; }
          .notForMembers { border-color: #12946F44; border-left-color: #12946F; background: #12946F14; color: #b8b7b0; }
          .notForMembers strong { color: #f2f1ec; }
          .notForMembers a { color: #12946F; }
          input { background: #1a1a19; border-color: #2c2c2a; color: #fff; }
          .submitBtn { border-color: #12946F; background: #12946F; }
          .errorBanner { background: #2e1f1e; border-color: #d98a83; color: #d98a83; }
          .successBanner { background: #16211d; border-color: #12946F; color: #7fcab0; }
        }
      `,
        }}
      />
    </main>
  );
}
