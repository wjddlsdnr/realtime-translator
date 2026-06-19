import { LANGUAGES, type LanguageCode } from "@/lib/types";

type LanguageSelectorProps = {
  label: string;
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
  disabled?: boolean;
};

export default function LanguageSelector({
  label,
  value,
  onChange,
  disabled = false,
}: LanguageSelectorProps) {
  return (
    <label className="language-selector">
      <span className="language-selector-label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as LanguageCode)}
        disabled={disabled}
        className="language-select"
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
