import { DataPayLogo } from "../components/DataPayLogo";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}): JSX.Element {
  return (
    <main className="loginPage">
      <form className="loginCard" action={loginAction}>
        <div className="loginLogo">
          <DataPayLogo size={36} tagline="Ops portal" />
        </div>
        <h1>Ops sign-in</h1>
        <p className="lede">One shared password for the ops team — see SPEC.md §25.</p>

        {searchParams.error && <div className="errorBanner">{searchParams.error}</div>}

        <input type="hidden" name="next" value={searchParams.next ?? "/"} />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
        />
        <button type="submit" className="submitBtn">
          Sign in
        </button>
      </form>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .loginPage { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #F6F5F1; }
        .loginCard { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 12px; background: #fff; border: 1px solid #e1e0d9; border-radius: 10px; padding: 32px; }
        .loginLogo { margin-bottom: 8px; }
        h1 { font-size: 1.4rem; margin: 4px 0; }
        .lede { color: #898781; font-size: 13px; margin: 0 0 8px; }
        input[type="password"] { padding: 10px 12px; border-radius: 6px; border: 1px solid #d8d7cf; background: #fcfcfb; font-size: 14px; font-family: inherit; }
        .submitBtn { padding: 10px 20px; border-radius: 999px; border: 1px solid #0E7A5C; background: #0E7A5C; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }
        .errorBanner { background: #f3e4e2; border: 1px solid #8c3a34; color: #8c3a34; border-radius: 6px; padding: 10px 14px; font-size: 13px; }
        @media (prefers-color-scheme: dark) {
          .loginPage { background: #101418; }
          .loginCard { background: #14161b; border-color: #2c2c2a; }
          .lede { color: #9b9a94; }
          input[type="password"] { background: #1a1a19; border-color: #2c2c2a; color: #fff; }
          .submitBtn { border-color: #12946F; background: #12946F; }
          .errorBanner { background: #2e1f1e; border-color: #d98a83; color: #d98a83; }
        }
      `,
        }}
      />
    </main>
  );
}
