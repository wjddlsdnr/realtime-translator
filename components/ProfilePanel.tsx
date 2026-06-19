"use client";

import { useEffect, useState } from "react";
import LanguageSelector from "@/components/LanguageSelector";
import { upsertUserProfile } from "@/lib/profileStorage";
import type { LanguageCode, UserProfile } from "@/lib/types";
import { getLanguageLabel } from "@/lib/types";

type ProfilePanelProps = {
  profile: UserProfile | null;
  onProfileSaved: (profile: UserProfile) => void;
  disabled?: boolean;
};

export default function ProfilePanel({
  profile,
  onProfileSaved,
  disabled = false,
}: ProfilePanelProps) {
  const [isEditing, setIsEditing] = useState(!profile);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [myLanguage, setMyLanguage] = useState<LanguageCode>(
    profile?.myLanguage ?? "ko"
  );

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setMyLanguage(profile.myLanguage);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  }, [profile]);

  const handleSave = () => {
    const saved = upsertUserProfile(displayName, myLanguage);
    onProfileSaved(saved);
    setIsEditing(false);
  };

  if (!isEditing && profile) {
    return (
      <section className="profile-panel profile-panel-saved">
        <div className="profile-header">
          <h2>내 프로필</h2>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={() => setIsEditing(true)}
            disabled={disabled}
          >
            수정
          </button>
        </div>
        <p className="profile-summary">
          {profile.displayName ? (
            <>
              <strong>{profile.displayName}</strong>
              {" · "}
            </>
          ) : null}
          내 언어: <strong>{getLanguageLabel(profile.myLanguage)}</strong>
        </p>
        <p className="profile-hint">
          내 언어로 상대방 말을 듣고, 내 말은 상대 언어(기본 English)로 나갑니다.
          자동 모드에서 첫 음성 언어로 화자를 구분합니다.
        </p>
      </section>
    );
  }

  return (
    <section className="profile-panel profile-panel-edit">
      <h2>처음 설정</h2>
      <p className="profile-intro">
        내 언어만 선택하면 됩니다. 상대 언어는 말하면 자동으로 감지합니다.
      </p>

      <label className="profile-field">
        <span className="language-selector-label">이름 (선택)</span>
        <input
          type="text"
          className="profile-input"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="예: 홍길동"
          disabled={disabled}
        />
      </label>

      <LanguageSelector
        label="내 언어"
        value={myLanguage}
        onChange={setMyLanguage}
        disabled={disabled}
      />

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={disabled}
      >
        프로필 저장
      </button>
    </section>
  );
}
