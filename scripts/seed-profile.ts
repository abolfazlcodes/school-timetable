export type SeedProfile = "demo" | "shahid-beheshti";

export type SeedIdentity = {
  admin: { email: string; fullName: string; password: string };
  vicePrincipal: { email: string; fullName: string; password: string };
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveSeedProfile(value: string | undefined): SeedProfile {
  if (!value || value === "demo") return "demo";
  if (value === "shahid-beheshti") return value;
  throw new Error(`SEED_PROFILE نامعتبر است: ${value}`);
}

type SeedEnvironment = Readonly<Record<string, string | undefined>>;

function requiredDeliveryValue(environment: SeedEnvironment, key: string) {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`برای seed تحویلی، متغیر ${key} الزامی است.`);
  return value;
}

function validateDeliveryAccount(email: string, password: string, label: string) {
  if (!emailPattern.test(email)) throw new Error(`ایمیل حساب ${label} معتبر نیست.`);
  if (password.length < 12) throw new Error(`رمز حساب ${label} باید حداقل ۱۲ نویسه باشد.`);
}

export function resolveSeedIdentity(
  profile: SeedProfile,
  environment: SeedEnvironment = process.env,
): SeedIdentity {
  if (profile === "demo") {
    return {
      admin: {
        email: environment.SEED_ADMIN_EMAIL?.trim() || "admin@madreseyar.ir",
        fullName: environment.SEED_ADMIN_NAME?.trim() || "مریم نادری",
        password: environment.SEED_ADMIN_PASSWORD || "Demo123!",
      },
      vicePrincipal: {
        email: environment.SEED_VICE_PRINCIPAL_EMAIL?.trim() || "moaven@madreseyar.ir",
        fullName: environment.SEED_VICE_PRINCIPAL_NAME?.trim() || "رضا کریمی",
        password: environment.SEED_VICE_PRINCIPAL_PASSWORD || "Demo123!",
      },
    };
  }

  const adminEmail = requiredDeliveryValue(environment, "SEED_ADMIN_EMAIL");
  const adminPassword = requiredDeliveryValue(environment, "SEED_ADMIN_PASSWORD");
  const vicePrincipalEmail = requiredDeliveryValue(environment, "SEED_VICE_PRINCIPAL_EMAIL");
  const vicePrincipalPassword = requiredDeliveryValue(environment, "SEED_VICE_PRINCIPAL_PASSWORD");
  validateDeliveryAccount(adminEmail, adminPassword, "مدیر");
  validateDeliveryAccount(vicePrincipalEmail, vicePrincipalPassword, "معاون");
  if (adminEmail.toLowerCase() === vicePrincipalEmail.toLowerCase()) {
    throw new Error("ایمیل مدیر و معاون باید متفاوت باشد.");
  }
  if (adminPassword === vicePrincipalPassword) {
    throw new Error("رمز مدیر و معاون نباید یکسان باشد.");
  }

  return {
    admin: {
      email: adminEmail.toLowerCase(),
      fullName: environment.SEED_ADMIN_NAME?.trim() || "مدیر سامانه",
      password: adminPassword,
    },
    vicePrincipal: {
      email: vicePrincipalEmail.toLowerCase(),
      fullName: "حمید باقری",
      password: vicePrincipalPassword,
    },
  };
}
