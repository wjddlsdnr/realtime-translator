"use client";

import { useEffect, useRef, useState } from "react";

type MicLevelIndicatorProps = {
  stream: MediaStream | null;
  active: boolean;
};

/** 마이크 입력 강도를 표시해 음성이 들어가는지 확인합니다. */
export default function MicLevelIndicator({
  stream,
  active,
}: MicLevelIndicatorProps) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      setLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const update = () => {
      analyser.getByteFrequencyData(data);
      const average =
        data.reduce((sum, value) => sum + value, 0) / data.length;
      setLevel(Math.min(100, Math.round((average / 128) * 100)));
      rafRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      source.disconnect();
      void audioContext.close();
    };
  }, [active, stream]);

  if (!active) {
    return null;
  }

  return (
    <div className="mic-level" aria-label="마이크 입력 레벨">
      <span className="mic-level-label">마이크 입력</span>
      <div className="mic-level-bar">
        <div className="mic-level-fill" style={{ width: `${level}%` }} />
      </div>
      <span className="mic-level-hint">
        {level < 8
          ? "소리가 거의 안 들립니다. 마이크 위치/모드를 확인하세요."
          : level < 25
            ? "입력이 약합니다."
            : "입력 양호"}
      </span>
    </div>
  );
}
