import { useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Command, LoaderCircle } from "lucide-react";
import { getApiErrorMessage, loginWithGoogle } from "../helpers/helpers";
import { queryKeys } from "../lib/query-keys";

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [googleError, setGoogleError] = useState("");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const loginMutation = useMutation({
    mutationFn: loginWithGoogle,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.currentUser, user);
      navigate("/", { replace: true });
    },
  });

  const loginError = googleError
    ? googleError
    : loginMutation.isError
      ? getApiErrorMessage(
          loginMutation.error,
          "Sign-in failed. Please try again.",
        )
      : "";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0c0b] px-4 py-10 font-sans text-white">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g stroke="#242624" strokeWidth="1">
          <path d="M0 110h360l72 72v150l72 72" />
          <path d="M0 790h360l72-72V568l72-72" />
          <path d="M1440 110h-360l-72 72v150l-72 72" />
          <path d="M1440 790h-360l-72-72V568l-72-72" />
        </g>
        <g fill="#171917" stroke="#333633">
          <rect x="42" y="88" width="100" height="44" rx="8" />
          <rect x="42" y="768" width="100" height="44" rx="8" />
          <rect x="1298" y="88" width="100" height="44" rx="8" />
          <rect x="1298" y="768" width="100" height="44" rx="8" />
        </g>
        <g fill="#3c423d">
          <circle cx="158" cy="110" r="3" />
          <circle cx="1282" cy="110" r="3" />
          <circle cx="158" cy="790" r="3" />
          <circle cx="1282" cy="790" r="3" />
        </g>
        <g fill="#343934">
          <circle cx="62" cy="104" r="1" />
          <circle cx="72" cy="104" r="1" />
          <circle cx="82" cy="104" r="1" />
          <circle cx="92" cy="104" r="1" />
          <circle cx="102" cy="104" r="1" />
          <circle cx="1326" cy="104" r="1" />
          <circle cx="1336" cy="104" r="1" />
          <circle cx="1346" cy="104" r="1" />
          <circle cx="1356" cy="104" r="1" />
          <circle cx="1366" cy="104" r="1" />
          <circle cx="62" cy="784" r="1" />
          <circle cx="72" cy="784" r="1" />
          <circle cx="82" cy="784" r="1" />
          <circle cx="92" cy="784" r="1" />
          <circle cx="102" cy="784" r="1" />
          <circle cx="1326" cy="784" r="1" />
          <circle cx="1336" cy="784" r="1" />
          <circle cx="1346" cy="784" r="1" />
          <circle cx="1356" cy="784" r="1" />
          <circle cx="1366" cy="784" r="1" />
        </g>
      </svg>

      <section className="relative z-10 w-full max-w-[380px] rounded-2xl border border-white/[0.08] bg-[#171817] px-7 py-8 shadow-[0_24px_100px_rgba(0,0,0,0.65)] sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-14 top-8 h-8 bg-[radial-gradient(circle,#45524a_1px,transparent_1px)] bg-size-[8px_8px] opacity-30"
        />
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-5 flex size-11 items-center justify-center rounded-xl border border-white/10 bg-[#202220] text-[#c5f06e] shadow-[0_4px_18px_rgba(0,0,0,0.3)]">
            <Command size={22} />
          </div>
          <p className="mb-2 text-[10px] font-medium tracking-[0.2em] text-white/40 uppercase">
            Fieldwork workspace
          </p>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="mt-2 max-w-xs text-xs leading-5 text-white/50">
            Sign in to your workspace and pick up where you left off.
          </p>

          <div className="mt-8 w-full">
            {clientId ? (
              <GoogleOAuthProvider clientId={clientId}>
                <div
                  className={`flex min-h-11 justify-center transition-opacity ${
                    loginMutation.isPending
                      ? "pointer-events-none opacity-60"
                      : ""
                  }`}
                  aria-busy={loginMutation.isPending}
                >
                  <GoogleLogin
                    onSuccess={(response) => {
                      setGoogleError("");
                      loginMutation.reset();
                      if (!response.credential) {
                        setGoogleError(
                          "Google did not return a sign-in credential. Please try again.",
                        );
                        return;
                      }
                      loginMutation.mutate(response.credential);
                    }}
                    onError={() => {
                      setGoogleError(
                        "Google sign-in could not be completed. Please try again.",
                      );
                    }}
                    theme="filled_blue"
                    size="large"
                    text="continue_with"
                    shape="rectangular"
                    width="320"
                  />
                </div>
              </GoogleOAuthProvider>
            ) : (
              <div
                className="rounded-lg border border-[#634137]/60 bg-[#271b18] px-4 py-3 text-left text-xs leading-5 text-[#e7b6a3]"
                role="alert"
              >
                Google sign-in is not configured. Set{" "}
                <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">
                  VITE_GOOGLE_CLIENT_ID
                </code>{" "}
                to enable login.
              </div>
            )}
          </div>

          {loginMutation.isPending && (
            <p
              className="mt-4 flex items-center gap-2 text-xs text-white/55"
              role="status"
            >
              <LoaderCircle size={14} className="animate-spin" />
              Signing in…
            </p>
          )}
          {loginError && (
            <p
              className="mt-4 w-full rounded-lg border border-[#634137]/60 bg-[#271b18] px-4 py-3 text-left text-xs leading-5 text-[#e7b6a3]"
              role="alert"
            >
              {loginError}
            </p>
          )}
        </div>

        <div className="mt-8 flex items-center gap-3 text-[10px] tracking-[0.12em] text-white/25 uppercase">
          <span className="h-px flex-1 bg-white/[0.08]" />
          Secure access
          <span className="h-px flex-1 bg-white/[0.08]" />
        </div>
        <p className="mt-4 text-center text-[10px] leading-5 text-white/35">
          Continue only with your approved Google account.
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
