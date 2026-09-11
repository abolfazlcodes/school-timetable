"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { loginAction, type LoginFormState } from "@/modules/auth/actions";

const initialState: LoginFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button className="button button--primary button--md login-submit" type="submit" disabled={pending}>{pending ? "در حال ورود…" : <><LogIn size={17} /> ورود به سامانه</>}</button>;
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  return (
    <form className="login-form" action={formAction} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="email">ایمیل</label>
        <span className="input-with-icon"><Mail size={17} aria-hidden="true" /><input className="input" id="email" name="email" type="email" inputMode="email" autoComplete="username" dir="ltr" required aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email ? "email-error" : undefined} /></span>
        {state.fieldErrors?.email ? <p className="field__error" id="email-error">{state.fieldErrors.email[0]}</p> : null}
      </div>
      <div className="field">
        <label className="field__label" htmlFor="password">رمز عبور</label>
        <span className="input-with-icon"><LockKeyhole size={17} aria-hidden="true" /><input className="input" id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={state.fieldErrors?.password ? "password-error" : undefined} /></span>
        {state.fieldErrors?.password ? <p className="field__error" id="password-error">{state.fieldErrors.password[0]}</p> : null}
      </div>
      {state.status === "error" && state.message ? <p className="form-message form-message--error" role="alert">{state.message}</p> : null}
      <SubmitButton />
    </form>
  );
}
