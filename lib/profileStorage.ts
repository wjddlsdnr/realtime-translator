import type { LanguageCode, UserProfile } from "./types";

const PROFILE_STORAGE_KEY = "realtime-translator-user-profile";

/** 저장된 사용자 프로필을 불러옵니다. */
export function loadUserProfile(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as UserProfile;
    if (!parsed.myLanguage) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** 사용자 프로필을 localStorage에 저장합니다. */
export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

/** 이름과 내 언어로 프로필을 생성·저장합니다. */
export function upsertUserProfile(
  displayName: string,
  myLanguage: LanguageCode
): UserProfile {
  const existing = loadUserProfile();
  const now = new Date().toISOString();

  const profile: UserProfile = {
    displayName: displayName.trim(),
    myLanguage,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  saveUserProfile(profile);
  return profile;
}

/** 프로필을 삭제합니다. */
export function clearUserProfile(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
}
