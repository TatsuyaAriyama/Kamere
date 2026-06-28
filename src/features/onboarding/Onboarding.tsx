import { useState, type ReactNode } from "react";

type Props = {
  onClose: () => void;
};

type Step = {
  key: string;
  title: string;
  body: string;
  art: ReactNode;
};

const STEPS: Step[] = [
  {
    key: "welcome",
    title: "カメレへようこそ",
    body: "カメレオンが、世界の色を舌で採る。集めた色でテーマを組み、自由に描けます。",
    art: <ArtWelcome />,
  },
  {
    key: "capture",
    title: "色を採る",
    body: "カメラや写真にカメレオンを重ね、離した場所の色をパレットへ。長押しでルーペ照準。",
    art: <ArtCapture />,
  },
  {
    key: "design",
    title: "配色する",
    body: "採った色に役割を割り当て、テーマを自動生成。コントラスト診断で読みやすさも確認できます。",
    art: <ArtDesign />,
  },
  {
    key: "draw",
    title: "お絵かき",
    body: "採った色やお気に入りで自由に描けます。戻す・やり直し・全消しも自在。",
    art: <ArtDraw />,
  },
  {
    key: "favorite",
    title: "★ お気に入り",
    body: "気に入った色は★で保存。履歴を消しても残り、配色やお絵かきからいつでも呼び出せます。",
    art: <ArtFavorite />,
  },
];

export default function Onboarding({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const cur = STEPS[step];

  const next = () => (last ? onClose() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="つかいかた">
      <button type="button" className="ob-skip" onClick={onClose} aria-label="チュートリアルをとばす">
        スキップ
      </button>

      <div className="ob-body">
        <div className="ob-art" key={cur.key} aria-hidden>
          {cur.art}
        </div>
        <h2 className="ob-title">{cur.title}</h2>
        <p className="ob-text">{cur.body}</p>
      </div>

      <div className="ob-foot">
        <div className="ob-dots" role="tablist" aria-label="ステップ">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === step}
              aria-label={`${i + 1}ページ目`}
              className={`ob-dot${i === step ? " is-active" : ""}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <div className="ob-nav">
          {step > 0 && (
            <button type="button" className="ob-btn ghost" onClick={back}>
              戻る
            </button>
          )}
          <button type="button" className="ob-btn primary" onClick={next}>
            {last ? "はじめる" : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ステップごとの簡易イラスト（テーマトークンで配色） ── */

function ArtWelcome() {
  return <img className="ob-cham" src="/chameleon.png" alt="" draggable={false} />;
}

function ArtCapture() {
  return (
    <svg viewBox="0 0 120 120" className="ob-svg">
      <rect x="10" y="20" width="100" height="80" rx="12" fill="#0d0f0d" stroke="var(--line)" />
      <circle cx="44" cy="62" r="13" fill="var(--cham)" />
      <path
        d="M57 62 H84"
        stroke="var(--tongue)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="88" cy="62" r="9" fill="var(--tongue-pad)" />
      <circle cx="88" cy="62" r="4" fill="#d98a3c" />
    </svg>
  );
}

function ArtDesign() {
  return (
    <svg viewBox="0 0 120 120" className="ob-svg">
      <rect x="16" y="22" width="88" height="76" rx="12" fill="var(--paper)" />
      <rect x="28" y="34" width="64" height="16" rx="5" fill="var(--cham)" />
      <circle cx="36" cy="70" r="9" fill="var(--tongue)" />
      <circle cx="60" cy="70" r="9" fill="#2a4d69" />
      <circle cx="84" cy="70" r="9" fill="#d9a441" />
      <rect x="28" y="84" width="64" height="7" rx="3.5" fill="var(--mist)" />
    </svg>
  );
}

function ArtDraw() {
  return (
    <svg viewBox="0 0 120 120" className="ob-svg">
      <rect x="14" y="16" width="92" height="88" rx="12" fill="var(--paper)" />
      <path
        d="M28 78 C44 40 62 96 90 44"
        fill="none"
        stroke="var(--cham)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M30 92 C46 70 58 84 84 70"
        fill="none"
        stroke="var(--tongue)"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArtFavorite() {
  return (
    <svg viewBox="0 0 120 120" className="ob-svg">
      <circle cx="60" cy="60" r="40" fill="var(--cham)" />
      <path
        d="M60 34 l7.4 15 16.6 2.4 -12 11.7 2.8 16.5 -14.8 -7.8 -14.8 7.8 2.8 -16.5 -12 -11.7 16.6 -2.4 z"
        fill="#e8b84b"
        stroke="#caa033"
        strokeWidth="1.5"
      />
    </svg>
  );
}
