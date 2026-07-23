// Draft Kannada translations for static UI chrome (tab labels, button text,
// empty states) — everything that ISN'T already server-supplied bilingual
// content (question/option/project text already carries its own textKn).
// These are a starting point, not a finished translation: SPEC.md §19G
// already tracks a full Kannada copy review as open, unfinished work — this
// file is exactly the kind of copy that review needs to check.
export const strings = {
  tabs: {
    home: { en: "Home", kn: "ಮುಖಪುಟ" },
    pulse: { en: "Pulse", kn: "ಪಲ್ಸ್" },
    snap: { en: "Snap", kn: "ಸ್ನ್ಯಾಪ್" },
    community: { en: "Community", kn: "ಸಮುದಾಯ" },
    vault: { en: "Vault", kn: "ವಾಲ್ಟ್" },
  },
  home: {
    yourTokens: { en: "Your tokens", kn: "ನಿಮ್ಮ ಟೋಕನ್‌ಗಳು" },
    todaysPulse: { en: "Today's Pulse", kn: "ಇಂದಿನ ಪಲ್ಸ್" },
    recentActivity: { en: "Recent activity", kn: "ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ" },
    emptyActivity: {
      en: "Nothing yet — answer today's Pulse.",
      kn: "ಇನ್ನೂ ಏನೂ ಇಲ್ಲ — ಇಂದಿನ ಪಲ್ಸ್‌ಗೆ ಉತ್ತರಿಸಿ.",
    },
    pendingOne: { en: "question waiting", kn: "ಪ್ರಶ್ನೆ ಕಾಯುತ್ತಿದೆ" },
    pendingMany: { en: "questions waiting", kn: "ಪ್ರಶ್ನೆಗಳು ಕಾಯುತ್ತಿವೆ" },
    allDone: { en: "All caught up for today", kn: "ಇಂದಿಗೆ ಎಲ್ಲಾ ಪೂರ್ಣಗೊಂಡಿದೆ" },
  },
  pulse: {
    questionOf: { en: "Question", kn: "ಪ್ರಶ್ನೆ" },
    of: { en: "of", kn: "ರಲ್ಲಿ" },
    allCaughtUp: { en: "All caught up", kn: "ಎಲ್ಲಾ ಪೂರ್ಣಗೊಂಡಿದೆ" },
    moreTomorrow: { en: "More questions tomorrow.", kn: "ನಾಳೆ ಇನ್ನಷ್ಟು ಪ್ರಶ್ನೆಗಳು." },
    checkAgain: { en: "Check again", kn: "ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ" },
    confirm: { en: "Confirm", kn: "ದೃಢೀಕರಿಸಿ" },
  },
  snap: {
    hint: {
      en: "Point at what you use — toothpaste, rice bag, soap.",
      kn: "ನೀವು ಬಳಸುವುದನ್ನು ತೋರಿಸಿ — ಟೂತ್‌ಪೇಸ್ಟ್, ಅಕ್ಕಿ ಚೀಲ, ಸೋಪು.",
    },
    permissionNeeded: {
      en: "Camera access is needed to snap what you use.",
      kn: "ನೀವು ಬಳಸುವುದನ್ನು ಸ್ನ್ಯಾಪ್ ಮಾಡಲು ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ಬೇಕು.",
    },
    allowCamera: { en: "Allow camera", kn: "ಕ್ಯಾಮೆರಾಗೆ ಅನುಮತಿಸಿ" },
    savedCredited: { en: "Snap saved — tokens on the way.", kn: "ಸ್ನ್ಯಾಪ್ ಉಳಿಸಲಾಗಿದೆ — ಟೋಕನ್‌ಗಳು ಬರುತ್ತಿವೆ." },
    savedDuplicate: { en: "Already saved.", kn: "ಈಗಾಗಲೇ ಉಳಿಸಲಾಗಿದೆ." },
    rejectedTitle: { en: "Photo rejected", kn: "ಫೋಟೋ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ" },
    rejectedBody: {
      en: "This looks like it contains a person. Try again without one.",
      kn: "ಇದರಲ್ಲಿ ವ್ಯಕ್ತಿ ಇರುವಂತೆ ಕಾಣುತ್ತದೆ. ವ್ಯಕ್ತಿ ಇಲ್ಲದೆ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    },
    uploadFailedTitle: { en: "Couldn't upload snap", kn: "ಸ್ನ್ಯಾಪ್ ಅಪ್‌ಲೋಡ್ ಆಗಲಿಲ್ಲ" },
  },
} as const;
