"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";
import { FieldShell, Input } from "@/components/ui/field";
import { updateSchoolProfileAction } from "@/modules/schools/actions";
import type { SchoolProfile } from "@/modules/schools/repository";
import type { SchoolProfileFormState } from "@/modules/schools/service";

const initialState: SchoolProfileFormState = { status: "idle" };

function SaveButton() {
  const { pending } = useFormStatus();
  return <button className="button button--primary button--md" type="submit" disabled={pending}>{pending ? "در حال ذخیره…" : <><Save size={16} /> ذخیره تغییرات</>}</button>;
}

export function SchoolSettingsForm({ profile, canEdit }: { profile: SchoolProfile; canEdit: boolean }) {
  const [state, formAction] = useActionState(updateSchoolProfileAction, initialState);
  return (
    <form action={formAction} className="settings-form">
      <div className="settings-form__grid">
        <FieldShell label="نام مدرسه" htmlFor="name" required error={state.fieldErrors?.name?.[0]}>
          <Input id="name" name="name" defaultValue={profile.name} disabled={!canEdit} required aria-invalid={Boolean(state.fieldErrors?.name)} />
        </FieldShell>
        <FieldShell label="کد مدرسه" htmlFor="code" error={state.fieldErrors?.code?.[0]}>
          <Input id="code" name="code" defaultValue={profile.code ?? ""} disabled={!canEdit} inputMode="numeric" />
        </FieldShell>
        <FieldShell label="استان" htmlFor="province" error={state.fieldErrors?.province?.[0]}>
          <Input id="province" name="province" defaultValue={profile.province ?? ""} disabled={!canEdit} />
        </FieldShell>
        <FieldShell label="شهر" htmlFor="city" error={state.fieldErrors?.city?.[0]}>
          <Input id="city" name="city" defaultValue={profile.city ?? ""} disabled={!canEdit} />
        </FieldShell>
        <FieldShell label="شماره تماس" htmlFor="phone" error={state.fieldErrors?.phone?.[0]}>
          <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} disabled={!canEdit} inputMode="tel" dir="ltr" />
        </FieldShell>
      </div>
      {state.message ? <p className={`form-message form-message--${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
      {canEdit ? <div className="settings-form__actions"><SaveButton /></div> : <p className="form-message">ویرایش مشخصات مدرسه فقط برای مدیر مدرسه مجاز است.</p>}
    </form>
  );
}
